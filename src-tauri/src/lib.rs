// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn _is_obstacle(left: i32, top: i32, right: i32, bottom: i32, screen_w: i32, ground_y: i32) -> bool {
    (right - left) > 80
        && (bottom - top) > 60
        && !((right - left) >= screen_w - 4 && (bottom - top) >= ground_y - 4)
}

#[tauri::command]
fn get_obstacles(screen_w: i32, ground_y: i32) -> Vec<(i32, i32, i32, i32)> {
    // TODO: picks up real windows
    // Windows: Win32 EnumWindows + GetWindowRect
    // macOS: Quartz CGWindowListCopyWindowInfo (needs Screen Recording permission)
    // For now return empty -> pets crawl on ground only, keeps first version stable
    let _ = (screen_w, ground_y);
    Vec::new()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_obstacles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
