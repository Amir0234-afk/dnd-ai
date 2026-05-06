import httpx
from models.config import AppConfig, LLMProvider
import os


def _get_proxy() -> str | None:
    return os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or None


def _raise_for_status(response: httpx.Response) -> None:
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise httpx.HTTPStatusError(
            f"{e.response.status_code} from {e.request.url}: {e.response.text}",
            request=e.request,
            response=e.response,
        ) from e

async def call_llm(config: AppConfig, messages: list[dict]) -> str:
    provider = config.llm.provider

    if provider == LLMProvider.openai:
        return await _call_openai_compatible(
            base_url="https://api.openai.com/v1",
            api_key=config.llm.api_key or "",
            model=config.llm.model,
            messages=messages,
            temperature=config.llm.temperature,
            max_tokens=config.llm.max_tokens,
        )

    elif provider == LLMProvider.anthropic:
        return await _call_anthropic(config, messages)

    elif provider == LLMProvider.google:
        return await _call_google(config, messages)

    elif provider == LLMProvider.ollama:
        return await _call_openai_compatible(
            base_url=config.llm.base_url or "http://localhost:11434/v1",
            api_key="ollama",
            model=config.llm.model,
            messages=messages,
            temperature=config.llm.temperature,
            max_tokens=config.llm.max_tokens,
        )

    elif provider == LLMProvider.custom:
        return await _call_openai_compatible(
            base_url=config.llm.base_url or "",
            api_key=config.llm.api_key or "none",
            model=config.llm.model,
            messages=messages,
            temperature=config.llm.temperature,
            max_tokens=config.llm.max_tokens,
        )

    else:
        raise ValueError(f"Unsupported provider: {provider}")


async def _call_openai_compatible(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    
) -> str:
    async with httpx.AsyncClient(timeout=60, proxy=_get_proxy()) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        _raise_for_status(response)
        return str(response.json()["choices"][0]["message"]["content"])


async def _call_anthropic(config: AppConfig, messages: list[dict]) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    filtered = [m for m in messages if m["role"] != "system"]

    payload: dict = {
        "model": config.llm.model,
        "max_tokens": config.llm.max_tokens,
        "messages": filtered,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=60, proxy=_get_proxy()) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.llm.api_key or "",
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        _raise_for_status(response)
        return str(response.json()["content"][0]["text"])


async def _call_google(config: AppConfig, messages: list[dict]) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    filtered = [m for m in messages if m["role"] != "system"]

    contents = []
    for m in filtered:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature": config.llm.temperature,
            "maxOutputTokens": config.llm.max_tokens,
        },
    }
    if system:
        payload["system_instruction"] = {"parts": [{"text": system}]}

    async with httpx.AsyncClient(timeout=60, proxy=_get_proxy()) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{config.llm.model}:generateContent?key={config.llm.api_key or ''}",
            json=payload,
        )
        _raise_for_status(response)
        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates or "content" not in candidates[0]:
            finish = candidates[0].get("finishReason", "UNKNOWN") if candidates else "NO_CANDIDATES"
            raise ValueError(f"Google returned no content (finishReason={finish}). Full response: {data}")
        return str(candidates[0]["content"]["parts"][0]["text"])