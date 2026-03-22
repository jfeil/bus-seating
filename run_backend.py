"""Entry point for the bundled backend sidecar."""
import argparse
import os
import socket
import sys

import uvicorn


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", help="SQLAlchemy database URL")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (0 = auto)")
    parser.add_argument("--standalone", action="store_true",
                        help="Standalone mode: open browser and serve frontend")
    args = parser.parse_args()

    if args.db_url:
        os.environ["BUS_SEATING_DATABASE_URL"] = args.db_url

    port = args.port if args.port else find_free_port()

    # Detect standalone mode: static files bundled alongside the app, or --standalone flag
    from pathlib import Path
    _static_check = Path(__file__).parent / "app" / "static"
    # PyInstaller sets sys._MEIPASS for bundled apps
    if hasattr(sys, '_MEIPASS'):
        _static_check = Path(sys._MEIPASS) / "app" / "static"

    is_standalone = args.standalone or _static_check.is_dir()

    if is_standalone:
        # Standalone mode: set up DB in user data dir and open browser
        import platform
        import webbrowser

        if not args.db_url:
            if platform.system() == "Linux":
                data_dir = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "bus-seating"
            elif platform.system() == "Darwin":
                data_dir = Path.home() / "Library" / "Application Support" / "bus-seating"
            else:
                data_dir = Path(os.environ.get("APPDATA", Path.home())) / "bus-seating"

            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = data_dir / "bus_seating.db"
            os.environ["BUS_SEATING_DATABASE_URL"] = f"sqlite:///{db_path}"

        url = f"http://127.0.0.1:{port}"
        print(f"Bus Seating Planner running at {url}", flush=True)
        print("Press Ctrl+C to stop.", flush=True)
        webbrowser.open(url)
    else:
        # Sidecar mode: signal port to parent process (Tauri reads this from stdout)
        print(f"BACKEND_PORT:{port}", flush=True)

    uvicorn.run("app.main:app", host="127.0.0.1", port=port)
