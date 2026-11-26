use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
mod win_dpapi {
    use std::ffi::c_void;

    pub type BOOL = i32;
    pub type DWORD = u32;

    #[repr(C)]
    pub struct DATA_BLOB {
        pub cb_data: DWORD,
        pub pb_data: *mut u8,
    }

    #[repr(C)]
    pub struct MEMORYSTATUSEX {
        pub dw_length: DWORD,
        pub dw_memory_load: DWORD,
        pub ull_total_phys: u64,
        pub ull_avail_phys: u64,
        pub ull_total_page_file: u64,
        pub ull_avail_page_file: u64,
        pub ull_total_virtual: u64,
        pub ull_avail_virtual: u64,
        pub ull_avail_extended_virtual: u64,
    }

    #[link(name = "crypt32")]
    unsafe extern "system" {
        pub fn CryptProtectData(
            p_data_in: *const DATA_BLOB,
            sz_data_descr: *const u16,
            p_optional_entropy: *const DATA_BLOB,
            pv_reserved: *mut c_void,
            p_prompt_struct: *mut c_void,
            dw_flags: DWORD,
            p_data_out: *mut DATA_BLOB,
        ) -> BOOL;

        pub fn CryptUnprotectData(
            p_data_in: *const DATA_BLOB,
            ppsz_data_descr: *mut *mut u16,
            p_optional_entropy: *const DATA_BLOB,
            pv_reserved: *mut c_void,
            p_prompt_struct: *mut c_void,
            dw_flags: DWORD,
            p_data_out: *mut DATA_BLOB,
        ) -> BOOL;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        pub fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
        pub fn GetDiskFreeSpaceExW(
            lp_directory_name: *const u16,
            lp_free_bytes_available_to_caller: *mut u64,
            lp_total_number_of_bytes: *mut u64,
            lp_total_number_of_free_bytes: *mut u64,
        ) -> BOOL;
        pub fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> BOOL;
    }

