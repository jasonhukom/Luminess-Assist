use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
mod win32 {
    use std::ffi::c_void;

    pub type HWND = isize;
    pub type BOOL = i32;
    pub type DWORD = u32;
    pub type LONG = i32;

    pub const GWL_EXSTYLE: i32 = -20;
    pub const WS_EX_TOOLWINDOW: i32 = 0x00000080;
    pub const WS_EX_NOACTIVATE: i32 = 0x08000000;
    pub const DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9;

    #[repr(C)]
    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    #[derive(Clone, Copy, Debug, Default)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        pub fn GetForegroundWindow() -> HWND;
        pub fn GetWindowThreadProcessId(hwnd: HWND, lpdw_process_id: *mut DWORD) -> DWORD;
        pub fn IsWindowVisible(hwnd: HWND) -> BOOL;
        pub fn IsIconic(hwnd: HWND) -> BOOL;
        pub fn IsZoomed(hwnd: HWND) -> BOOL;
        pub fn GetWindowLongW(hwnd: HWND, n_index: i32) -> LONG;
        pub fn GetWindowRect(hwnd: HWND, lp_rect: *mut RECT) -> BOOL;
        pub fn GetClassNameW(hwnd: HWND, lp_class_name: *mut u16, n_max_count: i32) -> i32;
        pub fn GetWindowTextLengthW(hwnd: HWND) -> i32;
        pub fn GetCursorPos(lp_point: *mut POINT) -> BOOL;
    }

    #[link(name = "dwmapi")]
    unsafe extern "system" {
        pub fn DwmGetWindowAttribute(
            hwnd: HWND,
            dw_attribute: DWORD,
            pv_attribute: *mut c_void,
            cb_attribute: DWORD,
        ) -> i32;
    }

    pub fn get_cursor_pos() -> Option<(i32, i32)> {
        let mut pt = POINT::default();
        let ok = unsafe { GetCursorPos(&mut pt) };
        if ok != 0 {
            Some((pt.x, pt.y))
        } else {
            None
        }
    }

    pub struct ActiveAppInfo {
        pub hwnd: HWND,
        pub rect: RECT,
        pub is_maximized: bool,
    }

    pub fn get_active_external_app(self_pid: u32) -> Option<ActiveAppInfo> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == 0 {
                return None;
            }

            let mut pid: DWORD = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 || pid == self_pid {
                return None;
            }

            if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
                return None;
            }

            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
            if (ex_style & WS_EX_TOOLWINDOW) != 0 || (ex_style & WS_EX_NOACTIVATE) != 0 {
                return None;
            }

            let title_len = GetWindowTextLengthW(hwnd);
            if title_len <= 0 {
                return None;
            }

            let mut class_buf = [0u16; 256];
            let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
            if class_len > 0 {
                let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
                let ignored_classes = [
                    "Progman",
                    "WorkerW",
                    "Shell_TrayWnd",
                    "Shell_SecondaryTrayWnd",
                    "NotifyIconOverflowWindow",
                    "Windows.UI.Core.CoreWindow",
                    "XamlExplorerHostIslandWindow",
                    "TopLevelWindowForOverflowXamlIsland",
                    "MultitaskingViewFrame",
                    "TaskListThumbnailWnd",
                    "ForegroundStaging",
                ];
                if ignored_classes.iter().any(|c| class_name.eq_ignore_ascii_case(c)) {
                    return None;
                }
            }

            let mut rect = RECT::default();
            let dwm_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                &mut rect as *mut RECT as *mut c_void,
                std::mem::size_of::<RECT>() as DWORD,
            );
            if dwm_res != 0 {
                if GetWindowRect(hwnd, &mut rect) == 0 {
                    return None;
                }
            }

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            if width < 180 || height < 180 {
                return None;
            }

            let is_maximized = IsZoomed(hwnd) != 0;
            Some(ActiveAppInfo {
                hwnd,
                rect,
                is_maximized,
            })
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InteractiveRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
pub struct CompanionState {
    pub rects: Vec<InteractiveRect>,
    pub force_interactive: bool,
    pub companion_active: bool,
    pub is_ignoring_cursor: Option<bool>,
    pub last_app_hwnd: isize,
    pub last_app_bounds: (i32, i32, i32, i32),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub monitor_width: u32,
    pub monitor_height: u32,
    pub scale_factor: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PcContext {
    pub os: String,
    pub username: String,
    pub user_profile: String,
    pub desktop: String,
    pub documents: String,
    pub downloads: String,
    pub current_dir: String,
    pub drives: Vec<String>,
}

fn expand_path(raw: &str) -> PathBuf {
    let trimmed = raw.trim();
    let user_profile = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .unwrap_or_else(|_| "C:\\".to_string());

    let mut expanded = if trimmed == "~" {
        user_profile.clone()
    } else if let Some(rest) = trimmed.strip_prefix("~/").or_else(|| trimmed.strip_prefix("~\\")) {
        format!("{}\\{}", user_profile, rest)
    } else {
        trimmed.to_string()
    };

    if expanded.contains("%USERPROFILE%") {
        expanded = expanded.replace("%USERPROFILE%", &user_profile);
    }
    if let Ok(appdata) = env::var("APPDATA") {
        if expanded.contains("%APPDATA%") {
            expanded = expanded.replace("%APPDATA%", &appdata);
        }
    }
    if let Ok(localappdata) = env::var("LOCALAPPDATA") {
        if expanded.contains("%LOCALAPPDATA%") {
            expanded = expanded.replace("%LOCALAPPDATA%", &localappdata);
        }
    }

    PathBuf::from(expanded)
}

#[tauri::command]
fn start_drag(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn set_interactive_regions(
    state: tauri::State<'_, Arc<Mutex<CompanionState>>>,
    rects: Vec<InteractiveRect>,
    force_interactive: bool,
    companion_active: bool,
) -> Result<(), String> {
    if let Ok(mut st) = state.lock() {
        st.rects = rects;
        st.force_interactive = force_interactive;
        st.companion_active = companion_active;
    }
    Ok(())
}

#[tauri::command]
fn get_window_bounds(window: tauri::Window) -> Result<WindowBounds, String> {
    let pos = window
        .outer_position()
        .unwrap_or(PhysicalPosition { x: 100, y: 100 });
    let size = window
        .outer_size()
        .unwrap_or(PhysicalSize { width: 520, height: 580 });
    let scale_factor = window.scale_factor().unwrap_or(1.0);

    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let (monitor_x, monitor_y, monitor_width, monitor_height) = if let Some(m) = monitor {
        let m_pos = m.position();
        let m_size = m.size();
        (m_pos.x, m_pos.y, m_size.width, m_size.height)
    } else {
        (0, 0, 1920, 1080)
    };

    Ok(WindowBounds {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        monitor_x,
        monitor_y,
        monitor_width,
        monitor_height,
        scale_factor,
    })
}

#[tauri::command]
fn set_window_pos(window: tauri::Window, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_size(window: tauri::Window, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(tauri::Size::Physical(PhysicalSize { width, height }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_rect(window: tauri::Window, x: i32, y: i32, width: u32, height: u32) -> Result<WindowBounds, String> {
    let _ = window.set_size(tauri::Size::Physical(PhysicalSize { width, height }));
    let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
    get_window_bounds(window)
}

#[tauri::command]
fn center_window(window: tauri::Window) -> Result<WindowBounds, String> {
    if let Some(monitor) = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    {
        let monitor_size = monitor.size();
        let monitor_pos = monitor.position();
        let window_size = window
            .outer_size()
            .unwrap_or(PhysicalSize { width: 520, height: 580 });

        let x = monitor_pos.x + (monitor_size.width as i32 - window_size.width as i32) / 2;
        let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32) / 2;

        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
    } else {
        let _ = window.center();
    }
    get_window_bounds(window)
}

#[tauri::command]
fn move_to_corner(window: tauri::Window) -> Result<WindowBounds, String> {
    if let Some(monitor) = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    {
        let monitor_size = monitor.size();
        let monitor_pos = monitor.position();
        let window_size = window
            .outer_size()
            .unwrap_or(PhysicalSize { width: 220, height: 220 });

        let x = monitor_pos.x + monitor_size.width as i32 - window_size.width as i32 - 20;
        let y = monitor_pos.y + monitor_size.height as i32 - window_size.height as i32 - 60;

        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
    }
    get_window_bounds(window)
}

#[cfg(target_os = "windows")]
fn compute_position_for_app(
    app_info: &win32::ActiveAppInfo,
    mon_x: i32,
    mon_y: i32,
    mon_w: i32,
    mon_h: i32,
    win_w: i32,
    win_h: i32,
) -> (i32, i32) {
    let mon_right = mon_x + mon_w;
    let mon_bottom = mon_y + mon_h;
    let taskbar_margin = 56;
    let safe_bottom = mon_bottom - taskbar_margin;

    let app_left = app_info.rect.left.max(mon_x);
    let app_right = app_info.rect.right.min(mon_right);
    let app_bottom = app_info.rect.bottom.min(safe_bottom);
    let app_width = app_right - app_left;

    let space_left = app_left - mon_x;
    let space_right = mon_right - app_right;
    let gap = 10;

    // If the app is maximized or takes up nearly the full width of the screen,
    // place the bot in the bottom-right corner.
    let is_full_width = app_info.is_maximized
        || app_width >= (mon_w * 82 / 100)
        || (space_left < 120 && space_right < 120);

    if is_full_width {
        let x = mon_right - win_w - 16;
        let y = safe_bottom - win_h - 8;
        return (x, y);
    }

    // App is not full width (e.g. half on the right, half on the left, or floating window).
    // Place the bot right next to the opened app!
    let target_x = if space_left >= space_right && space_left >= 100 {
        // App is on the right half (or has more room on its left) -> put bot to the left of the app
        (app_left - win_w - gap).max(mon_x + 8)
    } else if space_right >= 100 {
        // App is on the left half (or has room on its right) -> put bot to the right of the app
        (app_right + gap).min(mon_right - win_w - 8)
    } else {
        mon_right - win_w - 16
    };

    let target_y = (app_bottom - win_h).clamp(mon_y + 16, (safe_bottom - win_h - 8).max(mon_y + 16));
    (target_x, target_y)
}

#[tauri::command]
fn get_pc_context() -> PcContext {
    let user_profile = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .unwrap_or_else(|_| "C:\\".to_string());
    let username = env::var("USERNAME")
        .or_else(|_| env::var("USER"))
        .unwrap_or_else(|_| "User".to_string());

    let desktop = format!("{}\\Desktop", user_profile);
    let documents = format!("{}\\Documents", user_profile);
    let downloads = format!("{}\\Downloads", user_profile);
    let current_dir = env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| user_profile.clone());

    let mut drives = Vec::new();
    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        if Path::new(&drive).exists() {
            drives.push(drive);
        }
    }

    PcContext {
        os: env::consts::OS.to_string(),
        username,
        user_profile,
        desktop,
        documents,
        downloads,
        current_dir,
        drives,
    }
}

#[tauri::command]
fn fs_read_file(path: String, max_bytes: Option<usize>) -> Result<String, String> {
    let target = expand_path(&path);
    let metadata = fs::metadata(&target)
        .map_err(|e| format!("Failed to access '{}': {}", target.display(), e))?;

    if metadata.is_dir() {
        return Err(format!("'{}' is a directory, not a file. Use fs_list_dir instead.", target.display()));
    }

    let limit = max_bytes.unwrap_or(250_000);
    let file = fs::File::open(&target)
        .map_err(|e| format!("Failed to open '{}': {}", target.display(), e))?;

    let mut buffer = Vec::new();
    let bytes_read = file
        .take(limit as u64)
        .read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read '{}': {}", target.display(), e))?;

    let content = String::from_utf8_lossy(&buffer).to_string();
    if metadata.len() > bytes_read as u64 {
        Ok(format!(
            "{}\n\n[Truncated: Read {} of {} total bytes from {}]",
            content,
            bytes_read,
            metadata.len(),
            target.display()
        ))
    } else {
        Ok(content)
    }
}

#[tauri::command]
fn fs_write_file(path: String, content: String, append: Option<bool>) -> Result<String, String> {
    let target = expand_path(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories '{}': {}", parent.display(), e))?;
        }
    }

    let is_append = append.unwrap_or(false);
    if is_append {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&target)
            .map_err(|e| format!("Failed to open '{}' for appending: {}", target.display(), e))?;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to append to '{}': {}", target.display(), e))?;
        Ok(format!("Successfully appended {} bytes to '{}'", content.len(), target.display()))
    } else {
        fs::write(&target, content.as_bytes())
            .map_err(|e| format!("Failed to write '{}': {}", target.display(), e))?;
        Ok(format!("Successfully wrote {} bytes to '{}'", content.len(), target.display()))
    }
}

#[tauri::command]
fn fs_list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let target = expand_path(&path);
    let read_dir = fs::read_dir(&target)
        .map_err(|e| format!("Failed to read directory '{}': {}", target.display(), e))?;

