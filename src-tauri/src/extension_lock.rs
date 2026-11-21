use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

use crate::services::get_app_data_dir;

pub const REQUIRED_BIBLE_PLAN_VERSION: &str = "Alpha0.0.1";
pub const EXTENSION_LOCK_MESSAGE: &str =
    "Luminess requires an active update/connection from the Bible-Plan Extension page.";
pub const LOCAL_EXTENSION_IPC_ADDR: &str = "127.0.0.1:47821";
const HANDSHAKE_FILENAME: &str = "bible-plan-extension.json";

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct BiblePlanHandshakePayload {
    #[serde(default)]
    pub extension_id: String,
    #[serde(default)]
    pub installed_from_bible_plan: bool,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub app_version: String,
    #[serde(default)]
    pub heartbeat_url: Option<String>,
    #[serde(default)]
    pub updated_at_ms: u64,
    #[serde(default)]
    pub schedule_feed: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionLockStatus {
    pub unlocked: bool,
    pub installed_from_bible_plan: bool,
    pub enabled: bool,
    pub app_version: String,
    pub required_version: String,
    pub reason: String,
    pub message: String,
    pub schedule_feed: Option<serde_json::Value>,
    pub ipc_endpoint: String,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn handshake_file_path() -> PathBuf {
    get_app_data_dir().join(HANDSHAKE_FILENAME)
}

pub fn load_saved_handshake() -> Option<BiblePlanHandshakePayload> {
    let path = handshake_file_path();
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<BiblePlanHandshakePayload>(&raw).ok()
}

pub fn save_handshake(payload: &BiblePlanHandshakePayload) -> Result<(), String> {
    let mut normalized = payload.clone();
    if normalized.extension_id.trim().is_empty() {
        normalized.extension_id = "luminess-assist".to_string();
    }
    if normalized.updated_at_ms == 0 {
        normalized.updated_at_ms = now_ms();
    }
    let path = handshake_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare extension state directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("Failed to serialize extension handshake: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write extension handshake: {}", e))
}

pub fn evaluate_lock_status(handshake: Option<&BiblePlanHandshakePayload>) -> ExtensionLockStatus {
    let ipc_endpoint = format!("http://{}", LOCAL_EXTENSION_IPC_ADDR);

    let Some(hs) = handshake else {
        return ExtensionLockStatus {
            unlocked: false,
            installed_from_bible_plan: false,
            enabled: false,
            app_version: String::new(),
            required_version: REQUIRED_BIBLE_PLAN_VERSION.to_string(),
            reason: "unlinked".to_string(),
            message: EXTENSION_LOCK_MESSAGE.to_string(),
            schedule_feed: None,
            ipc_endpoint,
        };
    };

    let version_ok = hs.app_version.trim() == REQUIRED_BIBLE_PLAN_VERSION;
    let unlocked = hs.installed_from_bible_plan && hs.enabled && version_ok;

    let reason = if !hs.installed_from_bible_plan {
        "not_installed_from_bible_plan"
    } else if !hs.enabled {
        "disabled_in_bible_plan"
    } else if !version_ok {
        "version_mismatch"
    } else {
        "active"
    };

    ExtensionLockStatus {
        unlocked,
        installed_from_bible_plan: hs.installed_from_bible_plan,
        enabled: hs.enabled,
        app_version: hs.app_version.clone(),
        required_version: REQUIRED_BIBLE_PLAN_VERSION.to_string(),
        reason: reason.to_string(),
        message: if unlocked {
            "Connected to Bible-Plan Extension.".to_string()
        } else {
            EXTENSION_LOCK_MESSAGE.to_string()
        },
        schedule_feed: hs.schedule_feed.clone(),
        ipc_endpoint,
    }
}

#[derive(Default)]
pub struct ExtensionLockState {
    pub status: Mutex<Option<ExtensionLockStatus>>,
}

impl ExtensionLockState {
    pub fn current_status(&self) -> ExtensionLockStatus {
        if let Ok(guard) = self.status.lock() {
            if let Some(st) = guard.as_ref() {
                return st.clone();
            }
        }
        let saved = load_saved_handshake();
        let computed = evaluate_lock_status(saved.as_ref());
        if let Ok(mut guard) = self.status.lock() {
            *guard = Some(computed.clone());
        }
        computed
    }

    pub fn update_from_handshake(
        &self,
        payload: BiblePlanHandshakePayload,
    ) -> Result<ExtensionLockStatus, String> {
        save_handshake(&payload)?;
        let status = evaluate_lock_status(Some(&payload));
        if let Ok(mut guard) = self.status.lock() {
            *guard = Some(status.clone());
        }
        Ok(status)
    }
}

/// Checks an HTTP heartbeat endpoint (`http://host:port/api/extensions/luminess-heartbeat`)
/// without panicking, returning a graceful Result on any network or parse failure.
pub fn fetch_remote_heartbeat(heartbeat_url: &str) -> Result<BiblePlanHandshakePayload, String> {
    let trimmed = heartbeat_url.trim();
    let rest = trimmed
        .strip_prefix("http://")
        .ok_or_else(|| "Remote HTTP heartbeat requires an http:// loopback/LAN URL.".to_string())?;
    let (host_port, path) = match rest.find('/') {
        Some(idx) => (&rest[..idx], &rest[idx..]),
        None => (rest, "/api/extensions/luminess-heartbeat"),
    };
    let addr_spec = if host_port.contains(':') {
        host_port.to_string()
    } else {
        format!("{}:80", host_port)
    };
    let addr: SocketAddr = addr_spec
        .as_str()
        .to_socket_addrs()
        .map_err(|e| format!("Failed to resolve heartbeat address '{}': {}", host_port, e))?
        .next()
        .ok_or_else(|| format!("No socket address resolved for '{}'", host_port))?;

    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(800))
        .map_err(|e| format!("Failed to reach Bible-Plan heartbeat '{}': {}", host_port, e))?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1200)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(800)));

    let req = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        path, host_port
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| format!("Heartbeat request write failed: {}", e))?;

    let mut buf = Vec::new();
    let _ = stream.take(128 * 1024).read_to_end(&mut buf);
    let raw = String::from_utf8_lossy(&buf);
    let body = raw
        .split("\r\n\r\n")
        .nth(1)
        .ok_or_else(|| "Heartbeat response missing HTTP body".to_string())?;
    let start = body
        .find('{')
        .ok_or_else(|| "Heartbeat body missing JSON start".to_string())?;
    let end = body
        .rfind('}')
        .ok_or_else(|| "Heartbeat body missing JSON end".to_string())?;
    if start > end {
        return Err("Malformed JSON boundaries in heartbeat response".to_string());
    }

    serde_json::from_str::<BiblePlanHandshakePayload>(&body[start..=end])
        .map_err(|e| format!("Failed to parse heartbeat payload: {}", e))
}

