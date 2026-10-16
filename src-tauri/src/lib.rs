use std::sync::OnceLock;
use tauri::Manager;

mod accent;
mod opened;

/// The native material behind the transparent webview: "sidebar" (macOS vibrancy),
/// "mica" (Windows 11) or "none". The UI paints opaque backgrounds when it's "none".
static WINDOW_MATERIAL: OnceLock<&'static str> = OnceLock::new();

#[tauri::command]
fn window_material() -> &'static str {
  WINDOW_MATERIAL.get().copied().unwrap_or("none")
}

/// The user's system accent colour as `#rrggbb`, or None where unavailable.
#[tauri::command]
fn system_accent_color() -> Option<String> {
  accent::system_accent_color()
}

fn apply_window_material(window: &tauri::WebviewWindow) -> &'static str {
  #[cfg(target_os = "macos")]
  {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
    if apply_vibrancy(window, NSVisualEffectMaterial::Sidebar, Some(NSVisualEffectState::FollowsWindowActiveState), None).is_ok() {
      return "sidebar";
    }
  }
  #[cfg(target_os = "windows")]
  {
    // Mica exists on Windows 11 only; Windows 10 gets opaque colours instead.
    if window_vibrancy::apply_mica(window, None).is_ok() {
      return "mica";
    }
  }
  let _ = window;
  "none"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // First, so a second launch (a photo dropped on the shortcut) hands its files to this one.
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      opened::queue(app, opened::from_args(argv));
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(opened::OpenedFiles::default())
    .invoke_handler(tauri::generate_handler![
      window_material,
      system_accent_color,
      opened::take_opened_path,
      opened::read_opened_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      if let Some(window) = app.get_webview_window("main") {
        let _ = WINDOW_MATERIAL.set(apply_window_material(&window));
      }
      opened::queue(app.handle(), opened::from_args(std::env::args()));
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app, _event| {
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Opened { urls } = _event {
        opened::queue(_app, urls.into_iter().filter_map(|url| url.to_file_path().ok()));
      }
    });
}