    let mut entries = Vec::new();
    for entry in read_dir.flatten() {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);

        entries.push(DirEntryInfo {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            size,
        });

        if entries.len() >= 500 {
            break;
        }
    }

    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(entries)
}

fn search_recursive(
    dir: &Path,
    query_lower: &str,
    results: &mut Vec<DirEntryInfo>,
    max_results: usize,
    depth: usize,
) {
    if depth > 6 || results.len() >= max_results {
        return;
    }

    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    for entry in read_dir.flatten() {
        if results.len() >= max_results {
            break;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_lowercase();

        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);

        if name_lower.contains(query_lower) {
            results.push(DirEntryInfo {
                name: name.clone(),
                path: path.to_string_lossy().to_string(),
                is_dir,
                size,
            });
        }

        if is_dir {
            if name_lower == "node_modules"
                || name_lower == ".git"
                || name_lower == "$recycle.bin"
                || name_lower == "system volume information"
                || name_lower == "winsxs"
            {
                continue;
            }
            search_recursive(&path, query_lower, results, max_results, depth + 1);
        }
    }
}

#[tauri::command]
fn fs_search_files(directory: String, query: String, max_results: Option<usize>) -> Result<Vec<DirEntryInfo>, String> {
    let target = expand_path(&directory);
    if !target.exists() {
        return Err(format!("Directory '{}' does not exist", target.display()));
    }
    let limit = max_results.unwrap_or(100);
    let mut results = Vec::new();
    search_recursive(&target, &query.to_lowercase(), &mut results, limit, 0);
    Ok(results)
}