fn parse_content_length(headers: &str) -> usize {
    for line in headers.lines() {
        if let Some((name, value)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("content-length") {
                if let Ok(len) = value.trim().parse::<usize>() {
                    return len;
                }
            }
        }
    }
    0
}

fn read_http_request(stream: &mut TcpStream, max_bytes: usize) -> String {
    let mut raw = Vec::new();
    let mut chunk = [0u8; 4096];
    let mut header_end: Option<usize> = None;
    let mut expected_total: Option<usize> = None;

    while raw.len() < max_bytes {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                let remaining = max_bytes - raw.len();
                let take_n = n.min(remaining);
                raw.extend_from_slice(&chunk[..take_n]);

                if header_end.is_none() {
                    if let Some(pos) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
                        header_end = Some(pos);
                        let headers = String::from_utf8_lossy(&raw[..pos]);
                        let content_len = parse_content_length(&headers);
                        expected_total = Some((pos + 4).saturating_add(content_len).min(max_bytes));
                    }
                }

                if let Some(total) = expected_total {
                    if raw.len() >= total {
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }

    String::from_utf8_lossy(&raw).to_string()
}

fn write_http_json(stream: &mut TcpStream, status_line: &str, body_json: &str) {
    let resp = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-App-Version\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status_line,
        body_json.len(),
        body_json
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
}

fn resolve_configured_heartbeat_url() -> Option<String> {
    if let Ok(url) = env::var("BIBLE_PLAN_HEARTBEAT_URL") {
        let trimmed = url.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    load_saved_handshake()
        .and_then(|hs| hs.heartbeat_url)
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty())
}

/// Starts a lightweight localhost IPC HTTP server (`127.0.0.1:47821`) so the
/// Bible-Plan web/desktop Extension page can check heartbeats and push
/// enable/disable/update handshakes without blocking Tauri's main thread.
pub fn spawn_extension_ipc_server(app: AppHandle, lock_state: Arc<ExtensionLockState>) {
    thread::spawn(move || {
        let listener = match TcpListener::bind(LOCAL_EXTENSION_IPC_ADDR) {
            Ok(l) => l,
            Err(err) => {
                log::warn!(
                    "Extension IPC loopback listener unavailable on {}: {}",
                    LOCAL_EXTENSION_IPC_ADDR,
                    err
                );
                return;
            }
        };

        if let Err(err) = listener.set_nonblocking(true) {
            log::warn!("Failed to set nonblocking on extension IPC listener: {}", err);
            return;
        }

        // Check optional configured heartbeat URL once at startup without crashing
        if let Some(url) = resolve_configured_heartbeat_url() {
            if let Ok(payload) = fetch_remote_heartbeat(&url) {
                if let Ok(status) = lock_state.update_from_handshake(payload) {
                    let _ = app.emit("bible-plan-extension-status", &status);
                }
            }
        }

        let mut last_heartbeat_poll = Instant::now();

        loop {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_millis(600)));
                    let req = read_http_request(&mut stream, 64 * 1024);
                    if req.is_empty() {
                        continue;
                    }
                    let first_line = req.lines().next().unwrap_or("");
                    let mut parts = first_line.split_whitespace();
                    let method = parts.next().unwrap_or("");
                    let path = parts.next().unwrap_or("");

                    if method.eq_ignore_ascii_case("OPTIONS") {
                        write_http_json(&mut stream, "204 No Content", "");
                        continue;
                    }

                    if path.starts_with("/api/extensions/luminess-heartbeat") {
                        let status = lock_state.current_status();
                        let payload = serde_json::json!({
                            "ok": true,
                            "app": "luminess-assist",
                            "requiredVersion": REQUIRED_BIBLE_PLAN_VERSION,
                            "lockStatus": status
                        });
                        write_http_json(&mut stream, "200 OK", &payload.to_string());
                        continue;
                    }

                    if method.eq_ignore_ascii_case("POST")
                        && path.starts_with("/api/extensions/luminess-handshake")
                    {
                        let body = req.split("\r\n\r\n").nth(1).unwrap_or("").trim();
                        match serde_json::from_str::<BiblePlanHandshakePayload>(body) {
                            Ok(hs) => match lock_state.update_from_handshake(hs) {
                                Ok(status) => {
                                    let _ = app.emit("bible-plan-extension-status", &status);
                                    let resp = serde_json::json!({
                                        "ok": true,
                                        "lockStatus": status
                                    });
                                    write_http_json(&mut stream, "200 OK", &resp.to_string());
                                }
                                Err(err) => {
                                    let resp = serde_json::json!({ "ok": false, "error": err });
                                    write_http_json(
                                        &mut stream,
                                        "500 Internal Server Error",
                                        &resp.to_string(),
                                    );
                                }
                            },
                            Err(err) => {
                                let resp = serde_json::json!({
                                    "ok": false,
                                    "error": format!("Invalid handshake JSON: {}", err)
                                });
                                write_http_json(&mut stream, "400 Bad Request", &resp.to_string());
                            }
                        }
                        continue;
                    }

                    write_http_json(
                        &mut stream,
                        "404 Not Found",
                        r#"{"ok":false,"error":"Unknown extension IPC route"}"#,
                    );
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(80));
                    if last_heartbeat_poll.elapsed() >= Duration::from_secs(30) {
                        last_heartbeat_poll = Instant::now();
                        if let Some(url) = resolve_configured_heartbeat_url() {
                            if let Ok(payload) = fetch_remote_heartbeat(&url) {
                                if let Ok(status) = lock_state.update_from_handshake(payload) {
                                    let _ = app.emit("bible-plan-extension-status", &status);
                                }
                            }
                        }
                    }
                }
                Err(err) => {
                    log::warn!("Extension IPC accept error: {}", err);
                    thread::sleep(Duration::from_millis(200));
                }
            }
        }
    });
}

