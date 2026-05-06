import axios from "axios";
import type {
  AppConfig,
  SessionState,
  PromptResponse,
  EndSessionResponse,
} from "../types";

const api = axios.create({
  baseURL: "/api",
});

// config
export const getConfig = () => api.get<AppConfig>("/config/");
export const setConfig = (config: AppConfig) => api.post<AppConfig>("/config/", config);
export const configExists = () => api.get<{ exists: boolean }>("/config/exists");

// session
export const newSession = () => api.post<SessionState>("/session/new");
export const getSession = (id: string) => api.get<SessionState>(`/session/${id}`);
export const updateSession = (id: string, session: SessionState) =>
  api.put<SessionState>(`/session/${id}`, session);

// llm
export const sendPrompt = (session_id: string, user_input: string) =>
  api.post<PromptResponse>("/llm/prompt", { session_id, user_input });

export const endSession = (session_id: string) =>
  api.post<EndSessionResponse>("/llm/end-session", { session_id });

export const saveSyncMd = (session_id: string, content: string) =>
  api.post("/llm/save-sync-md", null, { params: { session_id, content } });

// files
export const uploadMd = (session_id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post(`/files/upload-md/${session_id}`, form);
};

export const getMd = (session_id: string) =>
  api.get<string>(`/files/md/${session_id}`);

export const saveMd = (session_id: string, content: string) =>
  api.put<string>(`/files/md/${session_id}`, content);

export const listSessions = () =>
  api.get<{ sessions: string[] }>("/files/sessions");

export const getSessionJson = (session_id: string) =>
  api.get(`/files/session-json/${session_id}`);

export const getOllamaModels = (base_url?: string) =>
  api.get<{ models: string[] }>("/config/ollama-models", {
    params: base_url ? { base_url } : {},
  });

export const getGoogleModels = (api_key: string) =>
  api.get<{ models: string[] }>("/config/google-models", { params: { api_key } });

export const getOpenAIModels = (api_key: string, base_url?: string) =>
  api.get<{ models: string[] }>("/config/openai-models", { params: { api_key, ...(base_url ? { base_url } : {}) } });

export const getAnthropicModels = (api_key: string) =>
  api.get<{ models: string[] }>("/config/anthropic-models", { params: { api_key } });

export const browsePath = (path?: string) =>
  api.get<{ current: string; parent: string | null; dirs: string[]; is_root: boolean }>(
    "/files/browse",
    { params: path ? { path } : {} }
  );