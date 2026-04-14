import { useEffect, useState, useRef } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "../firebase";
import { Sala, MinhaInfo, PERSONAGENS } from "../types";

interface LobbyProps {
  minhaInfo: MinhaInfo;
  onIniciar: () => void;
}

export default function Lobby({ minhaInfo, onIniciar }: LobbyProps) {
  const [sala, setSala] = useState<Sala | null>(null);
  const iniciouRef = useRef(false);

  useEffect(() => {
    const salaRef = ref(db, `salas/${minhaInfo.sala}`);
    const unsub = onValue(salaRef, (snap) => {
      const data = snap.val() as Sala;
      if (!data) return;
      setSala(data);
      if (data.iniciado && !iniciouRef.current) {
        iniciouRef.current = true;
        onIniciar();
      }
    });
    return () => unsub();
  }, [minhaInfo.sala, onIniciar]);

  async function iniciarPartida() {
    const baralho: string[] = [];
    PERSONAGENS.forEach((p) => {
      for (let i = 0; i < 3; i++) baralho.push(p);
    });
    baralho.sort(() => Math.random() - 0.5);

    const snap = await get(ref(db, `salas/${minhaInfo.sala}/jogadores`));
    const jogadores = snap.val() as Record<string, unknown>;
    const ids = Object.keys(jogadores);

    const upd: Record<string, unknown> = {
      iniciado: true,
      vezDe: ids[0],
      fase: "ACAO",
      timerFinal: Date.now() + 30000,
      baralho: baralho.slice(ids.length * 2),
    };

    ids.forEach((id, idx) => {
      upd[`jogadores/${id}/cartas`] = [
        baralho[idx * 2],
        baralho[idx * 2 + 1],
      ];
      upd[`jogadores/${id}/moedas`] = 1;
    });

    await update(ref(db, `salas/${minhaInfo.sala}`), upd);
  }

  const jogadores = sala?.jogadores || {};
  const numJogadores = Object.keys(jogadores).length;
  const podeIniciar = minhaInfo.isHost && numJogadores >= 2;

  return (
    <div className="lobby-screen">
      <div className="card-auth">
        <div className="sala-codigo-label">CÓDIGO DA SALA</div>
        <div className="sala-codigo">{minhaInfo.sala}</div>
        <p className="lobby-hint">Compartilhe o código com seus amigos!</p>

        <div className="lista-jogadores">
          <div className="lista-titulo">JOGADORES ({numJogadores})</div>
          {Object.values(jogadores).map((j, i) => (
            <div key={i} className="jogador-item">
              <span className="jogador-dot">●</span>
              <span className="jogador-nome">{j.nome}</span>
              {j.host && <span className="host-badge">HOST</span>}
            </div>
          ))}
          {numJogadores < 2 && (
            <div className="aguardando-msg">Aguardando mais jogadores...</div>
          )}
        </div>

        {minhaInfo.isHost ? (
          <button
            className={`btn-yellow btn-full ${!podeIniciar ? "btn-disabled" : ""}`}
            onClick={iniciarPartida}
            disabled={!podeIniciar}
          >
            {podeIniciar ? "INICIAR JOGO" : "AGUARDANDO PLAYERS..."}
          </button>
        ) : (
          <div className="aguardando-host">Aguardando o host iniciar...</div>
        )}
      </div>
    </div>
  );
}
