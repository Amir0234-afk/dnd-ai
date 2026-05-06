import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sendPrompt, endSession, saveSyncMd, getMd, getSession } from "../services/api";
import { loadLocalMemory, saveLocalMemory } from "../utils/localMemory";
import type { SessionState, Turn } from "../types";

export default function Game() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncMd, setSyncMd] = useState<string | null>(null);
  const [endMd, setEndMd] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [memoryContent, setMemoryContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((res) => {
        setSession(res.data);
        if (res.data.long_term_memory) {
          setMemoryContent(res.data.long_term_memory);
          saveLocalMemory(sessionId, res.data.long_term_memory);
        }
      })
      .catch(() => setLoadError("Session not found."));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const cached = loadLocalMemory(sessionId);
    if (cached) setMemoryContent(cached);

    getMd(sessionId)
      .then((res) => {
        setMemoryContent(res.data);
        saveLocalMemory(sessionId, res.data);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.turns, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !session) return;
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await sendPrompt(session.session_id, trimmed);
      setSession(res.data.updated_session);
      if (res.data.sync_md) {
        setSyncMd(res.data.sync_md);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to reach the GM. Check your connection and API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveSync = async () => {
    if (!syncMd || !session) return;
    try {
      await saveSyncMd(session.session_id, syncMd);
      saveLocalMemory(session.session_id, syncMd);
      setMemoryContent(syncMd);
      setSyncMd(null);
    } catch {
      setError("Failed to save memory update.");
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    if (!confirm("End this session? The long term memory will be updated.")) return;
    setLoading(true);
    try {
      const res = await endSession(session.session_id);
      saveLocalMemory(session.session_id, res.data.updated_md);
      setEndMd(res.data.updated_md);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to end session.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMd = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadError) {
    return (
      <div className="loading-screen">
        <p>{loadError}</p>
        <button onClick={() => navigate("/lobby")} style={{ marginTop: 16 }}>← Lobby</button>
      </div>
    );
  }

  if (!session) {
    return <div className="loading-screen"><p>Loading session...</p></div>;
  }

  const displayTurns = session.turns.filter((t) => t.role !== "system");

  if (endMd) {
    return (
      <div className="session-end">
        <h1>Session Complete</h1>
        <p>
          Your long term memory has been updated. Download it to keep your
          story.
        </p>
        <pre className="md-preview">{endMd}</pre>
        <div className="end-actions">
          <button
            className="primary"
            onClick={() => handleDownloadMd(endMd, `memory_${session.session_id}.md`)}
          >
            Download Updated Memory
          </button>
          <button onClick={() => navigate("/lobby")}>Return to Lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game">
      <div className="game-header">
        <span className="session-id">
          Session: {session.session_id.slice(0, 8)}...
        </span>
        <span className="prompt-count">Prompts: {session.prompt_count}</span>
        <div className="header-actions">
          <button onClick={() => setShowMemory((p) => !p)}>
            {showMemory ? "Hide Memory" : "View Memory"}
          </button>
          <button onClick={() => navigate("/setup", { state: { from: `/game/${session.session_id}` } })}>
            ⚙ Settings
          </button>
          <button className="danger" onClick={handleEndSession} disabled={loading}>
            End Session
          </button>
        </div>
      </div>

      {showMemory && (
        <div className="memory-panel">
          <div className="memory-header">
            <h3>Long Term Memory</h3>
            <button
              onClick={() => handleDownloadMd(memoryContent, "memory.md")}
              disabled={!memoryContent}
            >
              Download
            </button>
          </div>
          <pre className="md-preview">
            {memoryContent || "No memory file loaded."}
          </pre>
        </div>
      )}

      {syncMd && (
        <div className="sync-banner">
          <p>
            🧠 Memory sync ready — the GM has synthesized the last 10 prompts.
          </p>
          <div className="sync-actions">
            <button className="primary" onClick={handleSaveSync}>
              Save to Memory
            </button>
            <button onClick={() => handleDownloadMd(syncMd, `sync_${session.prompt_count}.md`)}>
              Download Only
            </button>
            <button onClick={() => setSyncMd(null)}>Dismiss</button>
          </div>
          <pre className="md-preview">{syncMd}</pre>
        </div>
      )}

      <div className="turns-feed">
        {displayTurns.length === 0 && (
          <div className="feed-empty">
            <p>The GM is waiting. What do you do?</p>
          </div>
        )}
        {displayTurns.map((turn, i) => (
          <TurnEntry key={i} turn={turn} />
        ))}
        {loading && (
          <div className="turn gm loading">
            <span className="turn-label">GM</span>
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`"Say something..." or *do something* or just describe what you do`}
          rows={3}
          disabled={loading}
        />
        <button
          className="primary send-btn"
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function TurnEntry({ turn }: { turn: Turn }) {
  return (
    <div className={`turn ${turn.role}`}>
      <span className="turn-label">{turn.role === "user" ? "You" : "GM"}</span>
      <div className="turn-body">
        <p>{turn.content}</p>
        <span className="timestamp">
          {new Date(turn.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
