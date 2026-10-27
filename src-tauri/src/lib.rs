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
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};

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
    pub const GW_HWNDNEXT: u32 = 2;
    pub const DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9;
    pub const DWMWA_CLOAKED: u32 = 14;

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
        pub fn GetTopWindow(hwnd: HWND) -> HWND;
        pub fn GetWindow(hwnd: HWND, u_cmd: u32) -> HWND;
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

    unsafe fn inspect_external_window(hwnd: HWND, self_pid: u32) -> Option<ActiveAppInfo> {
        if hwnd == 0 {
            return None;
        }

        let mut pid: DWORD = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, &mut pid);
        }
        if pid == 0 || pid == self_pid {
            return None;
        }

        if unsafe { IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 } {
            return None;
        }

        let mut cloaked: u32 = 0;
        let cloak_res = unsafe {
            DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut u32 as *mut c_void,
                std::mem::size_of::<u32>() as DWORD,
            )
        };
        if cloak_res == 0 && cloaked != 0 {
            return None;
        }

        let ex_style = unsafe { GetWindowLongW(hwnd, GWL_EXSTYLE) };
        if (ex_style & WS_EX_TOOLWINDOW) != 0 || (ex_style & WS_EX_NOACTIVATE) != 0 {
            return None;
        }

        let title_len = unsafe { GetWindowTextLengthW(hwnd) };
        if title_len <= 0 {
            return None;
        }

        let mut class_buf = [0u16; 256];
        let class_len = unsafe { GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32) };
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
        let dwm_res = unsafe {
            DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                &mut rect as *mut RECT as *mut c_void,
                std::mem::size_of::<RECT>() as DWORD,
            )
        };
        if dwm_res != 0 {
            if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
                return None;
            }
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < 180 || height < 180 {
            return None;
        }

        let is_maximized = unsafe { IsZoomed(hwnd) != 0 };
        Some(ActiveAppInfo {
            hwnd,
            rect,
            is_maximized,
        })
    }

    pub fn get_active_external_app(self_pid: u32) -> Option<ActiveAppInfo> {
        unsafe {
            let fg = GetForegroundWindow();
            if let Some(info) = inspect_external_window(fg, self_pid) {
                return Some(info);
            }

            // If our own companion window is currently foreground (e.g., right when opened),
            // find the topmost visible external app window behind it in Z-order.
            let mut curr = if fg != 0 {
                GetWindow(fg, GW_HWNDNEXT)
            } else {
                GetTopWindow(0)
            };
            let mut steps = 0;
            while curr != 0 && steps < 64 {
                if let Some(info) = inspect_external_window(curr, self_pid) {
                    return Some(info);
                }
                curr = GetWindow(curr, GW_HWNDNEXT);
                steps += 1;
            }
            None
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

#[derive(Clone, Debug)]
pub struct AutoGlide {
    pub start_x: f64,
    pub start_y: f64,
    pub last_x: f64,
    pub last_y: f64,
    pub target_x: f64,
    pub target_y: f64,
    pub start_time: std::time::Instant,
    pub duration_ms: f64,
    pub screen_side: String,
    pub screen_vert: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotGlidePayload {
    pub active: bool,
    pub vx: f64,
    pub vy: f64,
    pub screen_side: String,
    pub screen_vert: String,
}

#[derive(Default)]
pub struct CompanionState {
    pub rects: Vec<InteractiveRect>,
    pub force_interactive: bool,
    pub companion_active: bool,
    pub is_ignoring_cursor: Option<bool>,
    pub last_app_hwnd: isize,
    pub last_app_bounds: (i32, i32, i32, i32),
    pub has_initial_docked: bool,
    pub auto_glide: Option<AutoGlide>,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GoogleOAuthCallbackResult {
    pub code: String,
    pub redirect_uri: String,
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let raw = input.as_bytes();
    let mut i = 0;
    while i < raw.len() {
        if raw[i] == b'%' && i + 2 < raw.len() {
            if let (Some(h), Some(l)) = (
                (raw[i + 1] as char).to_digit(16),
                (raw[i + 2] as char).to_digit(16),
            ) {
                bytes.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        } else if raw[i] == b'+' {
            bytes.push(b' ');
            i += 1;
            continue;
        }
        bytes.push(raw[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).to_string()
}

#[tauri::command]
async fn start_google_oauth_login(
    window: tauri::Window,
    client_id: String,
) -> Result<GoogleOAuthCallbackResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let listener = std::net::TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to start local Google login listener: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to read local port: {}", e))?
            .port();
        let _ = listener.set_nonblocking(true);

        let redirect_uri = format!("http://127.0.0.1:{}/oauth2callback", port);
        let redirect_encoded = format!("http%3A%2F%2F127.0.0.1%3A{}%2Foauth2callback", port);
        let scopes_encoded = "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile";

        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=select_account",
            client_id.trim(),
            redirect_encoded,
            scopes_encoded
        );

        if cfg!(target_os = "windows") {
            let mut cmd = Command::new("rundll32");
            cmd.args(["url.dll,FileProtocolHandler", &auth_url]);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.spawn()
                .map_err(|e| format!("Failed to open Google Login in browser: {}", e))?;
        } else {
            Command::new("xdg-open")
                .arg(&auth_url)
                .spawn()
                .map_err(|e| format!("Failed to open Google Login in browser: {}", e))?;
        }

        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(180);

        loop {
            if start.elapsed() > timeout {
                return Err("Google login timed out after 3 minutes. Please try again.".to_string());
            }

            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut buf = [0u8; 4096];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    if n == 0 {
                        continue;
                    }
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let first_line = req.lines().next().unwrap_or("");
                    let path = first_line.split_whitespace().nth(1).unwrap_or("");

                    if path.starts_with("/favicon") {
                        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                        continue;
                    }

                    let query = path.splitn(2, '?').nth(1).unwrap_or("");
                    let mut code: Option<String> = None;
                    let mut err_msg: Option<String> = None;

                    for pair in query.split('&') {
                        let mut kv = pair.splitn(2, '=');
                        let k = kv.next().unwrap_or("");
                        let v = kv.next().unwrap_or("");
                        if k == "code" && !v.is_empty() {
                            code = Some(percent_decode(v));
                        } else if k == "error" && !v.is_empty() {
                            err_msg = Some(percent_decode(v));
                        }
                    }

                    if let Some(auth_code) = code {
                        let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Luminess Assist - Signed In</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#090a10;color:#fff;font-family:system-ui,-apple-system,sans-serif;}.card{background:rgba(20,22,34,0.95);border:1.5px solid #38bdf8;border-radius:24px;padding:36px 44px;text-align:center;box-shadow:0 0 40px rgba(56,189,248,0.35);}h1{margin:12px 0 8px;font-size:22px;}p{margin:0;color:#94a3b8;font-size:14px;}.badge{display:inline-flex;width:48px;height:48px;border-radius:50%;background:rgba(56,189,248,0.15);border:1.5px solid #38bdf8;align-items:center;justify-content:center;font-size:24px;color:#38bdf8;}</style></head><body><div class=\"card\"><div class=\"badge\">&#10003;</div><h1>Signed in to Luminess Assist!</h1><p>You can close this tab and return to your desktop companion.</p></div><script>setTimeout(()=>window.close(),1000);</script></body></html>";
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            html.len(),
                            html
                        );
                        let _ = stream.write_all(response.as_bytes());
                        let _ = stream.flush();
                        let _ = window.show();
                        let _ = window.set_focus();
                        return Ok(GoogleOAuthCallbackResult {
                            code: auth_code,
                            redirect_uri,
                        });
                    } else if let Some(err) = err_msg {
                        let html = format!(
                            "<!DOCTYPE html><html><body style=\"background:#090a10;color:#fca5a5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;\"><div><h2>Google Sign-In Cancelled ({})</h2><p>You can close this window and try again in Luminess Assist.</p></div></body></html>",
                            err
                        );
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            html.len(),
                            html
                        );
                        let _ = stream.write_all(response.as_bytes());
                        let _ = stream.flush();
                        return Err(format!("Google sign-in failed or was cancelled: {}", err));
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(e) => {
                    return Err(format!("Local OAuth server error: {}", e));
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Google login task error: {}", e))?
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
        let was_active = st.companion_active;
        st.rects = rects;
        st.force_interactive = force_interactive;
        st.companion_active = companion_active;
        if force_interactive {
            st.auto_glide = None;
        }
        if !companion_active && was_active {
            st.last_app_hwnd = 0;
            st.last_app_bounds = (0, 0, 0, 0);
            st.has_initial_docked = false;
            st.auto_glide = None;
        }
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
fn set_window_pos(
    state: tauri::State<'_, Arc<Mutex<CompanionState>>>,
    window: tauri::Window,
    x: i32,
    y: i32,
) -> Result<(), String> {
    if let Ok(mut st) = state.lock() {
        st.auto_glide = None;
    }
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
fn set_window_rect(
    state: tauri::State<'_, Arc<Mutex<CompanionState>>>,
    window: tauri::Window,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<WindowBounds, String> {
    if let Ok(mut st) = state.lock() {
        st.auto_glide = None;
    }
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

#[tauri::command]
fn glide_to_cursor(
    state: tauri::State<'_, Arc<Mutex<CompanionState>>>,
    window: tauri::Window,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let Some((cx, cy)) = win32::get_cursor_pos() else {
            return Ok(false);
        };
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());
        let (Some(m), Ok(win_size), Ok(win_pos)) = (
            monitor,
            window.outer_size(),
            window.outer_position(),
        ) else {
            return Ok(false);
        };

        let m_pos = m.position();
        let m_size = m.size();
        let scale = window.scale_factor().unwrap_or(1.0);
        let pad = (56.0 * scale).round() as i32;
        let taskbar_margin = (56.0 * scale).round() as i32;
        let win_w = win_size.width as i32;
        let win_h = win_size.height as i32;

        let min_win_x = m_pos.x - pad + (10.0 * scale).round() as i32;
        let max_win_x = (m_pos.x + m_size.width as i32 - win_w + pad - (14.0 * scale).round() as i32).max(min_win_x);
        let min_win_y = m_pos.y - pad + (12.0 * scale).round() as i32;
        let max_win_y = (m_pos.y + m_size.height as i32 - taskbar_margin - win_h + pad - (8.0 * scale).round() as i32).max(min_win_y);

        // Aim slightly beside the cursor so the robot visits the cursor playfully without covering the pointer tip
        let offset_x = if cx > m_pos.x + (m_size.width as i32 / 2) {
            -(win_w / 2 + (28.0 * scale).round() as i32)
        } else {
            -(win_w / 2 - (28.0 * scale).round() as i32)
        };
        let target_x = (cx + offset_x).clamp(min_win_x, max_win_x);
        let target_y = (cy - win_h / 2).clamp(min_win_y, max_win_y);

        let dist = ((target_x - win_pos.x) as f64).hypot((target_y - win_pos.y) as f64);
        if dist < 24.0 {
            return Ok(false);
        }

        let center_x = target_x + win_w / 2;
        let center_y = target_y + win_h / 2;
        let side = if center_x < m_pos.x + (m_size.width as i32 / 2) {
            "left".to_string()
        } else {
            "right".to_string()
        };
        let vert = if center_y < m_pos.y + (m_size.height as i32 / 2) {
            "up".to_string()
        } else {
            "down".to_string()
        };

        if let Ok(mut guard) = state.lock() {
            if !guard.companion_active || guard.force_interactive {
                return Ok(false);
            }
            let duration_ms = (dist * 0.65).clamp(480.0, 950.0);
            guard.auto_glide = Some(AutoGlide {
                start_x: win_pos.x as f64,
                start_y: win_pos.y as f64,
                last_x: win_pos.x as f64,
                last_y: win_pos.y as f64,
                target_x: target_x as f64,
                target_y: target_y as f64,
                start_time: std::time::Instant::now(),
                duration_ms,
                screen_side: side,
                screen_vert: vert,
            });
            return Ok(true);
        }
        Ok(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (state, window);
        Ok(false)
    }
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
    scale_factor: f64,
) -> (i32, i32, String, String) {
    let mon_right = mon_x + mon_w;
    let mon_bottom = mon_y + mon_h;
    let taskbar_margin = (56.0 * scale_factor).round() as i32;
    let safe_bottom = mon_bottom - taskbar_margin;
    let pad = (56.0 * scale_factor).round() as i32;

    let app_left = app_info.rect.left.max(mon_x);
    let app_right = app_info.rect.right.min(mon_right);
    let app_bottom = app_info.rect.bottom.min(safe_bottom);
    let app_width = app_right - app_left;

    let space_left = app_left - mon_x;
    let space_right = mon_right - app_right;
    let gap = (8.0 * scale_factor).round() as i32;
    let min_side_space = (95.0 * scale_factor).round() as i32;

    let min_win_x = mon_x - pad + (10.0 * scale_factor).round() as i32;
    let max_win_x = (mon_right - win_w + pad - (14.0 * scale_factor).round() as i32).max(min_win_x);
    let min_win_y = mon_y - pad + (12.0 * scale_factor).round() as i32;
    let max_win_y = (safe_bottom - win_h + pad - (8.0 * scale_factor).round() as i32).max(min_win_y);

    // If the app is maximized or takes up nearly the full width of the screen,
    // place the bot at the bottom-right side of the app.
    let is_full_width = app_info.is_maximized
        || app_width >= (mon_w * 84 / 100)
        || (space_left < min_side_space && space_right < min_side_space);

    if is_full_width {
        return (max_win_x, max_win_y, "right".to_string(), "down".to_string());
    }

    // App is not full width (e.g. half on the right, half on the left, or floating window).
    // Place the bot right next to the side of the opened app!
    let (target_x, side) = if space_left >= space_right && space_left >= min_side_space {
        // App is on the right half (or has more room on its left) -> put bot to the left of the app
        let x = (app_left - win_w + pad - gap).clamp(min_win_x, max_win_x);
        let center_x = x + win_w / 2;
        let s = if center_x < mon_x + mon_w / 2 { "left" } else { "right" };
        (x, s.to_string())
    } else if space_right >= min_side_space {
        // App is on the left half (or has room on its right) -> put bot to the right of the app
        let x = (app_right - pad + gap).clamp(min_win_x, max_win_x);
        let center_x = x + win_w / 2;
        let s = if center_x < mon_x + mon_w / 2 { "left" } else { "right" };
        (x, s.to_string())
    } else {
        (max_win_x, "right".to_string())
    };

    let target_y = (app_bottom - win_h + pad).clamp(min_win_y, max_win_y);
    let center_y = target_y + win_h / 2;
    let vert = if center_y < mon_y + mon_h / 2 {
        "up".to_string()
    } else {
        "down".to_string()
    };
    (target_x, target_y, side, vert)
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
                        let is_gliding = {
                            st_clone
                                .lock()
                                .map(|g| g.auto_glide.is_some())
                                .unwrap_or(false)
                        };
                        thread::sleep(Duration::from_millis(if is_gliding { 15 } else { 25 }));
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

                        // 1. Step smooth auto-glide animation if active
                        if companion_active && !force_interactive {
                            let mut glide_step: Option<(i32, i32, BotGlidePayload)> = None;
                            if let Ok(mut guard) = st_clone.lock() {
                                if let Some(mut glide) = guard.auto_glide.clone() {
                                    let elapsed = glide.start_time.elapsed().as_secs_f64() * 1000.0;
                                    let t = (elapsed / glide.duration_ms).clamp(0.0, 1.0);
                                    // Smooth cubic ease-in-out so it drags smoothly to the side of the app
                                    let ease = if t < 0.5 {
                                        4.0 * t * t * t
                                    } else {
                                        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
                                    };

                                    let curr_x = glide.start_x + (glide.target_x - glide.start_x) * ease;
                                    let curr_y = glide.start_y + (glide.target_y - glide.start_y) * ease;
                                    let vx = curr_x - glide.last_x;
                                    let vy = curr_y - glide.last_y;

                                    glide.last_x = curr_x;
                                    glide.last_y = curr_y;

                                    if t >= 1.0 {
                                        guard.auto_glide = None;
                                        glide_step = Some((
                                            glide.target_x.round() as i32,
                                            glide.target_y.round() as i32,
                                            BotGlidePayload {
                                                active: false,
                                                vx: 0.0,
                                                vy: 0.0,
                                                screen_side: glide.screen_side,
                                                screen_vert: glide.screen_vert,
                                            },
                                        ));
                                    } else {
                                        guard.auto_glide = Some(glide.clone());
                                        glide_step = Some((
                                            curr_x.round() as i32,
                                            curr_y.round() as i32,
                                            BotGlidePayload {
                                                active: true,
                                                vx,
                                                vy,
                                                screen_side: glide.screen_side,
                                                screen_vert: glide.screen_vert,
                                            },
                                        ));
                                    }
                                }
                            }

                            if let Some((gx, gy, payload)) = glide_step {
                                let _ = win_clone.set_position(tauri::Position::Physical(
                                    PhysicalPosition { x: gx, y: gy },
                                ));
                                let _ = win_clone.emit("bot-glide", payload);
                            }
                        }

                        // 2. Update click-through state based on cursor position vs interactive rects
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

                        // 3. Check active external app every ~200ms (8 ticks) when companion mode is active
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
                                    let monitor = win_clone
                                        .current_monitor()
                                        .ok()
                                        .flatten()
                                        .or_else(|| win_clone.primary_monitor().ok().flatten());

                                    if let (Some(m), Ok(win_size), Ok(win_pos)) = (
                                        monitor,
                                        win_clone.outer_size(),
                                        win_clone.outer_position(),
                                    ) {
                                        let m_pos = m.position();
                                        let m_size = m.size();
                                        let scale = win_clone.scale_factor().unwrap_or(1.0);
                                        let (target_x, target_y, side, vert) = compute_position_for_app(
                                            &app_info,
                                            m_pos.x,
                                            m_pos.y,
                                            m_size.width as i32,
                                            m_size.height as i32,
                                            win_size.width as i32,
                                            win_size.height as i32,
                                            scale,
                                        );

                                        let dist = ((target_x - win_pos.x) as f64)
                                            .hypot((target_y - win_pos.y) as f64);

                                        if let Ok(mut guard) = st_clone.lock() {
                                            guard.last_app_hwnd = app_info.hwnd;
                                            guard.last_app_bounds = current_bounds;
                                            guard.has_initial_docked = true;
                                            if dist > 4.0 {
                                                let duration_ms = (dist * 0.55).clamp(440.0, 820.0);
                                                guard.auto_glide = Some(AutoGlide {
                                                    start_x: win_pos.x as f64,
                                                    start_y: win_pos.y as f64,
                                                    last_x: win_pos.x as f64,
                                                    last_y: win_pos.y as f64,
                                                    target_x: target_x as f64,
                                                    target_y: target_y as f64,
                                                    start_time: std::time::Instant::now(),
                                                    duration_ms,
                                                    screen_side: side,
                                                    screen_vert: vert,
                                                });
                                            }
                                        }
                                    }
                                }
                            } else {
                                // No external app window is visible (e.g. only Desktop is open on startup):
                                // smoothly glide from center to the side of the screen once.
                                let needs_initial_dock = {
                                    st_clone
                                        .lock()
                                        .map(|g| !g.has_initial_docked)
                                        .unwrap_or(false)
                                };
                                if needs_initial_dock {
                                    let monitor = win_clone
                                        .current_monitor()
                                        .ok()
                                        .flatten()
                                        .or_else(|| win_clone.primary_monitor().ok().flatten());

                                    if let (Some(m), Ok(win_size), Ok(win_pos)) = (
                                        monitor,
                                        win_clone.outer_size(),
                                        win_clone.outer_position(),
                                    ) {
                                        let m_pos = m.position();
                                        let m_size = m.size();
                                        let scale = win_clone.scale_factor().unwrap_or(1.0);
                                        let pad = (56.0 * scale).round() as i32;
                                        let taskbar_margin = (56.0 * scale).round() as i32;
                                        let target_x = m_pos.x + m_size.width as i32
                                            - win_size.width as i32
                                            + pad
                                            - (16.0 * scale).round() as i32;
                                        let target_y = m_pos.y + m_size.height as i32
                                            - taskbar_margin
                                            - win_size.height as i32
                                            + pad
                                            - (8.0 * scale).round() as i32;

                                        let dist = ((target_x - win_pos.x) as f64)
                                            .hypot((target_y - win_pos.y) as f64);

                                        if let Ok(mut guard) = st_clone.lock() {
                                            guard.has_initial_docked = true;
                                            if dist > 4.0 {
                                                let duration_ms = (dist * 0.55).clamp(440.0, 820.0);
                                                guard.auto_glide = Some(AutoGlide {
                                                    start_x: win_pos.x as f64,
                                                    start_y: win_pos.y as f64,
                                                    last_x: win_pos.x as f64,
                                                    last_y: win_pos.y as f64,
                                                    target_x: target_x as f64,
                                                    target_y: target_y as f64,
                                                    start_time: std::time::Instant::now(),
                                                    duration_ms,
                                                    screen_side: "right".to_string(),
                                                    screen_vert: "down".to_string(),
                                                });
                                            }
                                        }
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
            glide_to_cursor,
            get_pc_context,
            fs_read_file,
            fs_write_file,
            fs_list_dir,
            fs_search_files,
            fs_delete_path,
            fs_copy_or_move,
            execute_pc_command,
            open_item,
            start_google_oauth_login
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
