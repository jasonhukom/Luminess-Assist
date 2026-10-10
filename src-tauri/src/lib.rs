use tauri::Manager;
use tauri::PhysicalPosition;
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};

#[tauri::command]
fn start_drag(window: tauri::Window) {
    let _ = window.start_dragging();
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
      
      // Position window at bottom right
      if let Ok(Some(monitor)) = window.current_monitor() {
          let monitor_size = monitor.size();
          let window_size = window.outer_size().unwrap();
          
          let x = monitor_size.width as i32 - window_size.width as i32 - 20; // 20px padding
          let y = monitor_size.height as i32 - window_size.height as i32 - 60; // 60px padding for taskbar roughly
          
          let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
      }
      
      let _ = window.show();

      // Setup Tray
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let show_i = MenuItem::with_id(app, "show", "Show Mascot", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

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
            }
        })
        .build(app)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![start_drag])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
