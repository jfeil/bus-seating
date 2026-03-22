#!/usr/bin/env bash
set -euo pipefail

# --- Determine target triple ---
ARCH=$(uname -m)
case "$(uname -s)" in
  Linux)
    case "$ARCH" in
      x86_64)  TARGET="x86_64-unknown-linux-gnu" ;;
      aarch64) TARGET="aarch64-unknown-linux-gnu" ;;
      *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
    esac
    ;;
  Darwin)
    case "$ARCH" in
      x86_64)  TARGET="x86_64-apple-darwin" ;;
      arm64)   TARGET="aarch64-apple-darwin" ;;
      *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    TARGET="x86_64-pc-windows-msvc"
    ;;
  *)
    echo "Unsupported OS"; exit 1
    ;;
esac

echo "==> Building for target: $TARGET"

# --- Check prerequisites ---
command -v uv   >/dev/null || { echo "Error: uv not found. Install from https://docs.astral.sh/uv/"; exit 1; }
command -v node >/dev/null || { echo "Error: node not found. Install Node.js 20+"; exit 1; }
command -v cargo >/dev/null || { echo "Error: cargo not found. Install Rust via https://rustup.rs"; exit 1; }

if [[ "$(uname -s)" == "Linux" ]]; then
  for pkg in libwebkit2gtk-4.1-dev librsvg2-dev patchelf; do
    dpkg -s "$pkg" >/dev/null 2>&1 || { echo "Error: missing $pkg — install with: sudo apt install $pkg"; exit 1; }
  done
  # Either libayatana-appindicator3-dev (newer) or libappindicator3-dev (older)
  if ! dpkg -s libayatana-appindicator3-dev >/dev/null 2>&1 && ! dpkg -s libappindicator3-dev >/dev/null 2>&1; then
    echo "Error: missing appindicator — install with: sudo apt install libayatana-appindicator3-dev"
    exit 1
  fi
fi

# --- 1. Build Python backend sidecar ---
echo "==> Building Python backend sidecar..."
uv sync
uv pip install pyinstaller

if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  SEP=";"
else
  SEP=":"
fi

uv run pyinstaller \
  --onefile \
  --name backend \
  --add-data "app${SEP}app" \
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

mkdir -p src-tauri/binaries
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  cp dist/backend.exe "src-tauri/binaries/backend-${TARGET}.exe"
else
  cp dist/backend "src-tauri/binaries/backend-${TARGET}"
fi

# --- 2. Install frontend dependencies ---
echo "==> Installing frontend dependencies..."
cd frontend
npm ci
cd ..

# --- 3. Install Tauri CLI if needed ---
if ! cargo tauri --version >/dev/null 2>&1; then
  echo "==> Installing tauri-cli..."
  cargo install tauri-cli --locked
fi

# --- 4. Pre-download AppImage tools (Linux) ---
if [[ "$(uname -s)" == "Linux" ]]; then
  TOOLS_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/tauri"
  mkdir -p "$TOOLS_DIR"

  download_tool() {
    local dest="$1" url="$2"
    if [[ -f "$dest" ]]; then return 0; fi
    echo "    Downloading $(basename "$dest")..."
    for attempt in 1 2 3 4 5; do
      if curl -fSL --connect-timeout 15 --max-time 120 -o "$dest" "$url"; then
        chmod +x "$dest"
        return 0
      fi
      echo "    Attempt $attempt failed, retrying in 10s..."
      rm -f "$dest"
      sleep 10
    done
    echo "Error: failed to download $(basename "$dest")"
    return 1
  }

  echo "==> Pre-downloading AppImage tools..."
  download_tool "$TOOLS_DIR/AppRun-x86_64" \
    "https://github.com/tauri-apps/binary-releases/releases/download/apprun-old/AppRun-x86_64" || exit 1
  download_tool "$TOOLS_DIR/linuxdeploy-x86_64.AppImage" \
    "https://github.com/tauri-apps/binary-releases/releases/download/linuxdeploy/linuxdeploy-x86_64.AppImage" || exit 1
  download_tool "$TOOLS_DIR/linuxdeploy-plugin-gtk.sh" \
    "https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh" || exit 1
  download_tool "$TOOLS_DIR/linuxdeploy-plugin-gstreamer.sh" \
    "https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gstreamer/master/linuxdeploy-plugin-gstreamer.sh" || exit 1
  # Optional — linuxdeploy has a built-in fallback
  download_tool "$TOOLS_DIR/linuxdeploy-plugin-appimage-x86_64.AppImage" \
    "https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-x86_64.AppImage" || true
fi

# --- 5. Build Tauri app ---
echo "==> Building Tauri app..."
cargo tauri build --target "$TARGET"

echo ""
echo "==> Build complete! Artifacts in src-tauri/target/${TARGET}/release/bundle/"
