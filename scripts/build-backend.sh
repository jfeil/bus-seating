#!/bin/bash
# Build the Python backend into a standalone executable using PyInstaller
set -e

cd "$(dirname "$0")/.."

# Install pyinstaller if not present
uv pip install pyinstaller

# Create a single-file executable
uv run pyinstaller \
  --onefile \
  --name backend \
  --add-data "app:app" \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import app.main \
  --collect-submodules app \
  run_backend.py

# Copy to Tauri sidecar location
mkdir -p src-tauri/binaries
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
if [ "$OS" = "darwin" ]; then
  TARGET="${ARCH}-apple-darwin"
elif [ "$OS" = "linux" ]; then
  TARGET="${ARCH}-unknown-linux-gnu"
else
  TARGET="${ARCH}-pc-windows-msvc"
fi
cp dist/backend "src-tauri/binaries/backend-${TARGET}"
echo "Backend binary copied to src-tauri/binaries/backend-${TARGET}"
