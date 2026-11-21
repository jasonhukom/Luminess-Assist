use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
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

fn now_unix_ms() -> u64 {
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
pub struct MachineCredentialsVault {
    pub gemini_api_key: String,
    pub claude_api_key: String,
    pub codex_api_key: String,
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
    pub local_ai_runtime: String,
    pub local_ai_endpoint: String,
    pub local_ai_model: String,
    pub storage_tier: String,
    pub storage_limit_bytes: u64,
    pub installation_storage_prompted: bool,
    pub auto_approve_tools: bool,
    pub search_engine_enabled: bool,
    pub memory_sync_enabled: bool,
    pub google_account_email: Option<String>,
    pub floating_positions: serde_json::Value,
    pub updated_at: u64,
}

impl Default for AppConfigJson {
    fn default() -> Self {
        Self {
            version: "1.2.0".to_string(),
            selected_provider: "gemini".to_string(),
            gemini_model: "gemini-2.5-flash".to_string(),
            claude_model: "claude-sonnet-4-20250514".to_string(),
            codex_model: "gpt-4o".to_string(),
            local_ai_runtime: "auto".to_string(),
            local_ai_endpoint: "http://127.0.0.1:11434".to_string(),
            local_ai_model: "qwen2.5-coder:latest".to_string(),
            storage_tier: "recommended".to_string(),
            storage_limit_bytes: 5 * 1024 * 1024 * 1024, // 5 GB Recommended Default
            installation_storage_prompted: false,
            auto_approve_tools: false,
            search_engine_enabled: true,
            memory_sync_enabled: true,
            google_account_email: None,
            floating_positions: serde_json::json!({
                "history": { "x": 64, "y": 80, "width": 360, "height": 470 },
                "settings": { "x": 448, "y": 80, "width": 410, "height": 520 }
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
    let max_safe_disk_allocation = disk_free_bytes
        .saturating_add(used_bytes)
        .saturating_sub(safety_reserve);

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
    let _ = stream.take(512 * 1024).read_to_end(&mut resp_bytes);
    let resp_str = String::from_utf8_lossy(&resp_bytes);
    let body = resp_str.split("\r\n\r\n").nth(1)?;
    let start = body.find('{')?;
    let end = body.rfind('}')?;
    if start > end {
        return None;
    }
    serde_json::from_str(&body[start..=end]).ok()
}

#[tauri::command]
pub async fn probe_local_ai_servers() -> Result<Vec<LocalAiServerInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
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

    // 4. Built-in Local Conversational Engine + OpenCode CLI
    servers.push(LocalAiServerInfo {
        name: "Luminess Native Local AI + OpenCode".to_string(),
        kind: "builtin".to_string(),
        endpoint: "local://luminess-native".to_string(),
        online: true,
        models: vec![
            "luminess-local-v2".to_string(),
            "opencode-local-agent".to_string(),
        ],
        notes: "Always-on local conversational engine with PC tool execution, persistent memory, and web search.".to_string(),
    });

        Ok(servers)
    })
    .await
    .map_err(|e| format!("Failed to probe local AI servers: {}", e))?
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
