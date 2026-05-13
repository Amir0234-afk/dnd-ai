# D&D AI Game Master

A solo tabletop RPG experience powered by large language models. The LLM acts as your Game Master — narrating the world, responding to your actions, tracking session state, and maintaining persistent long-term memory across sessions.

## Features

- **Any LLM provider** — OpenAI, Anthropic, Google Gemini, Ollama (local), or a custom endpoint
- **Dynamic model discovery** — model dropdowns auto-populate from your API key so you always see what's available
- **Persistent memory** — long-term memory is synthesized every 10 prompts and at session end, stored both server-side and in the browser
- **Character creation** — guided wizard with stat rolling, skill selection, and backstory
- **Session management** — resume previous sessions; memory is embedded in the session so the GM always remembers your story
- **Page transitions & URL routing** — browser back/forward works; animated page transitions

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · uvicorn · httpx |
| Frontend | React 19 · TypeScript · Vite · react-router-dom v7 |
| LLMs | OpenAI API · Anthropic API · Google Gemini API · Ollama |

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp config.example.json config.json   # then edit with your provider/key
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs at `http://localhost:5173`.

### Config (`backend/config.json`)

```json
{
  "llm": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "api_key": "YOUR_API_KEY",
    "base_url": null,
    "temperature": 0.9,
    "max_tokens": 2048
  },
  "storage_path": "./data",
  "system_prompt_path": null
}
```

**Providers:** `openai` · `anthropic` · `google` · `ollama` · `custom`

For `ollama`, set `base_url` to your Ollama host (default `http://localhost:11434`) and leave `api_key` empty.  
For `custom`, set `base_url` to any OpenAI-compatible endpoint.

### Docker (self-hosting)

The easiest way to run the full stack. The image builds the frontend and serves everything from a single container on port **7432**.

```bash
git clone https://github.com/Amir0234-afk/dnd-ai.git
cd dnd-ai
docker compose up --build -d
```

Then open `http://localhost:7432`, go to **Settings**, enter your LLM provider and API key, and start playing. Session data is stored in a named Docker volume (`dnd_data`) and persists across restarts.

**Change the port**

Copy `.env.example` to `.env` and set `HOST_PORT`:

```bash
cp .env.example .env
# edit .env — e.g. HOST_PORT=9000
docker compose up --build -d
```

**Expose publicly (reverse proxy)**

Point nginx / Caddy / Traefik at the container. Example Caddy config:

```
yourdomain.com {
    reverse_proxy localhost:7432
}
```

**Useful commands**

```bash
docker compose logs -f          # live logs
docker compose down             # stop
docker compose down -v          # stop and delete session data
docker compose pull && docker compose up -d --build   # update
```

## Project Structure

```
dnd-ai/
├── backend/
│   ├── assets/system_prompt.md   # GM instructions sent to the LLM
│   ├── models/                   # Pydantic models (session, config)
│   ├── routers/                  # FastAPI route handlers
│   ├── services/                 # LLM, memory, and RAG logic
│   ├── config.example.json
│   └── main.py
└── frontend/
    └── src/
        ├── pages/                # Lobby, Game, Setup, CharacterCreation
        ├── services/api.ts       # Axios API client
        ├── types/index.ts
        └── utils/localMemory.ts  # Browser localStorage cache
```

## Customising the GM

Edit `backend/assets/system_prompt.md` to change how the GM behaves — tone, rules system, world style, house rules, etc. You can also point `system_prompt_path` in `config.json` at any other markdown file.

## Contributing

Issues and suggestions are welcome! If you have an idea, a bug report, or a feature request, open an issue on [GitHub Issues](https://github.com/Amir0234-afk/dnd-ai/issues) and I'll take a look.

## License

MIT — see [LICENSE](LICENSE).