    pub fn encrypt(plain: &[u8]) -> Result<Vec<u8>, String> {
        if plain.is_empty() {
            return Ok(Vec::new());
        }
        let in_blob = DATA_BLOB {
            cb_data: plain.len() as DWORD,
            pb_data: plain.as_ptr() as *mut u8,
        };
        let mut out_blob = DATA_BLOB {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = unsafe {
            CryptProtectData(
                &in_blob,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                0,
                &mut out_blob,
            )
        };
        if ok == 0 || out_blob.pb_data.is_null() {
            return Err("Windows DPAPI encryption failed".to_string());
        }
        let encrypted = unsafe {
            std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec()
        };
        unsafe {
            LocalFree(out_blob.pb_data as *mut c_void);
        }
        Ok(encrypted)
    }

    pub fn decrypt(cipher: &[u8]) -> Result<Vec<u8>, String> {
        if cipher.is_empty() {
            return Ok(Vec::new());
        }
        let in_blob = DATA_BLOB {
            cb_data: cipher.len() as DWORD,
            pb_data: cipher.as_ptr() as *mut u8,
        };
        let mut out_blob = DATA_BLOB {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = unsafe {
            CryptUnprotectData(
                &in_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                0,
                &mut out_blob,
            )
        };
        if ok == 0 || out_blob.pb_data.is_null() {
            return Err("Windows DPAPI decryption failed".to_string());
        }
        let decrypted = unsafe {
            std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec()
        };
        unsafe {
            LocalFree(out_blob.pb_data as *mut c_void);
        }
        Ok(decrypted)
    }

    pub fn get_disk_space(path_str: &str) -> (u64, u64) {
        let mut wide: Vec<u16> = path_str.encode_utf16().collect();
        wide.push(0);
        let mut free_avail: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free: u64 = 0;
        let ok = unsafe {
            GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut free_avail,
                &mut total_bytes,
                &mut total_free,
            )
        };
        if ok != 0 {
            (free_avail, total_bytes)
        } else {
            (5 * 1024 * 1024 * 1024, 250 * 1024 * 1024 * 1024)
        }
    }

    pub fn get_system_ram() -> (u64, u64) {
        let mut mem = MEMORYSTATUSEX {
            dw_length: std::mem::size_of::<MEMORYSTATUSEX>() as DWORD,
            dw_memory_load: 0,
            ull_total_phys: 0,
            ull_avail_phys: 0,
            ull_total_page_file: 0,
            ull_avail_page_file: 0,
            ull_total_virtual: 0,
            ull_avail_virtual: 0,
            ull_avail_extended_virtual: 0,
        };
        let ok = unsafe { GlobalMemoryStatusEx(&mut mem) };
        if ok != 0 {
            (mem.ull_total_phys, mem.ull_avail_phys)
        } else {
            (8 * 1024 * 1024 * 1024, 4 * 1024 * 1024 * 1024)
        }
    }
}

pub fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn get_app_data_dir() -> PathBuf {
    let base = env::var("LOCALAPPDATA")
        .or_else(|_| env::var("APPDATA"))
        .or_else(|_| env::var("USERPROFILE"))
        .or_else(|_| env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let dir = Path::new(&base).join("LuminessAssist");
    let _ = fs::create_dir_all(&dir);
    let _ = fs::create_dir_all(dir.join("vault"));
    dir
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct MachineCredentialsVault {
    pub gemini_api_key: String,
    pub claude_api_key: String,
    pub codex_api_key: String,
    pub custom_api_key: String,
    pub search_api_key: String,
    pub google_oauth_session_json: String,
    pub updated_at: u64,
}

fn get_vault_file_path() -> PathBuf {
    get_app_data_dir().join("vault").join("credentials.dpapi")
}

pub fn read_vault_internal() -> MachineCredentialsVault {
    let path = get_vault_file_path();
    let Ok(raw_bytes) = fs::read(&path) else {
        return MachineCredentialsVault::default();
    };
    if raw_bytes.is_empty() {
        return MachineCredentialsVault::default();
    }

    #[cfg(target_os = "windows")]
    let plain_bytes = match win_dpapi::decrypt(&raw_bytes) {
        Ok(b) => b,
        Err(_) => raw_bytes,
    };

    #[cfg(not(target_os = "windows"))]
    let plain_bytes = raw_bytes;

    serde_json::from_slice::<MachineCredentialsVault>(&plain_bytes).unwrap_or_default()
}

pub fn write_vault_internal(vault: &MachineCredentialsVault) -> Result<(), String> {
    let path = get_vault_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json_bytes = serde_json::to_vec(vault)
        .map_err(|e| format!("Failed to serialize credential vault: {}", e))?;

    #[cfg(target_os = "windows")]
    let out_bytes = win_dpapi::encrypt(&json_bytes)?;

    #[cfg(not(target_os = "windows"))]
    let out_bytes = json_bytes;

    fs::write(&path, out_bytes)
        .map_err(|e| format!("Failed to write machine credential vault: {}", e))
}

#[tauri::command]
pub fn load_machine_credentials() -> Result<MachineCredentialsVault, String> {
    Ok(read_vault_internal())
}

#[tauri::command]
pub fn save_machine_credentials(
    gemini_api_key: Option<String>,
    claude_api_key: Option<String>,
    codex_api_key: Option<String>,
    custom_api_key: Option<String>,
    search_api_key: Option<String>,
    google_oauth_session_json: Option<String>,
) -> Result<MachineCredentialsVault, String> {
    let mut vault = read_vault_internal();
    if let Some(g) = gemini_api_key {
        vault.gemini_api_key = g.trim().to_string();
    }
    if let Some(c) = claude_api_key {
        vault.claude_api_key = c.trim().to_string();
    }
    if let Some(x) = codex_api_key {
        vault.codex_api_key = x.trim().to_string();
    }
    if let Some(k) = custom_api_key {
        vault.custom_api_key = k.trim().to_string();
    }
    if let Some(s) = search_api_key {
        vault.search_api_key = s.trim().to_string();
    }
    if let Some(oauth) = google_oauth_session_json {
        vault.google_oauth_session_json = oauth;
    }
    vault.updated_at = now_unix_ms();
    write_vault_internal(&vault)?;
    Ok(vault)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppConfigJson {
    pub version: String,
    pub selected_provider: String,
    pub gemini_model: String,
    pub claude_model: String,
    pub codex_model: String,
    pub custom_api_format: String,
    pub custom_api_endpoint: String,
    pub custom_api_model: String,
    pub custom_api_headers: String,
    pub active_agent_preset: String,
    pub agent_cli_command: String,
    pub local_ai_runtime: String,
    pub local_ai_endpoint: String,
    pub local_ai_model: String,
    pub storage_tier: String,
    pub storage_limit_bytes: u64,
    pub installation_storage_prompted: bool,
    pub auto_approve_tools: bool,
    pub search_engine_enabled: bool,
    pub memory_sync_enabled: bool,
    pub auto_start_windows: bool,
    pub startup_registered_once: bool,
    pub google_account_email: Option<String>,
    pub bot_single_click_action: String,
    pub box_auto_close_seconds: u64,
    pub floating_positions: serde_json::Value,
    pub bot_customization: serde_json::Value,
    pub drink_reminder: serde_json::Value,
    pub music_player: serde_json::Value,
    pub updated_at: u64,
}

impl Default for AppConfigJson {
    fn default() -> Self {
        Self {
            version: "1.3.4".to_string(),
            selected_provider: "gemini".to_string(),
            gemini_model: "gemini-2.5-flash".to_string(),
            claude_model: "claude-sonnet-4-20250514".to_string(),
            codex_model: "gpt-4o".to_string(),
            custom_api_format: "openai-chat".to_string(),
            custom_api_endpoint: "".to_string(),
            custom_api_model: "".to_string(),
            custom_api_headers: "".to_string(),
            active_agent_preset: "direct-custom".to_string(),
            agent_cli_command: "opencode".to_string(),
            local_ai_runtime: "auto".to_string(),
            local_ai_endpoint: "http://127.0.0.1:11434".to_string(),
            local_ai_model: "qwen2.5-coder:latest".to_string(),
            storage_tier: "recommended".to_string(),
            storage_limit_bytes: 5 * 1024 * 1024 * 1024, // 5 GB Recommended Default
            installation_storage_prompted: false,
            auto_approve_tools: false,
            search_engine_enabled: true,
            memory_sync_enabled: true,
            auto_start_windows: true,
            startup_registered_once: false,
            google_account_email: None,
            bot_single_click_action: "chat".to_string(),
            box_auto_close_seconds: 120,
            floating_positions: serde_json::json!({
                "history": { "x": 20, "y": 20, "width": 350, "height": 440 },
                "settings": { "x": 860, "y": 430, "width": 430, "height": 520 },
                "music": { "x": 450, "y": 20, "width": 392, "height": 420 },
                "wellbeing": { "x": 20, "y": 430, "width": 520, "height": 500 },
                "taskmanager": { "x": 860, "y": 20, "width": 440, "height": 420 }
            }),
            bot_customization: serde_json::json!({}),
            drink_reminder: serde_json::json!({
                "enabled": true,
                "interval_minutes": 45,
                "snooze_minutes": 10,
                "daily_goal_glasses": 8,
                "daily_glasses": 0,
                "sound_enabled": true,
                "custom_message": "Time to drink some water! Take a sip to stay hydrated."
            }),
            music_player: serde_json::json!({
                "volume": 0.55,
                "muted": false,
                "shuffle": false,
                "loop_mode": "all",
                "active_track_id": "ambient:lofi",
                "music_folder": "",
                "custom_tracks": []
            }),
            updated_at: now_unix_ms(),
        }
    }
}

pub fn tier_to_bytes(tier: &str) -> u64 {
    match tier.trim().to_lowercase().as_str() {
        "lightweight" | "1gb" => 1 * 1024 * 1024 * 1024,
        "recommended" | "5gb" => 5 * 1024 * 1024 * 1024,
        "extended" | "10gb" => 10 * 1024 * 1024 * 1024,
        "large" | "25gb" => 25 * 1024 * 1024 * 1024,
        "unlimited" | "infinity" | "infinite" => 0,
        _ => 5 * 1024 * 1024 * 1024,
    }
}

fn get_config_file_path() -> PathBuf {
    get_app_data_dir().join("config.json")
}

fn get_database_file_path() -> PathBuf {
    get_app_data_dir().join("database.json")
}

pub fn load_config_internal() -> AppConfigJson {
    let path = get_config_file_path();
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(mut cfg) = serde_json::from_str::<AppConfigJson>(&raw) {
            if cfg.storage_tier != "unlimited" && cfg.storage_limit_bytes == 0 {
                cfg.storage_limit_bytes = tier_to_bytes(&cfg.storage_tier);
            }
            return cfg;
        }
    }
    let default_cfg = AppConfigJson::default();
    let _ = save_config_internal(&default_cfg);
    default_cfg
}

pub fn save_config_internal(cfg: &AppConfigJson) -> Result<AppConfigJson, String> {
    let mut updated = cfg.clone();
    if updated.storage_tier.to_lowercase() == "unlimited" {
        updated.storage_limit_bytes = 0;
    } else if updated.storage_limit_bytes == 0 {
        updated.storage_limit_bytes = tier_to_bytes(&updated.storage_tier);
    }
    updated.updated_at = now_unix_ms();
    let path = get_config_file_path();
    let serialized = serde_json::to_string_pretty(&updated)
        .map_err(|e| format!("Failed to serialize config.json: {}", e))?;
    fs::write(&path, serialized)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
    Ok(updated)
}

#[tauri::command]
pub fn get_app_config() -> Result<AppConfigJson, String> {
    Ok(load_config_internal())
}

#[tauri::command]
pub fn save_app_config(config: AppConfigJson) -> Result<AppConfigJson, String> {
    save_config_internal(&config)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StorageStatus {
    pub storage_tier: String,
    pub configured_limit_bytes: u64,
    pub effective_limit_bytes: u64,
    pub used_bytes: u64,
    pub disk_free_bytes: u64,
    pub disk_total_bytes: u64,
    pub usage_percent: f64,
    pub disk_warning: bool,
    pub disk_critical: bool,
    pub warning_message: Option<String>,
    pub config_path: String,
    pub database_path: String,
}

fn compute_dir_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += compute_dir_size(&p);
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

#[tauri::command]
pub fn get_storage_status() -> Result<StorageStatus, String> {
    let cfg = load_config_internal();
    let app_dir = get_app_data_dir();
    let used_bytes = compute_dir_size(&app_dir);

    #[cfg(target_os = "windows")]
    let (disk_free_bytes, disk_total_bytes) =
        win_dpapi::get_disk_space(&app_dir.to_string_lossy());

    #[cfg(not(target_os = "windows"))]
    let (disk_free_bytes, disk_total_bytes) =
        (10 * 1024 * 1024 * 1024u64, 250 * 1024 * 1024 * 1024u64);

    // Reserve at least 512 MB of real disk space so Unlimited or Large tiers never fill the OS drive
    let safety_reserve: u64 = 512 * 1024 * 1024;
    let max_safe_disk_allocation = (disk_free_bytes + used_bytes).saturating_sub(safety_reserve);

    let configured_limit_bytes = if cfg.storage_tier.to_lowercase() == "unlimited" {
        0
    } else if cfg.storage_limit_bytes > 0 {
        cfg.storage_limit_bytes
    } else {
        tier_to_bytes(&cfg.storage_tier)
    };

    let effective_limit_bytes = if configured_limit_bytes == 0 {
        max_safe_disk_allocation.max(64 * 1024 * 1024)
    } else {
        configured_limit_bytes.min(max_safe_disk_allocation.max(64 * 1024 * 1024))
    };

    let usage_percent = if effective_limit_bytes > 0 {
        ((used_bytes as f64 / effective_limit_bytes as f64) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    let low_disk_warning = disk_free_bytes < 2 * 1024 * 1024 * 1024; // < 2 GB free
    let low_disk_critical = disk_free_bytes < 512 * 1024 * 1024; // < 512 MB free
    let quota_warning = usage_percent >= 85.0;
    let quota_critical = usage_percent >= 96.0;

    let disk_warning = low_disk_warning || quota_warning;
    let disk_critical = low_disk_critical || quota_critical;

    let warning_message = if low_disk_critical {
        Some("Critical: Drive has less than 512 MB free space. Automatic storage protection is pruning old logs to protect your PC.".to_string())
    } else if quota_critical {
        Some("Storage allocation is nearly full (>96%). Oldest search cache and logs will be pruned automatically, or increase your allocation in Settings.".to_string())
    } else if low_disk_warning {
        let free_gb = (disk_free_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        Some(format!(
            "Notice: Drive has {:.2} GB of available disk space remaining. Luminess automatically caps storage below available disk capacity.",
            free_gb
        ))
    } else if configured_limit_bytes > max_safe_disk_allocation {
        let free_gb = (disk_free_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        Some(format!(
            "Selected tier exceeds current free disk space ({:.2} GB free). Effective limit is safely capped to available disk capacity.",
            free_gb
        ))
    } else {
        None
    };

    Ok(StorageStatus {
        storage_tier: cfg.storage_tier,
        configured_limit_bytes,
        effective_limit_bytes,
        used_bytes,
        disk_free_bytes,
        disk_total_bytes,
        usage_percent,
        disk_warning,
        disk_critical,
        warning_message,
        config_path: get_config_file_path().to_string_lossy().to_string(),
        database_path: get_database_file_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn db_load_state() -> Result<String, String> {
    let path = get_database_file_path();
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read database.json: {}", e))
}

#[tauri::command]
pub fn db_save_state(json_payload: String) -> Result<StorageStatus, String> {
    let path = get_database_file_path();
    let status = get_storage_status()?;
    let payload_len = json_payload.len() as u64;

    if payload_len > status.effective_limit_bytes {
        return Err(format!(
            "Database payload ({} bytes) exceeds effective storage quota ({} bytes). Please clear old history or increase storage limit in Settings.",
            payload_len, status.effective_limit_bytes
        ));
    }

    fs::write(&path, json_payload.as_bytes())
        .map_err(|e| format!("Failed to save database.json: {}", e))?;

    get_storage_status()
}

#[tauri::command]
pub fn db_clear_data() -> Result<StorageStatus, String> {
    let path = get_database_file_path();
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    get_storage_status()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalAiHardwareReport {
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_cores: usize,
    pub gpu_name: String,
    pub free_disk_gb: f64,
    pub hardware_tier: String,
    pub recommended_runtime: String,
    pub recommended_model: String,
    pub compatibility_notes: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalAiServerInfo {
    pub name: String,
    pub kind: String, // "ollama" | "openai_compatible" | "opencode" | "builtin"
    pub endpoint: String,
    pub online: bool,
    pub models: Vec<String>,
    pub notes: String,
}

#[tauri::command]
pub fn check_local_ai_hardware() -> Result<LocalAiHardwareReport, String> {
    let app_dir = get_app_data_dir();

    #[cfg(target_os = "windows")]
    let (total_ram, avail_ram) = win_dpapi::get_system_ram();
    #[cfg(not(target_os = "windows"))]
    let (total_ram, avail_ram) = (16 * 1024 * 1024 * 1024u64, 8 * 1024 * 1024 * 1024u64);

    #[cfg(target_os = "windows")]
    let (free_disk, _) = win_dpapi::get_disk_space(&app_dir.to_string_lossy());
    #[cfg(not(target_os = "windows"))]
    let free_disk = 20 * 1024 * 1024 * 1024u64;

    let total_ram_gb = ((total_ram as f64) / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0;
    let available_ram_gb = ((avail_ram as f64) / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0;
    let free_disk_gb = ((free_disk as f64) / (1024.0 * 1024.0 * 1024.0) * 100.0).round() / 100.0;
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);

    let gpu_name = "Integrated / System GPU".to_string();

    let (hardware_tier, recommended_model, compatibility_notes) = if free_disk_gb < 6.5 {
        (
            format!("High RAM ({:.1} GB, {} cores) • Compact Disk ({:.1} GB free)", total_ram_gb, cpu_cores, free_disk_gb),
            "qwen2.5-coder:1.5b".to_string(),
            format!(
                "Your PC has strong memory ({:.1} GB RAM, {} CPU threads), and {:.2} GB free disk space. Built-in Local AI + OpenCode are active immediately with zero extra disk usage, or use compact Ollama models (qwen2.5-coder:1.5b / llama3.2:1b).",
                total_ram_gb, cpu_cores, free_disk_gb
            ),
        )
    } else if total_ram_gb >= 24.0 {
        (
            format!("Workstation Class ({:.1} GB RAM, {} cores)", total_ram_gb, cpu_cores),
            "qwen2.5-coder:7b".to_string(),
            format!(
                "Your PC has {:.1} GB RAM and {} threads, easily supporting 7B–14B parameter local models via Ollama or llama.cpp.",
                total_ram_gb, cpu_cores
            ),
        )
    } else if total_ram_gb >= 12.0 {
        (
            format!("Standard AI Desktop ({:.1} GB RAM, {} cores)", total_ram_gb, cpu_cores),
            "llama3.2:3b".to_string(),
            format!(
                "Your PC has {:.1} GB RAM and {} threads, ideal for 3B–7B quantized models via Ollama.",
                total_ram_gb, cpu_cores
            ),
        )
    } else {
        (
            format!("Lightweight Desktop ({:.1} GB RAM, {} cores)", total_ram_gb, cpu_cores),
            "qwen2.5-coder:1.5b".to_string(),
            "Recommended 1B–3B lightweight local models or the built-in local conversational runtime.".to_string(),
        )
    };

    Ok(LocalAiHardwareReport {
        total_ram_gb,
        available_ram_gb,
        cpu_cores,
        gpu_name,
        free_disk_gb,
        hardware_tier,
        recommended_runtime: "ollama".to_string(),
        recommended_model,
        compatibility_notes,
    })
}

fn http_get_local_json(host_port: &str, path: &str, timeout_ms: u64) -> Option<serde_json::Value> {
    let addr: SocketAddr = host_port.parse().ok()?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms)).ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(timeout_ms)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(timeout_ms)));

    let req = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        path, host_port
    );
    stream.write_all(req.as_bytes()).ok()?;

    let mut resp_bytes = Vec::new();
    let _ = stream.read_to_end(&mut resp_bytes);
    let resp_str = String::from_utf8_lossy(&resp_bytes);
    let body = resp_str.split("\r\n\r\n").nth(1)?;
    let start = body.find('{')?;
    let end = body.rfind('}')?;
    serde_json::from_str(&body[start..=end]).ok()
}

#[tauri::command]
pub fn probe_local_ai_servers() -> Result<Vec<LocalAiServerInfo>, String> {
    let mut servers = Vec::new();

    // 1. Probe Ollama (127.0.0.1:11434)
    let mut ollama_models = Vec::new();
    let mut ollama_online = false;
    if let Some(json) = http_get_local_json("127.0.0.1:11434", "/api/tags", 350) {
        ollama_online = true;
        if let Some(arr) = json.get("models").and_then(|v| v.as_array()) {
            for m in arr {
                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                    ollama_models.push(name.to_string());
                }
            }
        }
    }
    servers.push(LocalAiServerInfo {
        name: "Ollama Local Server".to_string(),
        kind: "ollama".to_string(),
        endpoint: "http://127.0.0.1:11434".to_string(),
        online: ollama_online,
        models: if ollama_models.is_empty() {
            vec![
                "qwen2.5-coder:latest".to_string(),
                "llama3.2:latest".to_string(),
                "gemma2:2b".to_string(),
            ]
        } else {
            ollama_models
        },
        notes: if ollama_online {
            "Ollama server is online and ready for OpenAI-compatible local inference.".to_string()
        } else {
            "Ollama daemon not currently listening on :11434 (Start with `ollama serve` or use Built-in / OpenCode runtime).".to_string()
        },
    });

    // 2. Probe llama.cpp / LocalAI (127.0.0.1:8080)
    let mut llamacpp_models = Vec::new();
    let mut llamacpp_online = false;
    if let Some(json) = http_get_local_json("127.0.0.1:8080", "/v1/models", 250) {
        llamacpp_online = true;
        if let Some(arr) = json.get("data").and_then(|v| v.as_array()) {
            for m in arr {
                if let Some(id) = m.get("id").and_then(|n| n.as_str()) {
                    llamacpp_models.push(id.to_string());
                }
            }
        }
    }
    servers.push(LocalAiServerInfo {
        name: "llama.cpp / OpenAI-Compatible (:8080)".to_string(),
        kind: "openai_compatible".to_string(),
        endpoint: "http://127.0.0.1:8080".to_string(),
        online: llamacpp_online,
        models: if llamacpp_models.is_empty() {
            vec!["local-gguf-model".to_string()]
        } else {
            llamacpp_models
        },
        notes: if llamacpp_online {
            "llama.cpp OpenAI-compatible server detected on port 8080.".to_string()
        } else {
            "No llama.cpp server detected on port 8080.".to_string()
        },
    });

    // 3. Probe LM Studio (127.0.0.1:1234)
    let mut lmstudio_models = Vec::new();
    let mut lmstudio_online = false;
    if let Some(json) = http_get_local_json("127.0.0.1:1234", "/v1/models", 250) {
        lmstudio_online = true;
        if let Some(arr) = json.get("data").and_then(|v| v.as_array()) {
            for m in arr {
                if let Some(id) = m.get("id").and_then(|n| n.as_str()) {
                    lmstudio_models.push(id.to_string());
                }
            }
        }
    }
    servers.push(LocalAiServerInfo {
        name: "LM Studio OpenAI Server (:1234)".to_string(),
        kind: "openai_compatible".to_string(),
        endpoint: "http://127.0.0.1:1234".to_string(),
        online: lmstudio_online,
        models: if lmstudio_models.is_empty() {
            vec!["lmstudio-local".to_string()]
        } else {
            lmstudio_models
        },
        notes: if lmstudio_online {
            "LM Studio local server detected on port 1234.".to_string()
        } else {
            "No LM Studio server detected on port 1234.".to_string()
        },
    });

    // 4. Probe OpenCode & KiloCode local CLI agents (without spawning visible console windows)
    let probe_cli_version = |bins: &[&str]| -> (bool, String) {
        for bin in bins {
            let mut cmd = Command::new(bin);
            cmd.arg("--version");
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            if let Ok(out) = cmd.output() {
                if out.status.success() {
                    let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    return (
                        true,
                        if ver.is_empty() {
                            format!("{} CLI detected", bin)
                        } else {
                            ver
                        },
                    );
                }
            }
            // Check npm global .cmd shim explicitly on Windows if PATH differs in Tauri shell
            if let Ok(appdata) = env::var("APPDATA") {
                let shim = PathBuf::from(appdata).join("npm").join(format!("{}.cmd", bin));
                if shim.exists() {
                    let mut shim_cmd = Command::new(&shim);
                    shim_cmd.arg("--version");
                    #[cfg(target_os = "windows")]
                    shim_cmd.creation_flags(CREATE_NO_WINDOW);
                    if let Ok(out) = shim_cmd.output() {
                        if out.status.success() {
                            let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                            return (
                                true,
                                if ver.is_empty() {
                                    format!("{} CLI detected", bin)
                                } else {
                                    ver
                                },
                            );
                        }
                    }
                    return (true, format!("Installed at {}", shim.display()));
                }
            }
        }
        (false, String::new())
    };

    let (opencode_online, opencode_ver) = probe_cli_version(&["opencode"]);
    servers.push(LocalAiServerInfo {
        name: "OpenCode CLI Local Agent".to_string(),
        kind: "opencode".to_string(),
        endpoint: "cli://opencode".to_string(),
        online: opencode_online,
        models: vec!["opencode-local-agent".to_string()],
        notes: if opencode_online {
            format!("OpenCode CLI ready ({}).", opencode_ver)
        } else {
            "OpenCode CLI not detected on PATH. Install via `npm install -g opencode-ai`.".to_string()
        },
    });

    let (kilocode_online, kilocode_ver) = probe_cli_version(&["kilocode", "kilo"]);
    servers.push(LocalAiServerInfo {
        name: "KiloCode CLI Local Agent".to_string(),
        kind: "kilocode".to_string(),
        endpoint: "cli://kilocode".to_string(),
        online: kilocode_online,
        models: vec!["kilocode-local-agent".to_string()],
        notes: if kilocode_online {
            format!("KiloCode CLI ready ({}).", kilocode_ver)
        } else {
            "KiloCode CLI not detected on PATH. Install via `npm install -g @kilocode/cli`.".to_string()
        },
    });

    // 5. Built-in Local Conversational Engine + CLI Agents
    servers.push(LocalAiServerInfo {
        name: "Luminess Native Local AI + Agents".to_string(),
        kind: "builtin".to_string(),
        endpoint: "local://luminess-native".to_string(),
        online: true,
        models: vec![
            "luminess-local-v2".to_string(),
            "opencode-local-agent".to_string(),
            "kilocode-local-agent".to_string(),
        ],
        notes: "Always-on local conversational engine with PC tool execution, persistent memory, and web search.".to_string(),
    });

    Ok(servers)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalChatMessageInput {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn local_ai_chat_completion(
    endpoint: String,
    model: String,
    messages: Vec<LocalChatMessageInput>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = endpoint.trim().trim_end_matches('/').to_string();
        let url = if base.ends_with("/v1") {
            format!("{}/chat/completions", base)
        } else {
            format!("{}/v1/chat/completions", base)
        };

        let payload = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": 0.6,
            "stream": false
        });
        let payload_str = serde_json::to_string(&payload)
            .map_err(|e| format!("Failed to encode local AI request: {}", e))?;

        let b64 = base64_encode(payload_str.as_bytes());
        let ps_script = format!(
            r#"
$ErrorActionPreference = 'Stop'
$bytes = [System.Convert]::FromBase64String('{b64}')
$json = [System.Text.Encoding]::UTF8.GetString($bytes)
$resp = Invoke-RestMethod -Uri '{url}' -Method Post -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 45
$text = $resp.choices[0].message.content
if (-not $text -and $resp.message.content) {{ $text = $resp.message.content }}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output $text
"#
        );

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to invoke local AI endpoint: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("Local AI server error: {}", err));
        }

        let reply = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if reply.is_empty() {
            return Err("Local AI server returned an empty response.".to_string());
        }
        Ok(reply)
    })
    .await
    .map_err(|e| format!("Local AI task error: {}", e))?
}

fn base64_encode(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    let mut i = 0;
    while i < input.len() {
        let b0 = input[i] as u32;
        let b1 = if i + 1 < input.len() { input[i + 1] as u32 } else { 0 };
        let b2 = if i + 2 < input.len() { input[i + 2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        if i + 1 < input.len() {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if i + 2 < input.len() {
            out.push(TABLE[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        i += 3;
    }
    out
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
    pub source: String,
}

#[tauri::command]
pub async fn perform_web_search(
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<WebSearchResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = query.trim().to_string();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }
        let limit = max_results.unwrap_or(6).clamp(1, 12);
        let q_b64 = base64_encode(trimmed.as_bytes());

        let ps_script = format!(
            r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
$q = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{q_b64}'))
$encoded = [System.Uri]::EscapeDataString($q)
$results = New-Object System.Collections.Generic.List[Object]

# 1. DuckDuckGo Instant Answer API
try {{
    $ddgUrl = "https://api.duckduckgo.com/?q=$encoded&format=json&no_html=1&skip_disambig=1"
    $ddg = Invoke-RestMethod -Uri $ddgUrl -Headers @{{ 'User-Agent' = 'LuminessAssist/1.2' }} -TimeoutSec 8 -ErrorAction Stop
    if ($ddg.AbstractText -and $ddg.AbstractURL) {{
        $results.Add(@{{
            title = if ($ddg.Heading) {{ [string]$ddg.Heading }} else {{ $q }}
            url = [string]$ddg.AbstractURL
            snippet = [string]$ddg.AbstractText
            source = if ($ddg.AbstractSource) {{ [string]$ddg.AbstractSource }} else {{ 'DuckDuckGo' }}
        }})
    }}
    if ($ddg.RelatedTopics) {{
        foreach ($topic in $ddg.RelatedTopics) {{
            if ($results.Count -ge {limit}) {{ break }}
            if ($topic.Text -and $topic.FirstURL) {{
                $results.Add(@{{
                    title = ([string]$topic.Text).Split(' - ')[0]
                    url = [string]$topic.FirstURL
                    snippet = [string]$topic.Text
                    source = 'DuckDuckGo'
                }})
            }}
        }}
    }}
}} catch {{}}

# 2. Wikipedia OpenSearch API
try {{
    if ($results.Count -lt {limit}) {{
        $wikiUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=$encoded&utf8=&format=json&srlimit=5"
        $wiki = Invoke-RestMethod -Uri $wikiUrl -Headers @{{ 'User-Agent' = 'LuminessAssist/1.2 (https://github.com/jasonhukom/Luminess-Assist)' }} -TimeoutSec 8 -ErrorAction Stop
        if ($wiki.query -and $wiki.query.search) {{
            foreach ($item in $wiki.query.search) {{
                if ($results.Count -ge {limit}) {{ break }}
                $cleanSnippet = ([string]$item.snippet) -replace '<[^>]+>', '' -replace '&quot;', '"' -replace '&#039;', "'" -replace '&amp;', '&'
                $titleStr = [string]$item.title
                $pageUrl = "https://en.wikipedia.org/wiki/" + [System.Uri]::EscapeDataString($titleStr.Replace(' ', '_'))
                $results.Add(@{{
                    title = "$titleStr — Wikipedia"
                    url = $pageUrl
                    snippet = $cleanSnippet
                    source = 'Wikipedia'
                }})
            }}
        }}
    }}
}} catch {{}}

# 3. DuckDuckGo HTML Search Fallback for live web links
try {{
    if ($results.Count -lt {limit}) {{
        $htmlUrl = "https://html.duckduckgo.com/html/?q=$encoded"
        $resp = Invoke-WebRequest -Uri $htmlUrl -Headers @{{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }} -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $content = [string]$resp.Content
        $matches = [regex]::Matches($content, '<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>')
        foreach ($m in $matches) {{
            if ($results.Count -ge {limit}) {{ break }}
            $rawHref = [string]$m.Groups[1].Value
            if ($rawHref -match 'uddg=([^&]+)') {{
                $rawHref = [System.Uri]::UnescapeDataString($Matches[1])
            }}
            $t = ([string]$m.Groups[2].Value) -replace '<[^>]+>', ''
            $s = ([string]$m.Groups[3].Value) -replace '<[^>]+>', ''
            if ($rawHref.StartsWith('http')) {{
                $results.Add(@{{
                    title = [System.Net.WebUtility]::HtmlDecode($t.Trim())
                    url = $rawHref
                    snippet = [System.Net.WebUtility]::HtmlDecode($s.Trim())
                    source = 'Web Search'
                }})
            }}
        }}
    }}
}} catch {{}}

ConvertTo-Json -InputObject @($results) -Depth 4 -Compress
"#
        );

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run web search: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return Ok(Vec::new());
        }

        if let Ok(parsed) = serde_json::from_str::<Vec<WebSearchResult>>(&stdout) {
            return Ok(parsed);
        }
        if let Ok(single) = serde_json::from_str::<WebSearchResult>(&stdout) {
            return Ok(vec![single]);
        }

        Ok(Vec::new())
    })
    .await
    .map_err(|e| format!("Web search task error: {}", e))?
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HttpProxyResponse {
    pub ok: bool,
    pub status: u16,
    pub status_text: String,
    pub body: String,
}

async fn execute_http_proxy(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    timeout_secs: u64,
) -> Result<HttpProxyResponse, String> {
    let trimmed_url = url.trim().to_string();
    if !(trimmed_url.starts_with("http://") || trimmed_url.starts_with("https://")) {
        return Err("Only http:// and https:// URLs are supported.".to_string());
    }

    let req_payload = serde_json::json!({
        "url": trimmed_url,
        "method": if method.trim().is_empty() { "GET".to_string() } else { method.trim().to_uppercase() },
        "headers": headers,
        "body": body,
        "timeoutSecs": timeout_secs.clamp(5, 180),
    });
    let payload_json = serde_json::to_string(&req_payload)
        .map_err(|e| format!("Failed to encode HTTP proxy payload: {}", e))?;

    tauri::async_runtime::spawn_blocking(move || {
        let ps_script = r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
} catch {}

$rawIn = $env:LUMINESS_HTTP_REQ
if (-not $rawIn) { throw 'Missing request payload' }
$req = $rawIn | ConvertFrom-Json

$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds([int]$req.timeoutSecs)

try {
    $methodObj = New-Object System.Net.Http.HttpMethod([string]$req.method)
    $msg = New-Object System.Net.Http.HttpRequestMessage($methodObj, [string]$req.url)
    $hasAccept = $false
    $contentType = 'application/json'

    if ($req.headers) {
        foreach ($prop in $req.headers.PSObject.Properties) {
            $k = [string]$prop.Name
            $v = [string]$prop.Value
            if (-not $k) { continue }
            if ($k -ieq 'Content-Type') {
                $contentType = $v
            } elseif ($k -ieq 'Accept') {
                $hasAccept = $true
                $null = $msg.Headers.TryAddWithoutValidation($k, $v)
            } else {
                $null = $msg.Headers.TryAddWithoutValidation($k, $v)
            }
        }
    }
    if (-not $hasAccept) {
        $null = $msg.Headers.TryAddWithoutValidation('Accept', 'application/json, text/plain, */*')
    }
    $null = $msg.Headers.TryAddWithoutValidation('User-Agent', 'LuminessAssist/1.2')

    if ($null -ne $req.body -and [string]$req.method -notin @('GET', 'HEAD')) {
        $mediaType = ($contentType -split ';')[0].Trim()
        if (-not $mediaType) { $mediaType = 'application/json' }
        $msg.Content = New-Object System.Net.Http.StringContent([string]$req.body, [System.Text.Encoding]::UTF8, $mediaType)
    }

    $resp = $client.SendAsync($msg).GetAwaiter().GetResult()
    $statusCode = [int]$resp.StatusCode
    $statusText = [string]$resp.ReasonPhrase
    $respBody = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    ConvertTo-Json -InputObject @{
        ok = ($statusCode -ge 200 -and $statusCode -lt 300)
        status = $statusCode
        status_text = $statusText
        body = [string]$respBody
    } -Compress
} finally {
    $client.Dispose()
}
"#;

        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
        cmd.env("LUMINESS_HTTP_REQ", payload_json);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to launch HTTP proxy: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stdout.is_empty() {
            if let Ok(parsed) = serde_json::from_str::<HttpProxyResponse>(&stdout) {
                return Ok(parsed);
            }
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if !stderr.is_empty() {
            format!("HTTP request failed: {}", stderr)
        } else {
            "HTTP proxy returned empty output.".to_string()
        })
    })
    .await
    .map_err(|e| format!("HTTP proxy join error: {}", e))?
}

#[tauri::command]
pub async fn http_proxy_request(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<HttpProxyResponse, String> {
    execute_http_proxy(
        url,
        method.unwrap_or_else(|| "GET".to_string()),
        headers.unwrap_or_default(),
        body,
        timeout_secs.unwrap_or(60),
    )
    .await
}

fn parse_github_slug(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    let cleaned = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("github.com/")
        .trim_start_matches("raw.githubusercontent.com/")
        .trim_end_matches(".git")
        .trim_matches('/');

    let mut parts = cleaned.split('/');
    let owner = parts.next()?.trim();
    let repo = parts.next()?.trim().trim_end_matches(".git");

    let valid_part = |s: &str| {
        !s.is_empty()
            && !s.contains("..")
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    };

    if valid_part(owner) && valid_part(repo) {
        Some(format!("{}/{}", owner, repo))
    } else {
        None
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitHubForkManifestResult {
    pub ok: bool,
    pub slug: String,
    pub branch: String,
    pub raw_url: String,
    pub manifest: serde_json::Value,
    pub repo_meta: serde_json::Value,
}

#[tauri::command]
pub async fn fetch_github_fork_manifest(
    repo_or_url: String,
    branch: Option<String>,
) -> Result<GitHubForkManifestResult, String> {
    let slug = parse_github_slug(&repo_or_url).ok_or_else(|| {
        "Invalid GitHub repository format. Use owner/repo or https://github.com/owner/repo.".to_string()
    })?;
    let branch_name = branch
        .unwrap_or_else(|| "main".to_string())
        .trim()
        .to_string();
    let active_branch = if branch_name.is_empty() {
        "main".to_string()
    } else {
        branch_name
    };

    let raw_url = format!(
        "https://raw.githubusercontent.com/{}/{}/luminess.bot.json?t={}",
        slug,
        active_branch,
        now_unix_ms()
    );

    let raw_resp = execute_http_proxy(raw_url.clone(), "GET".to_string(), HashMap::new(), None, 20).await?;
    if !raw_resp.ok {
        return Err(format!(
            "Could not load luminess.bot.json from {} (branch '{}', HTTP {}). Make sure the fork contains luminess.bot.json.",
            slug, active_branch, raw_resp.status
        ));
    }

    let manifest: serde_json::Value = serde_json::from_str(&raw_resp.body)
        .map_err(|e| format!("Fork luminess.bot.json is invalid JSON: {}", e))?;

    let mut repo_meta = serde_json::json!({});
    let api_url = format!("https://api.github.com/repos/{}", slug);
    if let Ok(meta_resp) =
        execute_http_proxy(api_url, "GET".to_string(), HashMap::new(), None, 15).await
    {
        if meta_resp.ok {
            if let Ok(parsed_meta) = serde_json::from_str::<serde_json::Value>(&meta_resp.body) {
                repo_meta = parsed_meta;
            }
        }
    }

    Ok(GitHubForkManifestResult {
        ok: true,
        slug,
        branch: active_branch,
        raw_url,
        manifest,
        repo_meta,
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalMusicTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub file_path: String,
    pub ext: String,
    pub size_bytes: u64,
    pub stream_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScanLocalMusicResult {
    pub ok: bool,
    pub folder: String,
    pub tracks: Vec<LocalMusicTrack>,
}

struct MediaServerState {
    port: u16,
    token: String,
    tracks: Arc<Mutex<HashMap<String, PathBuf>>>,
    path_to_key: Arc<Mutex<HashMap<String, String>>>,
    seq: Arc<Mutex<u64>>,
}

static MEDIA_SERVER: OnceLock<Result<MediaServerState, String>> = OnceLock::new();

fn audio_mime_for_ext(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "mp3" => Some("audio/mpeg"),
        "wav" => Some("audio/wav"),
        "ogg" => Some("audio/ogg"),
        "flac" => Some("audio/flac"),
        "m4a" | "mp4" => Some("audio/mp4"),
        "aac" => Some("audio/aac"),
        "webm" => Some("audio/webm"),
        "opus" => Some("audio/opus"),
        _ => None,
    }
}

fn parse_byte_range(range_header: &str, file_len: u64) -> Option<(u64, u64)> {
    let trimmed = range_header.trim();
    let spec = trimmed.strip_prefix("bytes=")?.split(',').next()?.trim();
    let (start_str, end_str) = spec.split_once('-')?;

    if start_str.is_empty() {
        let suffix_len: u64 = end_str.trim().parse().ok()?;
        if suffix_len == 0 || file_len == 0 {
            return None;
        }
        let start = file_len.saturating_sub(suffix_len);
        return Some((start, file_len - 1));
    }

    let start: u64 = start_str.trim().parse().ok()?;
    if start >= file_len {
        return None;
    }

    let end = if end_str.trim().is_empty() {
        file_len - 1
    } else {
        let parsed_end: u64 = end_str.trim().parse().ok()?;
        parsed_end.min(file_len - 1)
    };

    if end < start {
        return None;
    }

    Some((start, end))
}

fn write_http_error(stream: &mut TcpStream, status: &str, message: &str) {
    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{}",
        status,
        message.len(),
        message
    );
    let _ = stream.write_all(response.as_bytes());
}

fn handle_media_http(
    mut stream: TcpStream,
    tracks: &Arc<Mutex<HashMap<String, PathBuf>>>,
    session_token: &str,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut header_buf = Vec::with_capacity(2048);
    let mut chunk = [0u8; 1024];

    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                header_buf.extend_from_slice(&chunk[..n]);
                if header_buf.windows(4).any(|w| w == b"\r\n\r\n") || header_buf.len() >= 16384 {
                    break;
                }
            }
            Err(_) => return,
        }
    }

    let header_str = String::from_utf8_lossy(&header_buf);
    let mut lines = header_str.lines();
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let raw_target = parts.next().unwrap_or("");

    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(resp.as_bytes());
        return;
    }

    if method != "GET" && method != "HEAD" {
        write_http_error(&mut stream, "405 Method Not Allowed", "Method Not Allowed");
        return;
    }

    let path_only = raw_target.split('?').next().unwrap_or("");
    let segments: Vec<&str> = path_only.trim_start_matches('/').split('/').collect();
    if segments.len() != 3 || segments[0] != "stream" || segments[1] != session_token {
        write_http_error(&mut stream, "403 Forbidden", "Forbidden");
        return;
    }

    let track_key = segments[2]
        .split('.')
        .next()
        .unwrap_or("")
        .to_string();

    let file_path = {
        let guard = match tracks.lock() {
            Ok(g) => g,
            Err(_) => {
                write_http_error(&mut stream, "500 Internal Server Error", "Lock error");
                return;
            }
        };
        guard.get(&track_key).cloned()
    };

    let Some(path) = file_path else {
        write_http_error(&mut stream, "404 Not Found", "Track not found");
        return;
    };

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp3");
    let mime = audio_mime_for_ext(ext).unwrap_or("application/octet-stream");

    let mut file = match fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => {
            write_http_error(&mut stream, "404 Not Found", "Unable to open audio file");
            return;
        }
    };

    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => {
            write_http_error(&mut stream, "500 Internal Server Error", "Metadata error");
            return;
        }
    };

    let mut range_header_val: Option<String> = None;
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("range") {
                range_header_val = Some(value.trim().to_string());
                break;
            }
        }
    }

    let (status_line, start, end, content_range_hdr) = if let Some(rh) = range_header_val {
        if file_len == 0 {
            write_http_error(&mut stream, "416 Range Not Satisfiable", "Empty audio file");
            return;
        }
        match parse_byte_range(&rh, file_len) {
            Some((s, e)) => (
                "HTTP/1.1 206 Partial Content",
                s,
                e,
                format!("Content-Range: bytes {}-{}/{}\r\n", s, e, file_len),
            ),
            None => {
                let resp = format!(
                    "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                    file_len
                );
                let _ = stream.write_all(resp.as_bytes());
                return;
            }
        }
    } else if file_len == 0 {
        (
            "HTTP/1.1 200 OK",
            0,
            0,
            String::new(),
        )
    } else {
        (
            "HTTP/1.1 200 OK",
            0,
            file_len - 1,
            String::new(),
        )
    };

    let content_len = if file_len == 0 { 0 } else { end - start + 1 };
    let headers = format!(
        "{}\r\nContent-Type: {}\r\nContent-Length: {}\r\n{}Accept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        status_line, mime, content_len, content_range_hdr
    );
    if stream.write_all(headers.as_bytes()).is_err() {
        return;
    }

    if method == "HEAD" || content_len == 0 {
        return;
    }

    if file.seek(SeekFrom::Start(start)).is_err() {
        return;
    }

    let mut remaining = content_len;
    let mut buf = [0u8; 65536];
    while remaining > 0 {
        let to_read = (remaining as usize).min(buf.len());
        match file.read(&mut buf[..to_read]) {
            Ok(0) => break,
            Ok(n) => {
                if stream.write_all(&buf[..n]).is_err() {
                    break;
                }
                remaining -= n as u64;
            }
            Err(_) => break,
        }
    }
}

fn ensure_media_server() -> Result<&'static MediaServerState, String> {
    let res = MEDIA_SERVER.get_or_init(|| {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to start local audio streaming server: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to read audio server address: {}", e))?
            .port();
        let token = format!("lm{}", now_unix_ms());
        let tracks = Arc::new(Mutex::new(HashMap::new()));
        let path_to_key = Arc::new(Mutex::new(HashMap::new()));
        let seq = Arc::new(Mutex::new(0u64));

        let tracks_bg = Arc::clone(&tracks);
        let token_bg = token.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let tracks_req = Arc::clone(&tracks_bg);
                let token_req = token_bg.clone();
                thread::spawn(move || handle_media_http(stream, &tracks_req, &token_req));
            }
        });

