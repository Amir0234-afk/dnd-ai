from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum

class TurnRole(str, Enum):
    user = "user"
    gm = "gm"
    system = "system"

class Turn(BaseModel):
    role: TurnRole
    content: str
    timestamp: str

class Roll(BaseModel):
    check_name: str
    formula: str
    result: int
    target: Optional[int] = None
    success: Optional[bool] = None
    timestamp: str

class SessionState(BaseModel):
    session_id: str
    created_at: str
    prompt_count: int = 0
    characters: dict[str, Any] = {}
    world: dict[str, Any] = {}
    events: list[str] = []
    open_threads: list[str] = []
    inventory: dict[str, Any] = {}
    rolls: list[Roll] = []
    turns: list[Turn] = []
    long_term_memory: Optional[str] = None