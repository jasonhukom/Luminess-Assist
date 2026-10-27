use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
fn get_window_bounds(window: tauri::Window) -> Result<WindowBounds, String> {
    let pos = window
        .outer_position()
        .unwrap_or(PhysicalPosition { x: 100, y: 100 });
    let size = window
        .outer_size()
        .unwrap_or(PhysicalSize { width: 760, height: 680 });
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
            .unwrap_or(PhysicalSize { width: 760, height: 680 });

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
            .unwrap_or(PhysicalSize { width: 760, height: 680 });

        let x = monitor_pos.x + monitor_size.width as i32 - window_size.width as i32 - 20;
        let y = monitor_pos.y + monitor_size.height as i32 - window_size.height as i32 - 60;

        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
    }
    get_window_bounds(window)
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
            // Skip noisy system/cache directories unless explicitly searching for them
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
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let window = app.get_webview_window("main").unwrap();

            // Start in the center of the screen so the initial AI API setup prompt appears in the middle
            if let Ok(Some(monitor)) = window.current_monitor() {
                let monitor_size = monitor.size();
                let monitor_pos = monitor.position();
                let window_size = window
                    .outer_size()
                    .unwrap_or(PhysicalSize { width: 760, height: 680 });

                let x = monitor_pos.x + (monitor_size.width as i32 - window_size.width as i32) / 2;
                let y = monitor_pos.y + (monitor_size.height as i32 - window_size.height as i32) / 2;

                let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
            }

            let _ = window.show();
            let _ = window.set_focus();

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
            get_window_bounds,
            set_window_pos,
            set_window_size,
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