        Ok(MediaServerState {
            port,
            token,
            tracks,
            path_to_key,
            seq,
        })
    });

    match res {
        Ok(state) => Ok(state),
        Err(err) => Err(err.clone()),
    }
}

fn register_media_file(path: &Path) -> Result<(String, String), String> {
    if !path.is_file() {
        return Err(format!("Audio file does not exist: {}", path.display()));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if audio_mime_for_ext(&ext).is_none() {
        return Err(format!("Unsupported audio extension: .{}", ext));
    }

    let state = ensure_media_server()?;
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let path_str = canonical.to_string_lossy().to_string();

    let key = {
        let mut path_map = state
            .path_to_key
            .lock()
            .map_err(|_| "Media index lock poisoned".to_string())?;
        if let Some(existing) = path_map.get(&path_str) {
            existing.clone()
        } else {
            let mut seq = state
                .seq
                .lock()
                .map_err(|_| "Media sequence lock poisoned".to_string())?;
            *seq += 1;
            let new_key = format!("t{}", *seq);
            path_map.insert(path_str, new_key.clone());
            let mut tracks = state
                .tracks
                .lock()
                .map_err(|_| "Media tracks lock poisoned".to_string())?;
            tracks.insert(new_key.clone(), canonical);
            new_key
        }
    };

    let url = format!(
        "http://127.0.0.1:{}/stream/{}/{}.{}",
        state.port, state.token, key, ext
    );
    Ok((key, url))
}

fn default_music_folder() -> PathBuf {
    let home = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("Music")
}

fn collect_audio_files(dir: &Path, depth: u8, out: &mut Vec<PathBuf>) {
    if depth > 4 || out.len() >= 250 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if out.len() >= 250 {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_audio_files(&path, depth + 1, out);
        } else if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            if audio_mime_for_ext(ext).is_some() {
                out.push(path);
            }
        }
    }
}

