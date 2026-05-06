from fastapi import APIRouter, HTTPException
from models.session import SessionState
from models.config import AppConfig
from services.memory_service import create_session, load_session, save_session
from routers.config import load_config

router = APIRouter()


@router.post("/new", response_model=SessionState)
def new_session():
    config = load_config()
    session = create_session(config.storage_path)
    return session


@router.get("/{session_id}", response_model=SessionState)
def get_session(session_id: str):
    config = load_config()
    try:
        return load_session(config.storage_path, session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.")


@router.put("/{session_id}", response_model=SessionState)
def update_session(session_id: str, session: SessionState):
    config = load_config()
    save_session(config.storage_path, session)
    return session