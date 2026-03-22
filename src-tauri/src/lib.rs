use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Resolve the platform-specific app data directory for the database
            let data_dir = app.path().app_data_dir().expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create app data dir");
            let db_path = data_dir.join("bus_seating.db");
            let db_url = format!("sqlite:///{}", db_path.display());

            // Spawn the Python backend sidecar, passing the DB URL as an argument
            let sidecar = app
                .shell()
                .sidecar("backend")
                .unwrap()
                .args(["--db-url", &db_url]);
            let (_rx, _child) = sidecar.spawn().expect("Failed to spawn backend sidecar");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
