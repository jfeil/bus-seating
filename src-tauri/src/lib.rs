use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Enable hardware-accelerated rendering in WebKitGTK (Linux)
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Resolve the platform-specific app data directory for the database
            let data_dir = app.path().app_data_dir().expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create app data dir");
            let db_path = data_dir.join("bus_seating.db");
            let db_url = format!("sqlite:///{}", db_path.display());

            // Spawn the Python backend sidecar with auto port
            let sidecar = app
                .shell()
                .sidecar("backend")
                .unwrap()
                .args(["--db-url", &db_url]);
            let (mut rx, _child) = sidecar.spawn().expect("Failed to spawn backend sidecar");

            // Read stdout to get the assigned port, then inject it into the webview
            let main_window = app.get_webview_window("main").unwrap();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = &event {
                        let line = String::from_utf8_lossy(line);
                        if let Some(port_str) = line.trim().strip_prefix("BACKEND_PORT:") {
                            let port = port_str.trim();
                            let js = format!("window.__BACKEND_PORT__ = {};", port);
                            let _ = main_window.eval(&js);
                            break;
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
