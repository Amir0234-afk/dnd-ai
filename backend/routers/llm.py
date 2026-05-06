import json
import re
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.session import SessionState, TurnRole
from services.llm_service import call_llm
from services.memory_service import (
    load_session,
    save_session,
    append_turn,
    should_sync,
    run_sync,
    run_end_of_session,
)
from services.rag_service import (
    load_system_prompt,
    load_long_term_memory,
    assemble_messages,
)
from routers.config import load_config

router = APIRouter()


def _strip_code_fence(text: str) -> str:
    s = text.strip()
    s = re.sub(r'^```[a-z]*\s*', '', s)
    s = re.sub(r'\s*```$', '', s)
    return s.strip()


class PromptRequest(BaseModel):
    session_id: str
    user_input: str


class PromptResponse(BaseModel):
    narrative: str
    updated_session: SessionState
    sync_md: str | None = None  # populated every 10 prompts


class EndSessionRequest(BaseModel):
    session_id: str


class EndSessionResponse(BaseModel):
    updated_md: str


@router.post("/prompt", response_model=PromptResponse)
async def prompt(req: PromptRequest):
    config = load_config()

    try:
        session = load_session(config.storage_path, req.session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.")

    system_prompt = load_system_prompt(config.system_prompt_path)
    long_term_memory = load_long_term_memory(config.storage_path, req.session_id, session)
    messages = assemble_messages(system_prompt, long_term_memory, session, req.user_input)

    try:
        raw_response = await call_llm(config, messages)
    except (httpx.HTTPStatusError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        parsed = json.loads(_strip_code_fence(raw_response))
        narrative = str(parsed.get("narrative", raw_response))
        updated_session_data = parsed.get("session", None)
    except (json.JSONDecodeError, ValueError):
        narrative = raw_response
        updated_session_data = None

    session = append_turn(session, TurnRole.user, req.user_input)
    session = append_turn(session, TurnRole.gm, narrative)

    if updated_session_data and isinstance(updated_session_data, dict):
        for key, value in updated_session_data.items():
            if hasattr(session, key) and key not in ("session_id", "created_at", "turns", "prompt_count"):
                setattr(session, key, value)

    save_session(config.storage_path, session)

    sync_md = None
    if should_sync(session):
        try:
            sync_md = await run_sync(config, session)
        except (httpx.HTTPStatusError, ValueError):
            pass  # sync failure is non-fatal; player can continue

    return PromptResponse(
        narrative=narrative,
        updated_session=session,
        sync_md=sync_md,
    )

@router.post("/end-session", response_model=EndSessionResponse)
async def end_session(req: EndSessionRequest):
    config = load_config()

    try:
        session = load_session(config.storage_path, req.session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found.")

    try:
        updated_md = await run_end_of_session(config, session)
    except (httpx.HTTPStatusError, ValueError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    return EndSessionResponse(updated_md=updated_md)


@router.post("/save-sync-md")
def save_sync_md(session_id: str, content: str):
    from services.memory_service import save_long_term_memory, load_session, save_session
    config = load_config()
    save_long_term_memory(config.storage_path, session_id, content)
    try:
        session = load_session(config.storage_path, session_id)
        session.long_term_memory = content
        save_session(config.storage_path, session)
    except FileNotFoundError:
        pass
    return {"status": "saved"}