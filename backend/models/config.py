from pydantic import BaseModel
from typing import Optional
from enum import Enum

class LLMProvider(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    google = "google"
    ollama = "ollama"
    custom = "custom"

class LLMConfig(BaseModel):
    provider: LLMProvider
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # for ollama or any custom endpoint
    temperature: float = 0.9
    max_tokens: int = 2048

class AppConfig(BaseModel):
    llm: LLMConfig
    storage_path: str  # absolute path user chooses
    system_prompt_path: Optional[str] = None  # custom system MD, falls back to default