#[tauri::command]
fn fs_delete_path(path: String) -> Result<String, String> {
    let target = expand_path(&path);
    let meta = fs::metadata(&target)
        .map_err(|e| format!("Path '{}' not found: {}", target.display(), e))?;

    if meta.is_dir() {
        fs::remove_dir_all(&target)
            .map_err(|e| format!("Failed to delete directory '{}': {}", target.display(), e))?;
        Ok(format!("Successfully deleted directory '{}'", target.display()))
    } else {
        fs::remove_file(&target)
            .map_err(|e| format!("Failed to delete file '{}': {}", target.display(), e))?;
        Ok(format!("Successfully deleted file '{}'", target.display()))
    }
}

#[tauri::command]
fn fs_copy_or_move(source: String, destination: String, is_move: bool) -> Result<String, String> {
    let src = expand_path(&source);
    let dst = expand_path(&destination);

    if let Some(parent) = dst.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination parent dir: {}", e))?;
        }
    }

    if is_move {
        fs::rename(&src, &dst)
            .map_err(|e| format!("Failed to move '{}' to '{}': {}", src.display(), dst.display(), e))?;
        Ok(format!("Moved '{}' to '{}'", src.display(), dst.display()))
    } else {
        fs::copy(&src, &dst)
            .map_err(|e| format!("Failed to copy '{}' to '{}': {}", src.display(), dst.display(), e))?;
        Ok(format!("Copied '{}' to '{}'", src.display(), dst.display()))
    }
}

