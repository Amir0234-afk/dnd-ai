from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

app = FastAPI(title="DnD AI Game Master")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import config, session, llm, files
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

@app.get("/api/health")
def health():
    return {"status": "ok"}

static_path = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_path):
    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")