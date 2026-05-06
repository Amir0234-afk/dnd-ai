import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions, newSession, uploadMd } from "../services/api";
import { saveLocalMemory } from "../utils/localMemory";

export default function Lobby() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [mdFile, setMdFile] = useState<File | null>(null);

  useEffect(() => {
    listSessions()
      .then((res) => setSessions(res.data.sessions))
      .catch(() => setError("Could not load sessions."));
  }, []);

  const handleNewSession = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await newSession();
      const session = res.data;
      if (mdFile) {
        await uploadMd(session.session_id, mdFile);
        const text = await mdFile.text();
        saveLocalMemory(session.session_id, text);
      }
      navigate(`/game/${session.session_id}`);
    } catch {
      setError("Failed to create session.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async () => {
    if (!selectedSession) return;
    navigate(`/game/${selectedSession}`);
  };

  return (
    <div className="lobby">
      <h1>⚔ D&D AI Game Master</h1>

      <section>
        <h2>New Session</h2>
        <p>
          Start fresh. Optionally load a long term memory file to continue your
          story.
        </p>
        <label className="file-label">
          {mdFile ? mdFile.name : "Upload campaign MD (optional)"}
          <input
            type="file"
            accept=".md"
            onChange={(e) => setMdFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="lobby-actions">
          <button
            className="primary"
            onClick={handleNewSession}
            disabled={loading}
          >
            {loading ? "Starting..." : "Start New Session"}
          </button>
          <button onClick={() => navigate("/character")}>Create New Character</button>
        </div>
      </section>

      {sessions.length > 0 && (
        <section>
          <h2>Continue Session</h2>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            <option value="">— Select a session —</option>
            {sessions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={handleLoadSession}
            disabled={!selectedSession || loading}
          >
            Load Session
          </button>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="lobby-footer">
        <button onClick={() => navigate("/setup")}>⚙ Settings</button>
      </div>
    </div>
  );
}
