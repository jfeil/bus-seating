import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import assignments, bus_templates, buses, days, groups, seasons


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Bus Seating", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(seasons.router)
app.include_router(days.router)
app.include_router(buses.router)
app.include_router(bus_templates.router)
app.include_router(groups.router)
app.include_router(assignments.router)

# Serve Angular frontend if the static files are bundled alongside the app
_static_env = os.environ.get("BUS_SEATING_STATIC_DIR", "")
_static_dir = Path(_static_env) if _static_env else None
if not _static_dir or not _static_dir.is_dir():
    # Check relative to this file (PyInstaller bundle layout)
    _static_dir = Path(__file__).parent / "static"
if _static_dir.is_dir():
    from starlette.responses import FileResponse

    _index_html = (_static_dir / "index.html").resolve()

    class SPAStaticFiles(StaticFiles):
        """StaticFiles that falls back to index.html for Angular SPA routing."""
        async def get_response(self, path: str, scope):
            try:
                return await super().get_response(path, scope)
            except Exception:
                return FileResponse(str(_index_html))

    app.mount("/", SPAStaticFiles(directory=str(_static_dir.resolve()), html=True), name="static")
