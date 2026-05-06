import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setConfig, getConfig, getOllamaModels, getGoogleModels, getOpenAIModels, getAnthropicModels, browsePath } from "../services/api";
import type { AppConfig, LLMProvider } from "../types";

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "custom", label: "Custom endpoint" },
];

const CLOUD_MODELS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  google: ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
  ollama: [],
  custom: [],
};

interface BrowserProps {
  current: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

function PathBrowser({ current, onSelect, onClose }: BrowserProps) {
  const [data, setData] = useState<{
    current: string;
    parent: string | null;
    dirs: string[];
    is_root: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (path?: string) => {
    setLoading(true);
    try {
      const res = await browsePath(path);
      setData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(current || undefined);
  }, []);

  return (
    <div className="browser-overlay">
      <div className="browser-panel">
        <div className="browser-header">
          <h3>Select Folder</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="browser-path">
          {data?.current || "Loading..."}
        </div>
        <div className="browser-list">
          {loading && <div className="browser-loading">Loading...</div>}
          {data?.parent && (
            <div className="browser-item parent" onClick={() => load(data.parent ?? undefined)}>
              ← ..
            </div>
          )}
          {data?.dirs.map((dir) => (
            <div
              key={dir}
              className="browser-item"
              onClick={() => {
                const next = data.is_root ? dir : `${data.current}\\${dir}`;
                load(next);
              }}
            >
              📁 {dir}
            </div>
          ))}
        </div>
        <div className="browser-footer">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!data?.current}
            onClick={() => {
              if (data?.current) onSelect(data.current);
              onClose();
            }}
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();

  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [model, setModel] = useState(CLOUD_MODELS["openai"][0]);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [storagePath, setStoragePath] = useState("/data");
  const [systemPromptPath, setSystemPromptPath] = useState("");
  const [temperature, setTemperature] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [browserTarget, setBrowserTarget] = useState<"storage" | "system" | null>(null);

  useEffect(() => {
    getConfig()
      .then((res) => {
        const cfg = res.data;
        setProvider(cfg.llm.provider);
        setModel(cfg.llm.model);
        setApiKey(cfg.llm.api_key || "");
        setBaseUrl(cfg.llm.base_url || "");
        setStoragePath(cfg.storage_path);
        setSystemPromptPath(cfg.system_prompt_path || "");
        setTemperature(cfg.llm.temperature);
        setMaxTokens(cfg.llm.max_tokens);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDynamicModels([]);
    let cancelled = false;

    const fetch = async () => {
      let models: string[] = [];
      try {
        if (provider === "ollama") {
          const res = await getOllamaModels(baseUrl || undefined);
          models = res.data.models;
        } else if (provider === "google" && apiKey) {
          const res = await getGoogleModels(apiKey);
          models = res.data.models;
        } else if (provider === "openai" && apiKey) {
          const res = await getOpenAIModels(apiKey, baseUrl || undefined);
          models = res.data.models;
        } else if (provider === "anthropic" && apiKey) {
          const res = await getAnthropicModels(apiKey);
          models = res.data.models;
        }
      } catch {
        models = [];
      }
      if (!cancelled) {
        setDynamicModels(models);
        if (models.length > 0) setModel(models[0]);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [provider, apiKey, baseUrl]);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    if (CLOUD_MODELS[p].length > 0) setModel(CLOUD_MODELS[p][0]);
    else setModel("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const config: AppConfig = {
        llm: {
          provider,
          model,
          api_key: apiKey || undefined,
          base_url: baseUrl || undefined,
          temperature,
          max_tokens: maxTokens,
        },
        storage_path: storagePath,
        system_prompt_path: systemPromptPath || undefined,
      };
      await setConfig(config);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || "/lobby");
    } catch {
      setError("Failed to save config. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const needsApiKey = provider !== "ollama" && provider !== "custom";
  const needsBaseUrl = provider === "ollama" || provider === "custom";
  const needsKeyToLoadModels = provider === "google" || provider === "openai" || provider === "anthropic";
  const models = dynamicModels.length > 0 ? dynamicModels : CLOUD_MODELS[provider];

  return (
    <div className="setup">
      <h1>Settings</h1>

      <section>
        <h2>LLM Provider</h2>
        <div className="provider-grid">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              className={provider === p.value ? "active" : ""}
              onClick={() => handleProviderChange(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {needsBaseUrl && (
        <section>
          <h2>Base URL</h2>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === "ollama"
                ? "http://localhost:11434/v1"
                : "https://your-endpoint.com/v1"
            }
          />
        </section>
      )}

      {needsApiKey && (
        <section>
          <h2>API Key</h2>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your API key"
          />
        </section>
      )}

      <section>
        <h2>Model</h2>
        {provider === "custom" ? (
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Enter model name"
          />
        ) : needsKeyToLoadModels && !apiKey ? (
          <div className="ollama-empty">Enter your API key above to load available models.</div>
        ) : provider === "ollama" && dynamicModels.length === 0 ? (
          <div className="ollama-empty">
            No models detected. Make sure Ollama is running and has models installed.
            <code>ollama pull llama3</code>
          </div>
        ) : (
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m: string) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </section>

      <section>
        <h2>Storage Path</h2>
        <div className="path-row">
          <input
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="D:\my-campaign-data"
          />
          <button onClick={() => setBrowserTarget("storage")}>Browse</button>
        </div>
        <small>Where session files and memory will be saved.</small>
      </section>

      <section>
        <h2>Custom System Prompt (optional)</h2>
        <div className="path-row">
          <input
            value={systemPromptPath}
            onChange={(e) => setSystemPromptPath(e.target.value)}
            placeholder="Leave empty for default D&D 5.5e prompt"
          />
          <button onClick={() => setBrowserTarget("system")}>Browse</button>
        </div>
      </section>

      <section>
        <h2>Advanced</h2>
        <label>
          Temperature: {temperature}
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Max Tokens: {maxTokens}
          <input
            type="range"
            min={512}
            max={4096}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
          />
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      <button className="primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Save & Continue"}
      </button>

      {browserTarget && (
        <PathBrowser
          current={browserTarget === "storage" ? storagePath : systemPromptPath}
          onSelect={(path) => {
            if (browserTarget === "storage") setStoragePath(path);
            else setSystemPromptPath(path);
          }}
          onClose={() => setBrowserTarget(null)}
        />
      )}
    </div>
  );
}
