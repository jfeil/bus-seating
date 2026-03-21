use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn the Python backend as a sidecar process
            let shell = app.shell();
            let sidecar = shell.sidecar("backend").unwrap();
            let (mut _rx, _child) = sidecar.spawn().expect("Failed to spawn backend sidecar");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