#[tauri::command]
pub fn get_media_stream_url(file_path: String) -> Result<String, String> {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return Err("Missing audio file path.".to_string());
    }
    let (_, url) = register_media_file(Path::new(trimmed))?;
    Ok(url)
}

#[tauri::command]
pub fn scan_local_music(directory: Option<String>) -> Result<ScanLocalMusicResult, String> {
    let target = directory
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(default_music_folder);

    if !target.exists() {
        return Ok(ScanLocalMusicResult {
            ok: true,
            folder: target.to_string_lossy().to_string(),
            tracks: Vec::new(),
        });
    }

    let mut files = Vec::new();
    collect_audio_files(&target, 0, &mut files);
    files.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    let mut tracks = Vec::with_capacity(files.len());
    for file_path in files {
        let Ok((key, stream_url)) = register_media_file(&file_path) else {
            continue;
        };
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_else(|| "mp3".to_string());
        let stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled Track")
            .trim()
            .to_string();
        let (artist, title) = if let Some((left, right)) = stem.split_once(" - ") {
            (left.trim().to_string(), right.trim().to_string())
        } else {
            ("Local Music".to_string(), stem)
        };
        let size_bytes = fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);
        let fp_str = file_path.to_string_lossy().to_string();

        tracks.push(LocalMusicTrack {
            id: format!("local:{}", key),
            title,
            artist,
            file_path: fp_str,
            ext,
            size_bytes,
            stream_url,
        });
    }

    Ok(ScanLocalMusicResult {
        ok: true,
        folder: target.to_string_lossy().to_string(),
        tracks,
    })
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalCliStatusEntry {
    pub installed: bool,
    pub command: String,
    pub resolved_path: String,
    pub notes: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalCliAgentsStatus {
    pub opencode: LocalCliStatusEntry,
    pub kilocode: LocalCliStatusEntry,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalCliRunResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub exit_code: i32,
    pub elapsed_ms: u64,
}

fn find_npm_global_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(appdata) = env::var("APPDATA") {
        dirs.push(Path::new(&appdata).join("npm"));
    }
    if let Ok(local) = env::var("LOCALAPPDATA") {
        dirs.push(Path::new(&local).join("Programs").join("nodejs"));
    }
    if let Ok(pf) = env::var("ProgramFiles") {
        dirs.push(Path::new(&pf).join("nodejs"));
    }
    if let Ok(path_env) = env::var("PATH") {
        for part in env::split_paths(&path_env) {
            if !part.as_os_str().is_empty() && !dirs.iter().any(|d| d == &part) {
                dirs.push(part);
            }
        }
    }
    dirs
}

