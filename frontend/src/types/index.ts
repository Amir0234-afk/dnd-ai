export type LLMProvider = "openai" | "anthropic" | "google" | "ollama" | "custom";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key?: string;
  base_url?: string;
  temperature: number;
  max_tokens: number;
}

export interface AppConfig {
  llm: LLMConfig;
  storage_path: string;
  system_prompt_path?: string;
}

export interface Turn {
  role: "user" | "gm" | "system";
  content: string;
  timestamp: string;
}

export interface Roll {
  check_name: string;
  formula: string;
  result: number;
  target?: number;
  success?: boolean;
  timestamp: string;
}

export interface SessionState {
  session_id: string;
  created_at: string;
  prompt_count: number;
  characters: Record<string, unknown>;
  world: Record<string, unknown>;
  events: string[];
  open_threads: string[];
  inventory: Record<string, unknown>;
  rolls: Roll[];
  turns: Turn[];
  long_term_memory?: string | null;
}

export interface PromptResponse {
  narrative: string;
  updated_session: SessionState;
  sync_md: string | null;
}

export interface EndSessionResponse {
  updated_md: string;
}