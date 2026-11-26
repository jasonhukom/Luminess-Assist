use crate::services::{get_app_data_dir, now_unix_ms};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

pub const WELLBEING_RETENTION_DAYS: i64 = 90;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ForegroundAppSample {
    pub pid: u32,
    pub exe_name: String,
    pub process_name: String,
    pub window_title: String,
    pub is_idle: bool,
    pub idle_seconds: u64,
    pub sampled_at_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskManagerProcessRow {
    pub pid: u32,
    pub name: String,
    pub exe_name: String,
    pub window_title: String,
    pub category: String,
    pub status: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub threads: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskManagerSnapshot {
    pub captured_at_ms: u64,
    pub total_cpu_percent: f32,
    pub logical_cores: u32,
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub memory_load_percent: u32,
    pub process_count: usize,
    pub app_count: usize,
    pub background_count: usize,
    pub total_threads: u32,
    pub uptime_seconds: u64,
    pub processes: Vec<TaskManagerProcessRow>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct WellbeingAppUsageEntry {
    pub app_key: String,
    pub display_name: String,
    pub category: String,
    pub seconds: u64,
    pub last_title: String,
    pub last_seen_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct WellbeingDayRecord {
    pub date: String,
    pub total_seconds: u64,
    pub apps: HashMap<String, WellbeingAppUsageEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct WellbeingHistoryStore {
    pub version: String,
    pub retention_days: u32,
    pub days: HashMap<String, WellbeingDayRecord>,
    pub updated_at: u64,
}

impl Default for WellbeingHistoryStore {
    fn default() -> Self {
        Self {
            version: "1.0.0".to_string(),
            retention_days: WELLBEING_RETENTION_DAYS as u32,
            days: HashMap::new(),
            updated_at: now_unix_ms(),
        }
    }
}

struct CpuDeltaState {
    prev_sys_idle: u64,
    prev_sys_kernel: u64,
    prev_sys_user: u64,
    prev_proc_ticks: HashMap<u32, u64>,
}

static CPU_DELTA_STATE: OnceLock<Mutex<CpuDeltaState>> = OnceLock::new();

fn cpu_delta_mutex() -> &'static Mutex<CpuDeltaState> {
    CPU_DELTA_STATE.get_or_init(|| {
        Mutex::new(CpuDeltaState {
            prev_sys_idle: 0,
            prev_sys_kernel: 0,
            prev_sys_user: 0,
            prev_proc_ticks: HashMap::new(),
        })
    })
}

/// Converts civil YYYY-MM-DD into days since 1970-01-01 (Howard Hinnant's algorithm).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = y - if m <= 2 { 1 } else { 0 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn parse_date_key_days(date_key: &str) -> Option<i64> {
    let parts: Vec<&str> = date_key.trim().split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let y: i64 = parts[0].parse().ok()?;
    let m: i64 = parts[1].parse().ok()?;
    let d: i64 = parts[2].parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    Some(days_from_civil(y, m, d))
}

fn current_epoch_days() -> i64 {
    #[cfg(target_os = "windows")]
    {
        if let Some(local_days) = win32_monitor::local_date_epoch_days() {
            return local_days;
        }
    }
    (now_unix_ms() / 86_400_000) as i64
}

pub fn prune_wellbeing_history(store: &mut WellbeingHistoryStore, reference_epoch_days: i64) -> bool {
    let cutoff = reference_epoch_days - WELLBEING_RETENTION_DAYS + 1;
    let before = store.days.len();
    store.days.retain(|date_key, _| {
        parse_date_key_days(date_key)
            .map(|d| d >= cutoff)
            .unwrap_or(false)
    });
    store.retention_days = WELLBEING_RETENTION_DAYS as u32;
    store.days.len() != before
}

fn get_wellbeing_file_path() -> PathBuf {
    get_app_data_dir().join("wellbeing_history.json")
}

#[tauri::command]
pub fn load_wellbeing_history() -> WellbeingHistoryStore {
    let path = get_wellbeing_file_path();
    let mut store: WellbeingHistoryStore = fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();

    let changed = prune_wellbeing_history(&mut store, current_epoch_days());
    if changed {
        if let Ok(json) = serde_json::to_string_pretty(&store) {
            let _ = fs::write(&path, json);
        }
    }
    store
}

#[tauri::command]
pub fn save_wellbeing_history(mut history: WellbeingHistoryStore) -> Result<WellbeingHistoryStore, String> {
    prune_wellbeing_history(&mut history, current_epoch_days());
    history.updated_at = now_unix_ms();
    let path = get_wellbeing_file_path();
    let json = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("Failed to serialize wellbeing history: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to save wellbeing history: {}", e))?;
    Ok(history)
}

#[tauri::command]
pub fn clear_wellbeing_history() -> Result<WellbeingHistoryStore, String> {
    let empty = WellbeingHistoryStore::default();
    save_wellbeing_history(empty)
}

#[cfg(target_os = "windows")]
mod win32_monitor {
    use super::*;
    use std::ffi::c_void;
    use std::path::Path;

    pub type HWND = isize;
    pub type BOOL = i32;
    pub type DWORD = u32;
    pub type HANDLE = *mut c_void;

    const TH32CS_SNAPPROCESS: DWORD = 0x00000002;
    const PROCESS_QUERY_LIMITED_INFORMATION: DWORD = 0x1000;
    const IDLE_THRESHOLD_MS: u64 = 5 * 60 * 1000;

    #[repr(C)]
    #[derive(Copy, Clone, Default)]
    pub struct FILETIME {
        pub dw_low_date_time: DWORD,
        pub dw_high_date_time: DWORD,
    }

    impl FILETIME {
        fn as_u64(self) -> u64 {
            ((self.dw_high_date_time as u64) << 32) | (self.dw_low_date_time as u64)
        }
    }

    #[repr(C)]
    pub struct LASTINPUTINFO {
        pub cb_size: u32,
        pub dw_time: DWORD,
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

    #[repr(C)]
    pub struct SYSTEM_INFO {
        pub w_processor_architecture: u16,
        pub w_reserved: u16,
        pub dw_page_size: DWORD,
        pub lp_minimum_application_address: *mut c_void,
        pub lp_maximum_application_address: *mut c_void,
        pub dw_active_processor_mask: usize,
        pub dw_number_of_processors: DWORD,
        pub dw_processor_type: DWORD,
        pub dw_allocation_granularity: DWORD,
        pub w_processor_level: u16,
        pub w_processor_revision: u16,
    }

    #[repr(C)]
    pub struct SYSTEMTIME {
        pub w_year: u16,
        pub w_month: u16,
        pub w_day_of_week: u16,
        pub w_day: u16,
        pub w_hour: u16,
        pub w_minute: u16,
        pub w_second: u16,
        pub w_milliseconds: u16,
    }

    #[repr(C)]
    pub struct PROCESSENTRY32W {
        pub dw_size: DWORD,
        pub cnt_usage: DWORD,
        pub th32_process_id: DWORD,
        pub th32_default_heap_id: usize,
        pub th32_module_id: DWORD,
        pub cnt_threads: DWORD,
        pub th32_parent_process_id: DWORD,
        pub pc_pri_class_base: i32,
        pub dw_flags: DWORD,
        pub sz_exe_file: [u16; 260],
    }

    #[repr(C)]
    #[derive(Default)]
    pub struct PROCESS_MEMORY_COUNTERS {
        pub cb: DWORD,
        pub page_fault_count: DWORD,
        pub peak_working_set_size: usize,
        pub working_set_size: usize,
        pub quota_peak_paged_pool_usage: usize,
        pub quota_paged_pool_usage: usize,
        pub quota_peak_non_paged_pool_usage: usize,
        pub quota_non_paged_pool_usage: usize,
        pub pagefile_usage: usize,
        pub peak_pagefile_usage: usize,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> HWND;
        fn GetWindowThreadProcessId(h_wnd: HWND, lpdw_process_id: *mut DWORD) -> DWORD;
        fn GetWindowTextW(h_wnd: HWND, lp_string: *mut u16, n_max_count: i32) -> i32;
        fn IsWindowVisible(h_wnd: HWND) -> BOOL;
        fn EnumWindows(
            lp_enum_func: unsafe extern "system" fn(HWND, isize) -> BOOL,
            l_param: isize,
        ) -> BOOL;
        fn GetLastInputInfo(plii: *mut LASTINPUTINFO) -> BOOL;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn CreateToolhelp32Snapshot(dw_flags: DWORD, th32_process_id: DWORD) -> HANDLE;
        fn Process32FirstW(h_snapshot: HANDLE, lppe: *mut PROCESSENTRY32W) -> BOOL;
        fn Process32NextW(h_snapshot: HANDLE, lppe: *mut PROCESSENTRY32W) -> BOOL;
        fn OpenProcess(
            dw_desired_access: DWORD,
            b_inherit_handle: BOOL,
            dw_process_id: DWORD,
        ) -> HANDLE;
        fn CloseHandle(h_object: HANDLE) -> BOOL;
        fn QueryFullProcessImageNameW(
            h_process: HANDLE,
            dw_flags: DWORD,
            lp_exe_name: *mut u16,
            lpdw_size: *mut DWORD,
        ) -> BOOL;
        fn GetProcessTimes(
            h_process: HANDLE,
            lp_creation_time: *mut FILETIME,
            lp_exit_time: *mut FILETIME,
            lp_kernel_time: *mut FILETIME,
            lp_user_time: *mut FILETIME,
        ) -> BOOL;
        fn GetSystemTimes(
            lp_idle_time: *mut FILETIME,
            lp_kernel_time: *mut FILETIME,
            lp_user_time: *mut FILETIME,
        ) -> BOOL;
        fn GetTickCount() -> DWORD;
        fn GetTickCount64() -> u64;
        fn GetSystemInfo(lp_system_info: *mut SYSTEM_INFO);
        fn GetLocalTime(lp_system_time: *mut SYSTEMTIME);
        fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> BOOL;
        fn K32GetProcessMemoryInfo(
            process: HANDLE,
            ppsmem_counters: *mut PROCESS_MEMORY_COUNTERS,
            cb: DWORD,
        ) -> BOOL;
    }

    pub fn local_date_epoch_days() -> Option<i64> {
        let mut st = SYSTEMTIME {
            w_year: 0,
            w_month: 0,
            w_day_of_week: 0,
            w_day: 0,
            w_hour: 0,
            w_minute: 0,
            w_second: 0,
            w_milliseconds: 0,
        };
        unsafe { GetLocalTime(&mut st) };
        if st.w_year == 0 {
            return None;
        }
        Some(days_from_civil(st.w_year as i64, st.w_month as i64, st.w_day as i64))
    }

    fn decode_wide_z(buf: &[u16]) -> String {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..end])
    }

    fn read_window_title(hwnd: HWND) -> String {
        if hwnd == 0 {
            return String::new();
        }
        let mut buf = [0u16; 256];
        let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if len <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..len as usize]).trim().to_string()
    }

    fn query_exe_name_for_pid(pid: u32) -> Option<String> {
        if pid == 0 {
            return None;
        }
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; 512];
        let mut size = buf.len() as DWORD;
        let ok = unsafe { QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size) };
        unsafe { CloseHandle(handle) };
        if ok == 0 || size == 0 {
            return None;
        }
        let full = String::from_utf16_lossy(&buf[..size as usize]);
        Path::new(&full)
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    }

    fn get_idle_ms() -> u64 {
        let mut lii = LASTINPUTINFO {
            cb_size: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dw_time: 0,
        };
        let ok = unsafe { GetLastInputInfo(&mut lii) };
        if ok == 0 {
            return 0;
        }
        let now_tick = unsafe { GetTickCount() };
        now_tick.wrapping_sub(lii.dw_time) as u64
    }

    pub fn sample_foreground_app() -> ForegroundAppSample {
        let now_ms = now_unix_ms();
        let idle_ms = get_idle_ms();
        let hwnd = unsafe { GetForegroundWindow() };
        let mut pid: DWORD = 0;
        if hwnd != 0 {
            unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        }
        let window_title = read_window_title(hwnd);
        let exe_name = query_exe_name_for_pid(pid).unwrap_or_else(|| {
            if pid == 0 {
                "Idle.exe".to_string()
            } else {
                format!("process-{}.exe", pid)
            }
        });
        let process_name = Path::new(&exe_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&exe_name)
            .to_string();

        ForegroundAppSample {
            pid,
            exe_name,
            process_name,
            window_title,
            is_idle: idle_ms >= IDLE_THRESHOLD_MS,
            idle_seconds: idle_ms / 1000,
            sampled_at_ms: now_ms,
        }
    }

    unsafe extern "system" fn enum_window_cb(hwnd: HWND, l_param: isize) -> BOOL {
        if unsafe { IsWindowVisible(hwnd) } == 0 {
            return 1;
        }
        let title = read_window_title(hwnd);
        if title.is_empty() {
            return 1;
        }
        let mut pid: DWORD = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            return 1;
        }
        let map = unsafe { &mut *(l_param as *mut HashMap<u32, String>) };
        map.entry(pid).or_insert(title);
        1
    }

    fn collect_visible_window_titles() -> HashMap<u32, String> {
        let mut map: HashMap<u32, String> = HashMap::new();
        let ptr = &mut map as *mut HashMap<u32, String> as isize;
        unsafe { EnumWindows(enum_window_cb, ptr) };
        map
    }

    pub fn capture_task_manager_snapshot() -> TaskManagerSnapshot {
        let captured_at_ms = now_unix_ms();

        // System memory + CPU cores + uptime
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
        unsafe { GlobalMemoryStatusEx(&mut mem) };

        let mut sys_info = SYSTEM_INFO {
            w_processor_architecture: 0,
            w_reserved: 0,
            dw_page_size: 0,
            lp_minimum_application_address: std::ptr::null_mut(),
            lp_maximum_application_address: std::ptr::null_mut(),
            dw_active_processor_mask: 0,
            dw_number_of_processors: 1,
            dw_processor_type: 0,
            dw_allocation_granularity: 0,
            w_processor_level: 0,
            w_processor_revision: 0,
        };
        unsafe { GetSystemInfo(&mut sys_info) };
        let logical_cores = sys_info.dw_number_of_processors.max(1);
        let uptime_seconds = unsafe { GetTickCount64() } / 1000;

        // System CPU times
        let (mut ft_idle, mut ft_kernel, mut ft_user) =
            (FILETIME::default(), FILETIME::default(), FILETIME::default());
        let sys_ok = unsafe { GetSystemTimes(&mut ft_idle, &mut ft_kernel, &mut ft_user) } != 0;
        let sys_idle = ft_idle.as_u64();
        let sys_kernel = ft_kernel.as_u64();
        let sys_user = ft_user.as_u64();

        // Foreground window PID + visible window titles
        let fg_hwnd = unsafe { GetForegroundWindow() };
        let mut fg_pid: DWORD = 0;
        if fg_hwnd != 0 {
            unsafe { GetWindowThreadProcessId(fg_hwnd, &mut fg_pid) };
        }
        let window_titles = collect_visible_window_titles();

        // Enumerate processes via Toolhelp32
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
        let mut raw_rows: Vec<(u32, String, String, u32, u64, Option<u64>)> = Vec::new();
        let mut total_threads: u32 = 0;

        if snapshot != (-1isize as HANDLE) && !snapshot.is_null() {
            let mut pe = PROCESSENTRY32W {
                dw_size: std::mem::size_of::<PROCESSENTRY32W>() as DWORD,
                cnt_usage: 0,
                th32_process_id: 0,
                th32_default_heap_id: 0,
                th32_module_id: 0,
                cnt_threads: 0,
                th32_parent_process_id: 0,
                pc_pri_class_base: 0,
                dw_flags: 0,
                sz_exe_file: [0u16; 260],
            };

            if unsafe { Process32FirstW(snapshot, &mut pe) } != 0 {
                loop {
                    let pid = pe.th32_process_id;
                    if pid != 0 {
                        let exe_name = decode_wide_z(&pe.sz_exe_file);
                        let friendly_name = Path::new(&exe_name)
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or(&exe_name)
                            .to_string();

                        let mut working_set: u64 = 0;
                        let mut proc_ticks: Option<u64> = None;

                        let h_proc = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
                        if !h_proc.is_null() {
                            let mut counters = PROCESS_MEMORY_COUNTERS {
                                cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as DWORD,
                                ..Default::default()
                            };
                            if unsafe {
                                K32GetProcessMemoryInfo(
                                    h_proc,
                                    &mut counters,
                                    std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as DWORD,
                                )
                            } != 0
                            {
                                working_set = counters.working_set_size as u64;
                            }

                            let (mut c, mut e, mut k, mut u) = (
                                FILETIME::default(),
                                FILETIME::default(),
                                FILETIME::default(),
                                FILETIME::default(),
                            );
                            if unsafe { GetProcessTimes(h_proc, &mut c, &mut e, &mut k, &mut u) } != 0 {
                                proc_ticks = Some(k.as_u64() + u.as_u64());
                            }
                            unsafe { CloseHandle(h_proc) };
                        }

                        total_threads = total_threads.saturating_add(pe.cnt_threads);
                        raw_rows.push((
                            pid,
                            friendly_name,
                            exe_name,
                            pe.cnt_threads,
                            working_set,
                            proc_ticks,
                        ));
                    }
                    if unsafe { Process32NextW(snapshot, &mut pe) } == 0 {
                        break;
                    }
                }
            }
            unsafe { CloseHandle(snapshot) };
        }

        // Compute CPU % deltas cleanly against last snapshot
        let (total_cpu_percent, proc_cpu_map) = {
            let mut state = cpu_delta_mutex().lock().unwrap_or_else(|p| p.into_inner());
            let total_sys_delta = if sys_ok && (state.prev_sys_kernel > 0 || state.prev_sys_user > 0) {
                let d_k = sys_kernel.saturating_sub(state.prev_sys_kernel);
                let d_u = sys_user.saturating_sub(state.prev_sys_user);
                d_k.saturating_add(d_u)
            } else {
                0
            };
            let idle_delta = if sys_ok && state.prev_sys_idle > 0 {
                sys_idle.saturating_sub(state.prev_sys_idle)
            } else {
                0
            };

            let sys_pct = if total_sys_delta > 0 {
                let busy = total_sys_delta.saturating_sub(idle_delta);
                ((busy as f64 / total_sys_delta as f64) * 100.0).clamp(0.0, 100.0) as f32
            } else {
                0.0
            };

            let mut cpu_by_pid: HashMap<u32, f32> = HashMap::with_capacity(raw_rows.len());
            let mut next_ticks: HashMap<u32, u64> = HashMap::with_capacity(raw_rows.len());

            for (pid, _, _, _, _, ticks_opt) in &raw_rows {
                if let Some(ticks) = ticks_opt {
                    next_ticks.insert(*pid, *ticks);
                    if total_sys_delta > 0 {
                        if let Some(&prev) = state.prev_proc_ticks.get(pid) {
                            let d_proc = ticks.saturating_sub(prev);
                            let pct = ((d_proc as f64 / total_sys_delta as f64) * 100.0)
                                .clamp(0.0, 100.0) as f32;
                            cpu_by_pid.insert(*pid, pct);
                        }
                    }
                }
            }

            if sys_ok {
                state.prev_sys_idle = sys_idle;
                state.prev_sys_kernel = sys_kernel;
                state.prev_sys_user = sys_user;
            }
            state.prev_proc_ticks = next_ticks;

            (sys_pct, cpu_by_pid)
        };

        let mut app_count = 0usize;
        let mut background_count = 0usize;

        let mut processes: Vec<TaskManagerProcessRow> = raw_rows
            .into_iter()
            .map(|(pid, name, exe_name, threads, memory_bytes, _)| {
                let title = window_titles.get(&pid).cloned().unwrap_or_default();
                let is_app = !title.is_empty();
                if is_app {
                    app_count += 1;
                } else {
                    background_count += 1;
                }
                let cpu_percent = (proc_cpu_map.get(&pid).copied().unwrap_or(0.0) * 10.0).round() / 10.0;
                let status = if pid == fg_pid {
                    "Foreground".to_string()
                } else if is_app {
                    "Active".to_string()
                } else {
                    "Background".to_string()
                };

                TaskManagerProcessRow {
                    pid,
                    name,
                    exe_name,
                    window_title: title,
                    category: if is_app {
                        "app".to_string()
                    } else {
                        "background".to_string()
                    },
                    status,
                    cpu_percent,
                    memory_bytes,
                    threads,
                }
            })
            .collect();

        processes.sort_by(|a, b| {
            b.cpu_percent
                .partial_cmp(&a.cpu_percent)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.memory_bytes.cmp(&a.memory_bytes))
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        let used_memory_bytes = mem.ull_total_phys.saturating_sub(mem.ull_avail_phys);
        let process_count = processes.len();

        TaskManagerSnapshot {
            captured_at_ms,
            total_cpu_percent: (total_cpu_percent * 10.0).round() / 10.0,
            logical_cores,
            total_memory_bytes: mem.ull_total_phys,
            used_memory_bytes,
            memory_load_percent: mem.dw_memory_load,
            process_count,
            app_count,
            background_count,
            total_threads,
            uptime_seconds,
            processes,
        }
    }
}