#[tauri::command]
fn execute_pc_command(command: String, cwd: Option<String>) -> Result<CommandOutput, String> {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("powershell");
        c.args(["-NoProfile", "-NonInteractive", "-Command", &command]);
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", &command]);
        c
    };

    if let Some(dir) = cwd {
        if !dir.trim().is_empty() {
            let expanded = expand_path(&dir);
            if expanded.exists() {
                cmd.current_dir(expanded);
            }
        }
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[tauri::command]
fn open_item(target: String) -> Result<String, String> {
    let trimmed = target.trim();
    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", trimmed]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Failed to open '{}': {}", trimmed, e))?;
    } else {
        Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("Failed to open '{}': {}", trimmed, e))?;
    }
    Ok(format!("Opened '{}'", trimmed))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let companion_state = Arc::new(Mutex::new(CompanionState::default()));
    let state_for_setup = companion_state.clone();

    tauri::Builder::default()
        .manage(companion_state)
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let window = app.get_webview_window("main").unwrap();

            // Ensure OS window border/shadow is completely disabled
            let _ = window.set_shadow(false);

            // Start in the center of the screen
            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let monitor_pos = monitor.position();
                let window_size = window
                    .outer_size()
                    .unwrap_or(PhysicalSize { width: 520, height: 580 });

                let x = monitor_pos.x + (monitor_size.width as i32 - window_size.width as i32) / 2;
                let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32) / 2;

                let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
            }

            let _ = window.show();
            let _ = window.set_focus();

            // Background loop for:
            // 1) Click-through transparency everywhere except interactive regions (character model / open chat / modal)
            // 2) Smart positioning when an external app is opened (bottom-right if full, next to app if half/partial)
            #[cfg(target_os = "windows")]
            {
                let win_clone = window.clone();
                let st_clone = state_for_setup.clone();
                let self_pid = std::process::id();

                thread::spawn(move || {
                    let mut tick_count: u64 = 0;
                    loop {
                        thread::sleep(Duration::from_millis(25));
                        tick_count = tick_count.wrapping_add(1);

                        let (rects, force_interactive, companion_active, last_ignore) = {
                            let Ok(guard) = st_clone.lock() else { continue };
                            (
                                guard.rects.clone(),
                                guard.force_interactive,
                                guard.companion_active,
                                guard.is_ignoring_cursor,
                            )
                        };

                        // 1. Update click-through state based on cursor position vs interactive rects
                        if let (Some((cx, cy)), Ok(win_pos), Ok(scale)) = (
                            win32::get_cursor_pos(),
                            win_clone.outer_position(),
                            win_clone.scale_factor(),
                        ) {
                            let rel_x = (cx - win_pos.x) as f64 / scale;
                            let rel_y = (cy - win_pos.y) as f64 / scale;

                            let is_inside = if force_interactive || rects.is_empty() {
                                true
                            } else {
                                rects.iter().any(|r| {
                                    rel_x >= r.x - 6.0
                                        && rel_x <= r.x + r.width + 6.0
                                        && rel_y >= r.y - 6.0
                                        && rel_y <= r.y + r.height + 6.0
                                })
                            };

                            let should_ignore = !is_inside;
                            if last_ignore != Some(should_ignore) {
                                let _ = win_clone.set_ignore_cursor_events(should_ignore);
                                if let Ok(mut guard) = st_clone.lock() {
                                    guard.is_ignoring_cursor = Some(should_ignore);
                                }
                            }
                        }

                        // 2. Check active external app every ~200ms (8 ticks) when companion mode is active
                        if companion_active && !force_interactive && tick_count % 8 == 0 {
                            if let Some(app_info) = win32::get_active_external_app(self_pid) {
                                let current_bounds = (
                                    app_info.rect.left,
                                    app_info.rect.top,
                                    app_info.rect.right,
                                    app_info.rect.bottom,
                                );

                                let should_reposition = {
                                    let Ok(guard) = st_clone.lock() else { continue };
                                    if guard.last_app_hwnd != app_info.hwnd {
                                        true
                                    } else {
                                        let (l, t, r, b) = guard.last_app_bounds;
                                        (l - current_bounds.0).abs() > 25
                                            || (t - current_bounds.1).abs() > 25
                                            || (r - current_bounds.2).abs() > 25
                                            || (b - current_bounds.3).abs() > 25
                                    }
                                };

                                if should_reposition {
                                    if let Ok(mut guard) = st_clone.lock() {
                                        guard.last_app_hwnd = app_info.hwnd;
                                        guard.last_app_bounds = current_bounds;
                                    }

                                    let monitor = win_clone
                                        .current_monitor()
                                        .ok()
                                        .flatten()
                                        .or_else(|| win_clone.primary_monitor().ok().flatten());

                                    if let (Some(m), Ok(win_size)) = (monitor, win_clone.outer_size()) {
                                        let m_pos = m.position();
                                        let m_size = m.size();
                                        let (target_x, target_y) = compute_position_for_app(
                                            &app_info,
                                            m_pos.x,
                                            m_pos.y,
                                            m_size.width as i32,
                                            m_size.height as i32,
                                            win_size.width as i32,
                                            win_size.height as i32,
                                        );
                                        let _ = win_clone.set_position(tauri::Position::Physical(
                                            PhysicalPosition {
                                                x: target_x,
                                                y: target_y,
                                            },
                                        ));
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Setup Tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Mascot", true, None::<&str>)?;
            let center_i = MenuItem::with_id(app, "center", "Return Mascot to Screen", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &center_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(move |app, event| {
                    if event.id() == "quit" {
                        app.exit(0);
                    } else if event.id() == "show" {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    } else if event.id() == "center" {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.center();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_drag,
            set_interactive_regions,
            get_window_bounds,
            set_window_pos,
            set_window_size,
            set_window_rect,
            center_window,
            move_to_corner,
            get_pc_context,
            fs_read_file,
            fs_write_file,
            fs_list_dir,
            fs_search_files,
            fs_delete_path,
            fs_copy_or_move,
            execute_pc_command,
            open_item
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