fn resolve_opencode_binary() -> Option<PathBuf> {
    if let Ok(appdata) = env::var("APPDATA") {
        let direct_exe = Path::new(&appdata)
            .join("npm")
            .join("node_modules")
            .join("opencode-ai")
            .join("bin")
            .join("opencode.exe");
        if direct_exe.is_file() {
            return Some(direct_exe);
        }
    }
    for dir in find_npm_global_dirs() {
        for name in ["opencode.exe", "opencode.cmd", "opencode"] {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn resolve_kilocode_binary() -> Option<(PathBuf, bool)> {
    if let Ok(appdata) = env::var("APPDATA") {
        let js_bin = Path::new(&appdata)
            .join("npm")
            .join("node_modules")
            .join("@kilocode")
            .join("cli")
            .join("bin")
            .join("kilo");
        if js_bin.is_file() {
            return Some((js_bin, true));
        }
    }
    for dir in find_npm_global_dirs() {
        for name in ["kilocode.exe", "kilo.exe", "kilocode.cmd", "kilo.cmd", "kilocode", "kilo"] {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some((candidate, false));
            }
        }
    }
    None
}

fn resolve_custom_cli_binary(bin_name: &str) -> Option<PathBuf> {
    let trimmed = bin_name.trim();
    if trimmed.is_empty() {
        return None;
    }
    let direct = Path::new(trimmed);
    if direct.is_file() {
        return Some(direct.to_path_buf());
    }
    for dir in find_npm_global_dirs() {
        for candidate_name in [
            trimmed.to_string(),
            format!("{}.exe", trimmed),
            format!("{}.cmd", trimmed),
        ] {
            let cand = dir.join(candidate_name);
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    None
}

fn strip_ansi_codes(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if let Some(&next) = chars.peek() {
                if next == '[' {
                    chars.next();
                    while let Some(nc) = chars.next() {
                        if ('@'..='~').contains(&nc) {
                            break;
                        }
                    }
                    continue;
                }
            }
        }
        out.push(c);
    }
    out
}

#[tauri::command]
pub fn check_local_cli_agents() -> LocalCliAgentsStatus {
    let opencode = match resolve_opencode_binary() {
        Some(path) => LocalCliStatusEntry {
            installed: true,
            command: "opencode".to_string(),
            resolved_path: path.to_string_lossy().to_string(),
            notes: "OpenCode CLI native binary detected (fast direct execution ready).".to_string(),
        },
        None => LocalCliStatusEntry {
            installed: false,
            command: "opencode".to_string(),
            resolved_path: String::new(),
            notes: "OpenCode CLI not detected on PATH. Install with: npm install -g opencode-ai".to_string(),
        },
    };

    let kilocode = match resolve_kilocode_binary() {
        Some((path, _)) => LocalCliStatusEntry {
            installed: true,
            command: "kilocode".to_string(),
            resolved_path: path.to_string_lossy().to_string(),
            notes: "KiloCode CLI detected and ready for local autonomous tasks.".to_string(),
        },
        None => LocalCliStatusEntry {
            installed: false,
            command: "kilocode".to_string(),
            resolved_path: String::new(),
            notes: "KiloCode CLI not detected on PATH. Install with: npm install -g @kilocode/cli".to_string(),
        },
    };

    LocalCliAgentsStatus { opencode, kilocode }
}

#[tauri::command]
pub async fn run_local_cli_agent(
    agent: String,
    prompt: String,
    model: Option<String>,
    cwd: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<LocalCliRunResult, String> {
    let started_ms = now_unix_ms();
    let result = tauri::async_runtime::spawn_blocking(move || {
        use std::process::Stdio;
        let clean_agent = agent.trim().to_ascii_lowercase();
        let is_kilo = clean_agent == "kilocode" || clean_agent == "kilo";

        let work_dir = cwd
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .filter(|p| p.is_dir())
            .unwrap_or_else(|| {
                let scratch = get_app_data_dir().join("agent-workspace");
                let _ = fs::create_dir_all(&scratch);
                scratch
            });

        let clean_model = model
            .map(|m| m.trim().to_string())
            .filter(|m| {
                !m.is_empty()
                    && !matches!(
                        m.as_str(),
                        "opencode-default" | "kilocode-default" | "luminess-local-v2"
                    )
            });

        let mut cmd = if clean_agent == "opencode" {
            let Some(bin_path) = resolve_opencode_binary() else {
                return LocalCliRunResult {
                    success: false,
                    output: String::new(),
                    error: Some("OpenCode CLI not found on PATH.".to_string()),
                    exit_code: -1,
                    elapsed_ms: now_unix_ms().saturating_sub(started_ms),
                };
            };
            let is_cmd = bin_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
                .unwrap_or(false);
            let mut c = if is_cmd && cfg!(target_os = "windows") {
                let mut w = Command::new("cmd");
                w.arg("/C").arg(&bin_path);
                w
            } else {
                Command::new(&bin_path)
            };
            // Use --pure + direct directory so OpenCode skips heavy plugin & temp folder scans
            c.arg("run").arg("--pure").arg("--dir").arg(&work_dir);
            if let Some(m) = &clean_model {
                c.arg("--model").arg(m);
            }
            c.arg(&prompt);
            c
        } else if is_kilo {
            let Some((bin_path, _is_node_script)) = resolve_kilocode_binary() else {
                return LocalCliRunResult {
                    success: false,
                    output: String::new(),
                    error: Some("KiloCode CLI not found on PATH.".to_string()),
                    exit_code: -1,
                    elapsed_ms: now_unix_ms().saturating_sub(started_ms),
                };
            };
            let is_cmd_or_script = bin_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
                .unwrap_or(false)
                || bin_path.extension().is_none();

            let mut c = if bin_path.extension().is_none() {
                let node_path = find_npm_global_dirs()
                    .into_iter()
                    .map(|d| d.join("node.exe"))
                    .find(|p| p.is_file())
                    .unwrap_or_else(|| PathBuf::from("node"));
                let mut n = Command::new(node_path);
                n.arg(&bin_path);
                n
            } else if is_cmd_or_script && cfg!(target_os = "windows") {
                let mut w = Command::new("cmd");
                w.arg("/C").arg(&bin_path);
                w
            } else {
                Command::new(&bin_path)
            };
            c.arg("run");
            if let Some(m) = &clean_model {
                c.arg("--model").arg(m);
            }
            c.arg(&prompt);
            c
        } else {
            let Some(bin_path) = resolve_custom_cli_binary(&clean_agent) else {
                return LocalCliRunResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("CLI agent '{}' not found on PATH.", agent)),
                    exit_code: -1,
                    elapsed_ms: now_unix_ms().saturating_sub(started_ms),
                };
            };
            let is_cmd = bin_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"))
                .unwrap_or(false);
            let mut c = if is_cmd && cfg!(target_os = "windows") {
                let mut w = Command::new("cmd");
                w.arg("/C").arg(&bin_path);
                w
            } else {
                Command::new(&bin_path)
            };
            c.arg("run").arg("--auto");
            if let Some(m) = &clean_model {
                c.arg("--model").arg(m);
            }
            c.arg(&prompt);
            c
        };

        cmd.current_dir(&work_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("NO_COLOR", "1")
            .env("TERM", "dumb");

        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = match cmd.spawn() {
            Ok(ch) => ch,
            Err(e) => {
                return LocalCliRunResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to launch {}: {}", agent, e)),
                    exit_code: -1,
                    elapsed_ms: now_unix_ms().saturating_sub(started_ms),
                };
            }
        };

        let stdout_pipe = child.stdout.take();
        let stderr_pipe = child.stderr.take();

        let out_handle = thread::spawn(move || {
            let mut buf = String::new();
            if let Some(mut r) = stdout_pipe {
                let _ = r.read_to_string(&mut buf);
            }
            buf
        });
        let err_handle = thread::spawn(move || {
            let mut buf = String::new();
            if let Some(mut r) = stderr_pipe {
                let _ = r.read_to_string(&mut buf);
            }
            buf
        });

        let max_wait = Duration::from_secs(timeout_secs.unwrap_or(28).clamp(5, 90));
        let start_inst = std::time::Instant::now();
        let mut timed_out = false;
        let mut exit_code: i32 = -1;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    exit_code = status.code().unwrap_or(-1);
                    break;
                }
                Ok(None) => {
                    if start_inst.elapsed() >= max_wait {
                        timed_out = true;
                        let pid = child.id();
                        let _ = child.kill();
                        #[cfg(target_os = "windows")]
                        {
                            let mut tk = Command::new("taskkill");
                            tk.args(["/F", "/T", "/PID", &pid.to_string()]);
                            tk.creation_flags(CREATE_NO_WINDOW);
                            let _ = tk.output();
                        }
                        let _ = child.wait();
                        break;
                    }
                    thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }

        let stdout_raw = out_handle.join().unwrap_or_default();
        let stderr_raw = err_handle.join().unwrap_or_default();
        let clean_out = strip_ansi_codes(&stdout_raw).trim().to_string();
        let clean_err = strip_ansi_codes(&stderr_raw).trim().to_string();

        if timed_out && clean_out.is_empty() {
            return LocalCliRunResult {
                success: false,
                output: String::new(),
                error: Some(format!("{} timed out after {}s.", agent, max_wait.as_secs())),
                exit_code: -1,
                elapsed_ms: now_unix_ms().saturating_sub(started_ms),
            };
        }

        let valid_out = !clean_out.is_empty()
            && !clean_out.contains("Unknown flag")
            && !clean_out.contains("is not recognized");

        LocalCliRunResult {
            success: valid_out,
            output: if valid_out { clean_out } else { String::new() },
            error: if valid_out {
                None
            } else if !clean_err.is_empty() {
                Some(clean_err.chars().take(280).collect())
            } else {
                Some(format!("{} produced no response.", agent))
            },
            exit_code,
            elapsed_ms: now_unix_ms().saturating_sub(started_ms),
        }
    })
    .await
    .map_err(|e| format!("CLI task worker failed: {}", e))?;

    Ok(result)
}

