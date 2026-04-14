import { useState } from "react";
import { ref, set, get } from "firebase/database";
import { db } from "../firebase";
import { MinhaInfo } from "../types";

interface LoginProps {
  onConectar: (info: MinhaInfo) => void;
  onVoltar: () => void;
}

export default function Login({ onConectar, onVoltar }: LoginProps) {
  const [nome, setNome] = useState("");
  const [codigoSala, setCodigoSala] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function criarSala() {
    if (!nome.trim()) return setErro("Digite um apelido!");
    setLoading(true);
    setErro("");
    try {
      const cod = Math.random().toString(36).substring(2, 6).toUpperCase();
      const id = "p_" + Date.now();
      const info: MinhaInfo = { nome: nome.trim(), id, sala: cod, isHost: true };
      await set(ref(db, `salas/${cod}`), {
        iniciado: false,
        host: id,
        fase: "ESPERA",
        log: [],
      });
      await set(ref(db, `salas/${cod}/jogadores/${id}`), {
        nome: nome.trim(),
        moedas: 2,
        vivo: true,
        host: true,
      });
      onConectar(info);
    } catch {
      setErro("Erro ao criar sala. Tente novamente.");
    }
    setLoading(false);
  }

  async function entrarSala() {
    if (!nome.trim()) return setErro("Digite um apelido!");
    if (!codigoSala.trim()) return setErro("Digite o código da sala!");
    setLoading(true);
    setErro("");
    try {
      const cod = codigoSala.trim().toUpperCase();
      const snap = await get(ref(db, `salas/${cod}`));
      if (!snap.exists()) {
        setErro("Sala não encontrada!");
        setLoading(false);
        return;
      }
      const salaData = snap.val();
      if (salaData?.iniciado) {
        setErro("Jogo em andamento! Espere a próxima partida.");
        setLoading(false);
        return;
      }
      const id = "p_" + Date.now();
      const info: MinhaInfo = { nome: nome.trim(), id, sala: cod, isHost: false };
      await set(ref(db, `salas/${cod}/jogadores/${id}`), {
        nome: nome.trim(),
        moedas: 2,
        vivo: true,
        host: false,
      });
      onConectar(info);
    } catch {
      setErro("Erro ao entrar na sala. Tente novamente.");
    }
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <button className="btn-back" onClick={onVoltar}>← VOLTAR</button>
      <div className="card-auth">
        <h1 className="login-logo">GOLPE</h1>
        <p className="login-subtitle">VERSÃO BRASILEIRA</p>

        {erro && <div className="erro-msg">{erro}</div>}

        <div className="form-group">
          <input
            className="input-field"
            placeholder="Seu apelido"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criarSala()}
            maxLength={20}
          />
        </div>

        <button
          className="btn-yellow btn-full"
          onClick={criarSala}
          disabled={loading}
        >
          {loading ? "CRIANDO..." : "Criar Nova Sala"}
        </button>

        <div className="divider">
          <span>ou</span>
        </div>

        <div className="form-group">
          <input
            className="input-field input-code"
            placeholder="Código da Sala"
            value={codigoSala}
            onChange={(e) => setCodigoSala(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && entrarSala()}
            maxLength={4}
          />
        </div>

        <button
          className="btn-secondary btn-full"
          onClick={entrarSala}
          disabled={loading}
        >
          {loading ? "ENTRANDO..." : "Entrar na Sala"}
        </button>
      </div>
    </div>
  );
}
