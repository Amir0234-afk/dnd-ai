import os
from pathlib import Path
from models.session import SessionState
import json

DEFAULT_SYSTEM_MD_PATH = Path(__file__).parent.parent / "assets" / "system_prompt.md"


def load_md(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_system_prompt(custom_path: str | None) -> str:
    if custom_path and os.path.exists(custom_path):
        return load_md(custom_path)
    return load_md(str(DEFAULT_SYSTEM_MD_PATH))


def load_long_term_memory(storage_path: str, session_id: str, session: "SessionState | None" = None) -> str | None:
    path = Path(storage_path) / session_id / "long_term_memory.md"
    if path.exists():
        return load_md(str(path))
    if session is not None:
        return session.long_term_memory
    return None


def session_to_context(session: SessionState) -> str:
    return json.dumps(session.model_dump(), indent=2, ensure_ascii=False)


def assemble_messages(
    system_prompt: str,
    long_term_memory: str | None,
    session: SessionState,
    user_input: str,
) -> list[dict]:
    system_content = system_prompt

    memory = long_term_memory or session.long_term_memory
    if memory:
        system_content += f"\n\n---\n\n## LONG TERM MEMORY\n\n{memory}"

    system_content += f"\n\n---\n\n## CURRENT SESSION STATE\n\n```json\n{session_to_context(session)}\n```"

    messages = [{"role": "system", "content": system_content}]

    # inject conversation history from turns, skip system turns
    for turn in session.turns:
        if turn.role == "system":
            continue
        role = "user" if turn.role == "user" else "assistant"
        messages.append({"role": role, "content": turn.content})

    messages.append({"role": "user", "content": user_input})

    return messages


def assemble_sync_messages(
    system_prompt: str,
    long_term_memory: str | None,
    session: SessionState,
) -> list[dict]:
    """
    Used for the 10-prompt sync call.
    Asks the LLM to produce an updated MD from long term memory + session so far.
    """
    system_content = system_prompt

    memory = long_term_memory or session.long_term_memory
    if memory:
        system_content += f"\n\n---\n\n## EXISTING LONG TERM MEMORY\n\n{memory}"

    system_content += f"\n\n---\n\n## SESSION SO FAR\n\n```json\n{session_to_context(session)}\n```"

    messages = [
        {"role": "system", "content": system_content},
        {
            "role": "user",
            "content": (
                "Based on the existing long term memory and what has happened in this session so far, "
                "produce an updated long term memory document in markdown. "
                "Keep it concise. Preserve all established lore, characters, and threads. "
                "Add what is new. Do not invent anything that did not happen. "
                "Output only the markdown, nothing else."
            ),
        },
    ]

    return messages


def assemble_end_of_session_messages(
    system_prompt: str,
    long_term_memory: str | None,
    session: SessionState,
) -> list[dict]:
    """
    End of session: synthesize full session JSON into updated long term MD.
    """
    system_content = system_prompt

    memory = long_term_memory or session.long_term_memory
    if memory:
        system_content += f"\n\n---\n\n## EXISTING LONG TERM MEMORY\n\n{memory}"

    system_content += f"\n\n---\n\n## FULL SESSION\n\n```json\n{session_to_context(session)}\n```"

    messages = [
        {"role": "system", "content": system_content},
        {
            "role": "user",
            "content": (
                "The session has ended. Synthesize the existing long term memory and the full session "
                "into a single updated long term memory document in markdown. "
                "This is the definitive record. Be thorough but concise. "
                "Preserve all lore, update all character states, close resolved threads, flag open ones. "
                "Output only the markdown, nothing else."
            ),
        },
    ]

    return messages