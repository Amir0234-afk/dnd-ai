import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
import httpx
from models.config import AppConfig 

router = APIRouter()

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def load_config() -> AppConfig:
    if not CONFIG_PATH.exists():
        raise HTTPException(status_code=404, detail="Config not found. Run setup first.")
    with open(CONFIG_PATH, "r") as f:
        return AppConfig(**json.load(f))


def save_config(config: AppConfig):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config.model_dump(), f, indent=2)


@router.get("/", response_model=AppConfig)
def get_config():
    return load_config()


@router.post("/", response_model=AppConfig)
def set_config(config: AppConfig):
    save_config(config)
    return config


@router.get("/exists")
def config_exists():
    return {"exists": CONFIG_PATH.exists()}

@router.get("/ollama-models")
async def get_ollama_models(base_url: str = "http://localhost:11434"):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{base_url}/api/tags")
            response.raise_for_status()
            models = [m["name"] for m in response.json().get("models", [])]
            return {"models": models}
    except Exception:
        return {"models": []}


@router.get("/google-models")
async def get_google_models(api_key: str = ""):
    if not api_key:
        return {"models": []}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=100"
            )
            response.raise_for_status()
            models = [
                m["name"].replace("models/", "")
                for m in response.json().get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            return {"models": models}
    except Exception:
        return {"models": []}


@router.get("/openai-models")
async def get_openai_models(api_key: str = "", base_url: str = "https://api.openai.com/v1"):
    if not api_key:
        return {"models": []}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            ids = sorted(
                [m["id"] for m in response.json().get("data", [])
                 if any(m["id"].startswith(p) for p in ("gpt-", "o1", "o3", "o4", "chatgpt"))],
                reverse=True,
            )
            return {"models": ids}
    except Exception:
        return {"models": []}


@router.get("/anthropic-models")
async def get_anthropic_models(api_key: str = ""):
    if not api_key:
        return {"models": []}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
            )
            response.raise_for_status()
            models = [m["id"] for m in response.json().get("data", [])]
            return {"models": models}
    except Exception:
        return {"models": []}