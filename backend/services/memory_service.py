import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from models.session import SessionState, Turn, TurnRole
from models.config import AppConfig
from services.rag_service import (
    load_system_prompt,
    load_long_term_memory,
    assemble_sync_messages,
    assemble_end_of_session_messages,
)
from services.llm_service import call_llm


def get_session_dir(storage_path: str, session_id: str) -> Path:
    path = Path(storage_path) / session_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def create_session(storage_path: str) -> SessionState:
    session_id = str(uuid4())
    session = SessionState(
        session_id=session_id,
        created_at=datetime.utcnow().isoformat(),
    )
    save_session(storage_path, session)
    return session


def load_session(storage_path: str, session_id: str) -> SessionState:
    path = get_session_dir(storage_path, session_id) / "session.json"
    with open(path, "r", encoding="utf-8") as f:
        return SessionState(**json.load(f))


def save_session(storage_path: str, session: SessionState):
    path = get_session_dir(storage_path, session.session_id) / "session.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(session.model_dump(), f, indent=2, ensure_ascii=False)


def save_long_term_memory(storage_path: str, session_id: str, content: str):
    path = get_session_dir(storage_path, session_id) / "long_term_memory.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def archive_session(storage_path: str, session: SessionState):
    """Keep a timestamped archive of the session JSON at end of session."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = get_session_dir(storage_path, session.session_id) / f"archive_{timestamp}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(session.model_dump(), f, indent=2, ensure_ascii=False)


def append_turn(session: SessionState, role: TurnRole, content: str) -> SessionState:
    turn = Turn(
        role=role,
        content=content,
        timestamp=datetime.utcnow().isoformat(),
    )
    session.turns.append(turn)
    session.prompt_count += 1
    return session


def should_sync(session: SessionState) -> bool:
    return session.prompt_count > 0 and session.prompt_count % 10 == 0


async def run_sync(config: AppConfig, session: SessionState) -> str:
    system_prompt = load_system_prompt(config.system_prompt_path)
    long_term_memory = load_long_term_memory(config.storage_path, session.session_id, session)
    messages = assemble_sync_messages(system_prompt, long_term_memory, session)
    result = await call_llm(config, messages)
    return result


async def run_end_of_session(config: AppConfig, session: SessionState) -> str:
    system_prompt = load_system_prompt(config.system_prompt_path)
    long_term_memory = load_long_term_memory(config.storage_path, session.session_id, session)
    messages = assemble_end_of_session_messages(system_prompt, long_term_memory, session)
    result = await call_llm(config, messages)
    save_long_term_memory(config.storage_path, session.session_id, result)
    session.long_term_memory = result
    save_session(config.storage_path, session)
    archive_session(config.storage_path, session)
    return result