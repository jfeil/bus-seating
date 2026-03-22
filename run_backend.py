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
    args = parser.parse_args()

    if args.db_url:
        os.environ["BUS_SEATING_DATABASE_URL"] = args.db_url

    port = args.port if args.port else find_free_port()

    # Signal the port to the parent process (Tauri reads this from stdout)
    print(f"BACKEND_PORT:{port}", flush=True)

    uvicorn.run("app.main:app", host="127.0.0.1", port=port)
