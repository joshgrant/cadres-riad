//! Photos handed to the app by the system: dropped on the Dock icon or opened
//! with "Ouvrir avec" (macOS), or dropped on the .exe or its shortcut (Windows).
//! The UI is told with an `open-files` event, then pulls each file's bytes.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

const IMAGE_EXTENSIONS: [&str; 6] = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

#[derive(Default)]
pub struct OpenedFiles {
  queue: Mutex<Vec<PathBuf>>,
  /// Paths the system gave us; only these can be read back by the UI.
  allowed: Mutex<HashSet<PathBuf>>,
}

pub fn is_image(path: &std::path::Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .is_some_and(|ext| IMAGE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
}

pub fn queue(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
  let paths: Vec<PathBuf> = paths.into_iter().filter(|p| p.is_file() && is_image(p)).collect();
  if paths.is_empty() {
    return;
  }
  let state = app.state::<OpenedFiles>();
  state.allowed.lock().unwrap().extend(paths.iter().cloned());
  state.queue.lock().unwrap().extend(paths);
  let _ = app.emit("open-files", ());
}

/// Command-line arguments that are image files (Windows passes dropped files this way).
pub fn from_args(args: impl IntoIterator<Item = String>) -> Vec<PathBuf> {
  args.into_iter().skip(1).map(PathBuf::from).collect()
}

/// The most recent file the system opened, if any. Older ones are dropped:
/// the editor holds one photo at a time.
#[tauri::command]
pub fn take_opened_path(state: tauri::State<'_, OpenedFiles>) -> Option<String> {
  let mut queue = state.queue.lock().unwrap();
  let last = queue.pop();
  queue.clear();
  last.map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_opened_file(path: String, state: tauri::State<'_, OpenedFiles>) -> Result<tauri::ipc::Response, String> {
  let path = PathBuf::from(path);
  if !state.allowed.lock().unwrap().contains(&path) {
    return Err("not an opened file".into());
  }
  std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|error| error.to_string())
}
