import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { configExists } from "./services/api";
import Setup from "./pages/Setup";
import Lobby from "./pages/Lobby";
import CharacterCreation from "./pages/CharacterCreation";
import Game from "./pages/Game";

function Root() {
  const [target, setTarget] = useState<"setup" | "lobby" | null>(null);

  useEffect(() => {
    configExists()
      .then((res) => setTarget(res.data.exists ? "lobby" : "setup"))
      .catch(() => setTarget("setup"));
  }, []);

  if (!target) return <div className="loading-screen"><p>Loading...</p></div>;
  return <Navigate to={`/${target}`} replace />;
}

export default function App() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Root />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/character" element={<CharacterCreation />} />
      <Route path="/game/:sessionId" element={<Game />} />
    </Routes>
  );
}