#[tauri::command]
pub fn get_foreground_app_usage_sample() -> ForegroundAppSample {
    #[cfg(target_os = "windows")]
    {
        return win32_monitor::sample_foreground_app();
    }
    #[cfg(not(target_os = "windows"))]
    {
        ForegroundAppSample {
            pid: 0,
            exe_name: "luminess.exe".to_string(),
            process_name: "Luminess".to_string(),
            window_title: "Desktop Companion".to_string(),
            is_idle: false,
            idle_seconds: 0,
            sampled_at_ms: now_unix_ms(),
        }
    }
}

#[tauri::command]
pub fn get_task_manager_snapshot() -> TaskManagerSnapshot {
    #[cfg(target_os = "windows")]
    {
        return win32_monitor::capture_task_manager_snapshot();
    }
    #[cfg(not(target_os = "windows"))]
    {
        TaskManagerSnapshot {
            captured_at_ms: now_unix_ms(),
            total_cpu_percent: 0.0,
            logical_cores: 1,
            total_memory_bytes: 0,
            used_memory_bytes: 0,
            memory_load_percent: 0,
            process_count: 0,
            app_count: 0,
            background_count: 0,
            total_threads: 0,
            uptime_seconds: 0,
            processes: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prunes_records_older_than_90_days() {
        let mut store = WellbeingHistoryStore::default();
        // 2026-11-26 is day epoch 20783
        let today_days = days_from_civil(2026, 11, 26);
        // 89 days ago -> keep (within 90 days window inclusive)
        store.days.insert(
            "2026-08-29".to_string(),
            WellbeingDayRecord {
                date: "2026-08-29".to_string(),
                total_seconds: 120,
                apps: HashMap::new(),
            },
        );
        // 95 days ago -> prune
        store.days.insert(
            "2026-08-23".to_string(),
            WellbeingDayRecord {
                date: "2026-08-23".to_string(),
                total_seconds: 600,
                apps: HashMap::new(),
            },
        );
        store.days.insert(
            "2026-11-26".to_string(),
            WellbeingDayRecord {
                date: "2026-11-26".to_string(),
                total_seconds: 400,
                apps: HashMap::new(),
            },
        );

        let pruned = prune_wellbeing_history(&mut store, today_days);
        assert!(pruned);
        assert!(!store.days.contains_key("2026-08-23"));
        assert!(store.days.contains_key("2026-08-29"));
        assert!(store.days.contains_key("2026-11-26"));
    }
}
