from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from routers.config import load_config

router = APIRouter()


@router.post("/upload-md/{session_id}")
async def upload_md(session_id: str, file: UploadFile = File(...)):
    config = load_config()
    text = (await file.read()).decode("utf-8")
    path = Path(config.storage_path) / session_id / "long_term_memory.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    try:
        from services.memory_service import load_session, save_session
        session = load_session(config.storage_path, session_id)
        session.long_term_memory = text
        save_session(config.storage_path, session)
    except FileNotFoundError:
        pass
    return {"status": "saved", "path": str(path)}


@router.get("/md/{session_id}", response_class=PlainTextResponse)
def get_md(session_id: str):
    config = load_config()
    path = Path(config.storage_path) / session_id / "long_term_memory.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No long term memory found for this session.")
    return path.read_text(encoding="utf-8")


@router.put("/md/{session_id}", response_class=PlainTextResponse)
def save_md(session_id: str, content: str):
    config = load_config()
    path = Path(config.storage_path) / session_id / "long_term_memory.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    try:
        from services.memory_service import load_session, save_session
        session = load_session(config.storage_path, session_id)
        session.long_term_memory = content
        save_session(config.storage_path, session)
    except FileNotFoundError:
        pass
    return content


@router.get("/sessions")
def list_sessions():
    config = load_config()
    storage = Path(config.storage_path)
    if not storage.exists():
        return {"sessions": []}
    sessions = [
        d.name for d in storage.iterdir()
        if d.is_dir() and (d / "session.json").exists()
    ]
    return {"sessions": sessions}


@router.get("/session-json/{session_id}")
def get_session_json(session_id: str):
    config = load_config()
    path = Path(config.storage_path) / session_id / "session.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found.")
    import json
    with open(path, "r") as f:
        return json.load(f)
    

@router.get("/browse")
def browse(path: str = ""):
    import os
    if not path:
        # return drive roots on Windows, / on Unix
        if os.name == "nt":
            import string
            drives = [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
            return {"current": "", "dirs": drives, "is_root": True}
        path = "/"
    
    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    try:
        entries = os.listdir(path)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    dirs = sorted([
        e for e in entries
        if os.path.isdir(os.path.join(path, e)) and not e.startswith(".")
    ])
    
    parent = os.path.dirname(path) if path != os.path.dirname(path) else None
    
    return {
        "current": path,
        "parent": parent,
        "dirs": dirs,
        "is_root": False,
    }