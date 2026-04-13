import { useState } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Lobby from "./pages/Lobby";
import Mesa from "./pages/Mesa";
import { MinhaInfo } from "./types";

type Screen = "home" | "login" | "lobby" | "mesa";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [minhaInfo, setMinhaInfo] = useState<MinhaInfo | null>(null);

  function handleConectar(info: MinhaInfo) {
    setMinhaInfo(info);
    setScreen("lobby");
  }

  function handleIniciar() {
    setScreen("mesa");
  }

  return (
    <>
      {screen === "home" && <Home onJogar={() => setScreen("login")} />}
      {screen === "login" && (
        <Login onConectar={handleConectar} onVoltar={() => setScreen("home")} />
      )}
      {screen === "lobby" && minhaInfo && (
        <Lobby minhaInfo={minhaInfo} onIniciar={handleIniciar} />
      )}
      {screen === "mesa" && minhaInfo && <Mesa minhaInfo={minhaInfo} />}
    </>
  );
}