#[tauri::command]
pub fn get_bible_plan_extension_lock(
    lock_state: tauri::State<'_, Arc<ExtensionLockState>>,
) -> Result<ExtensionLockStatus, String> {
    Ok(lock_state.current_status())
}

#[tauri::command]
pub fn set_bible_plan_extension_handshake(
    app: AppHandle,
    lock_state: tauri::State<'_, Arc<ExtensionLockState>>,
    payload: BiblePlanHandshakePayload,
) -> Result<ExtensionLockStatus, String> {
    let status = lock_state.update_from_handshake(payload)?;
    let _ = app.emit("bible-plan-extension-status", &status);
    Ok(status)
}

#[tauri::command]
pub async fn sync_bible_plan_remote_heartbeat(
    app: AppHandle,
    lock_state: tauri::State<'_, Arc<ExtensionLockState>>,
    heartbeat_url: String,
) -> Result<ExtensionLockStatus, String> {
    let state_arc = lock_state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let payload = fetch_remote_heartbeat(&heartbeat_url)?;
        let status = state_arc.update_from_handshake(payload)?;
        let _ = app.emit("bible-plan-extension-status", &status);
        Ok(status)
    })
    .await
    .map_err(|e| format!("Heartbeat task error: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_requires_install_enabled_and_matching_version() {
        let unlinked = evaluate_lock_status(None);
        assert!(!unlinked.unlocked);
        assert_eq!(unlinked.reason, "unlinked");
        assert_eq!(unlinked.message, EXTENSION_LOCK_MESSAGE);

        let disabled = evaluate_lock_status(Some(&BiblePlanHandshakePayload {
            installed_from_bible_plan: true,
            enabled: false,
            app_version: REQUIRED_BIBLE_PLAN_VERSION.to_string(),
            ..Default::default()
        }));
        assert!(!disabled.unlocked);
        assert_eq!(disabled.reason, "disabled_in_bible_plan");

        let outdated = evaluate_lock_status(Some(&BiblePlanHandshakePayload {
            installed_from_bible_plan: true,
            enabled: true,
            app_version: "0.0.0".to_string(),
            ..Default::default()
        }));
        assert!(!outdated.unlocked);
        assert_eq!(outdated.reason, "version_mismatch");

        let active = evaluate_lock_status(Some(&BiblePlanHandshakePayload {
            installed_from_bible_plan: true,
            enabled: true,
            app_version: REQUIRED_BIBLE_PLAN_VERSION.to_string(),
            ..Default::default()
        }));
        assert!(active.unlocked);
        assert_eq!(active.reason, "active");
    }

    #[test]
    fn parses_content_length_case_insensitively() {
        assert_eq!(
            parse_content_length("POST /api/extensions/luminess-handshake HTTP/1.1\r\nHost: 127.0.0.1\r\ncontent-length: 128\r\n"),
            128
        );
        assert_eq!(parse_content_length("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n"), 0);
    }
}
