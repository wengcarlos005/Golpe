import { useEffect, useRef, useState, useCallback } from "react";
import { ref, onValue, update, get, set } from "firebase/database";
import { db } from "../firebase";
import { Sala, MinhaInfo, AcaoPendente } from "../types";

interface MesaProps {
  minhaInfo: MinhaInfo;
}

export default function Mesa({ minhaInfo }: MesaProps) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [timerPercent, setTimerPercent] = useState(100);
  const [tempoRestante, setTempoRestante] = useState(30);
  const executandoRef = useRef(false);

  const passarTurno = useCallback(async () => {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    if (!d) return;
    const ids = Object.keys(d.jogadores || {}).filter(
      (id) => (d.jogadores![id].cartas || []).length > 0
    );
    const atualIdx = ids.indexOf(d.vezDe!);
    const prox = ids[(atualIdx + 1) % ids.length];
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      vezDe: prox,
      fase: "ACAO",
      timerFinal: Date.now() + 30000,
      acaoPendente: null,
    });
    setAlvoId(null);
    executandoRef.current = false;
  }, [minhaInfo.sala]);

  const perderCarta = useCallback(
    async (id: string, cb: () => void) => {
      const snap = await get(
        ref(db, `salas/${minhaInfo.sala}/jogadores/${id}/cartas`)
      );
      const cartas = (snap.val() as string[]) || [];
      cartas.shift();
      await set(
        ref(db, `salas/${minhaInfo.sala}/jogadores/${id}/cartas`),
        cartas
      );
      cb();
    },
    [minhaInfo.sala]
  );

  const executarEfeito = useCallback(async () => {
    if (executandoRef.current) return;
    executandoRef.current = true;

    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    if (!d) { executandoRef.current = false; return; }
    const a = d.acaoPendente as AcaoPendente;
    if (!a) { executandoRef.current = false; return; }

    const aut = d.jogadores![a.autorId];
    const upd: Record<string, unknown> = {};

    if (a.tipo === "Político") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 3;
    }
    if (a.tipo === "Ajuda Externa") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 2;
    }
    if (a.tipo === "Trabalhar") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 1;
    }
    if (a.tipo === "Bicheiro") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 2;
      upd[`jogadores/${a.alvoId!}/moedas`] = Math.max(
        0,
        d.jogadores![a.alvoId!].moedas - 2
      );
    }
    if (a.tipo === "Bandido") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas - 3;
    }
    if (a.tipo === "Golpe") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas - 7;
    }

    upd.fase = "ACAO";
    upd.acaoPendente = null;
    await update(ref(db, `salas/${minhaInfo.sala}`), upd);

    if (a.tipo === "Bandido" || a.tipo === "Golpe") {
      await perderCarta(a.alvoId!, passarTurno);
    } else {
      await passarTurno();
    }
  }, [minhaInfo.sala, passarTurno, perderCarta]);

  useEffect(() => {
    const salaRef = ref(db, `salas/${minhaInfo.sala}`);
    const unsub = onValue(salaRef, (snap) => {
      const data = snap.val() as Sala;
      setSala(data);
    });
    return () => unsub();
  }, [minhaInfo.sala]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!minhaInfo.sala) return;
      const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
      const d = snap.val() as Sala;
      if (!d || !d.iniciado || !d.timerFinal) return;

      const agora = Date.now();
      const restante = d.timerFinal - agora;
      const total = d.fase === "ACAO" ? 30000 : 10000;

      setTimerPercent(Math.max(0, (restante / total) * 100));
      setTempoRestante(Math.max(0, Math.floor(restante / 1000)));

      if (restante <= 0 && d.vezDe === minhaInfo.id && !executandoRef.current) {
        if (d.fase === "ACAO") {
          await passarTurno();
        } else {
          await executarEfeito();
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [minhaInfo.sala, minhaInfo.id, executarEfeito, passarTurno]);

  async function adicionarLog(msg: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}/log`));
    const log = (snap.val() as string[]) || [];
    log.push(msg);
    await set(ref(db, `salas/${minhaInfo.sala}/log`), log);
  }

  async function pedirAcao(tipo: string) {
    if (["Bicheiro", "Bandido", "Golpe"].includes(tipo) && !alvoId) {
      alert("Selecione um alvo clicando em um jogador!");
      return;
    }

    const snap = await get(
      ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/moedas`)
    );
    const moedas = snap.val() as number;

    if (tipo === "Bandido" && moedas < 3) {
      alert("Bandido exige 3 moedas!");
      return;
    }
    if (tipo === "Golpe" && moedas < 7) {
      alert("Golpe exige 7 moedas!");
      return;
    }

    const fase = tipo === "Trabalhar" || tipo === "Golpe" ? "EXECUCAO" : "DUVIDA";
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      acaoPendente: { autorId: minhaInfo.id, tipo, alvoId: alvoId || null },
      fase,
      timerFinal: Date.now() + 10000,
    });
    await adicionarLog(`@${minhaInfo.nome} usou ${tipo}`);
    if (fase === "EXECUCAO") await executarEfeito();
  }

  async function reagir(r: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    const a = d.acaoPendente as AcaoPendente;

    if (r === "DUVIDO") {
      const temCarta = (d.jogadores![a.autorId].cartas || []).includes(a.tipo);
      if (temCarta) {
        await perderCarta(minhaInfo.id, executarEfeito);
      } else {
        await perderCarta(a.autorId, passarTurno);
      }
    } else if (r === "BLOQUEIO") {
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "DUVIDA_BLOQUEIO",
        timerFinal: Date.now() + 10000,
      });
    } else {
      if (
        d.fase === "DUVIDA" &&
        ["Bicheiro", "Bandido", "Ajuda Externa"].includes(a.tipo)
      ) {
        await update(ref(db, `salas/${minhaInfo.sala}`), {
          fase: "BLOQUEIO",
          timerFinal: Date.now() + 10000,
        });
      } else {
        await executarEfeito();
      }
    }
  }

  if (!sala) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Carregando mesa...</p>
      </div>
    );
  }

  const jogadores = sala.jogadores || {};
  const eu = jogadores[minhaInfo.id];
  const minhasCartas = eu?.cartas || [];
  const ativos = Object.keys(jogadores).filter(
    (id) => (jogadores[id].cartas || []).length > 0
  );
  const vencedor = ativos.length === 1 ? jogadores[ativos[0]] : null;
  const minhasMoedas = eu?.moedas ?? 0;

  return (
    <div className="mesa-wrapper">
      <div className="ui-mesa-completa">
        {/* LOG — newest at top (column-reverse) */}
        <div className="log-container">
          {(sala.log || [])
            .slice()
            .reverse()
            .slice(0, 20)
            .map((msg, i) => (
              <div key={i} className="action-msg">
                {msg}
              </div>
            ))}
          <div className="log-titulo">HISTÓRICO</div>
        </div>

        {/* ADVERSÁRIOS */}
        <div className="adversarios-topo">
          {Object.entries(jogadores)
            .filter(([id]) => id !== minhaInfo.id)
            .map(([id, j]) => {
              const vivo = (j.cartas || []).length > 0;
              const isVez = id === sala.vezDe;
              const isAlvo = id === alvoId;
              return (
                <div
                  key={id}
                  className={`player-card ${isVez ? "active-turn" : ""} ${isAlvo ? "target-selected" : ""} ${!vivo ? "eliminado" : ""}`}
                  onClick={() => vivo && setAlvoId(id === alvoId ? null : id)}
                >
                  <div className="player-avatar">
                    {j.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-nome">{j.nome}</div>
                  <div className="player-status">
                    {vivo ? (
                      <span className="moedas-badge">💰 {j.moedas}</span>
                    ) : (
                      <span className="eliminado-badge">💀</span>
                    )}
                  </div>
                  {isVez && vivo && <div className="vez-indicator">VEZ</div>}
                  {vivo && (
                    <div className="cartas-count">
                      {(j.cartas || []).length} carta
                      {(j.cartas || []).length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* MESA CENTRAL */}
        <div className="mesa-central">
          <div className="mesa-diamante">
            <div className="mesa-diamante-inner">
              <div className="mesa-texto">GOLPE</div>
            </div>
          </div>
          <div className="status-fase">{sala.fase}</div>
          {sala.acaoPendente && (
            <div className="acao-pendente-info">
              {jogadores[sala.acaoPendente.autorId]?.nome} usa{" "}
              <strong>{sala.acaoPendente.tipo}</strong>
              {sala.acaoPendente.alvoId && (
                <> em {jogadores[sala.acaoPendente.alvoId]?.nome}</>
              )}
            </div>
          )}
        </div>

        {/* MENU AÇÕES */}
        <div className="menu-acoes">
          <div className="timer-section">
            <div className="timer-bar">
              <div
                className="timer-fill"
                style={{ width: `${timerPercent}%` }}
              />
            </div>
            <div className="timer-label">
              {String(Math.floor(tempoRestante / 60)).padStart(2, "0")}:
              {String(tempoRestante % 60).padStart(2, "0")}
            </div>
          </div>

          <div className="area-botoes">
            {vencedor ? (
              <div className="vencedor-banner">
                🏆 {vencedor.nome.toUpperCase()} VENCEU!
              </div>
            ) : minhasCartas.length === 0 ? (
              <div className="fora-jogo">Você está fora do jogo.</div>
            ) : (
              <>
                {sala.fase === "ACAO" && sala.vezDe === minhaInfo.id && (
                  <>
                    <div className="acoes-titulo">SUA VEZ — Escolha uma ação:</div>

                    <button
                      className="btn-acao btn-amarelo"
                      onClick={() => pedirAcao("Político")}
                    >
                      <span className="acao-nome">🏛️ Político</span>
                      <span className="acao-desc">+3 💰 (pode ser desafiado)</span>
                    </button>

                    <button
                      className="btn-acao btn-amarelo"
                      onClick={() => pedirAcao("Ajuda Externa")}
                    >
                      <span className="acao-nome">🤝 Ajuda Externa</span>
                      <span className="acao-desc">+2 💰 (Político bloqueia)</span>
                    </button>

                    <button
                      className="btn-acao btn-amarelo"
                      onClick={() => pedirAcao("Bicheiro")}
                    >
                      <span className="acao-nome">🎰 Bicheiro</span>
                      <span className="acao-desc">Rouba 2 💰 do alvo</span>
                    </button>

                    {minhasMoedas >= 3 && (
                      <button
                        className="btn-acao btn-vermelho"
                        onClick={() => pedirAcao("Bandido")}
                      >
                        <span className="acao-nome">🔪 Bandido</span>
                        <span className="acao-desc">Assassina alvo (-3 💰)</span>
                      </button>
                    )}

                    <button
                      className="btn-acao btn-cinza"
                      onClick={() => pedirAcao("Trabalhar")}
                    >
                      <span className="acao-nome">⚒️ Trabalhar</span>
                      <span className="acao-desc">+1 💰 (sempre funciona)</span>
                    </button>

                    {minhasMoedas >= 7 && (
                      <button
                        className="btn-acao btn-vermelho"
                        onClick={() => pedirAcao("Golpe")}
                      >
                        <span className="acao-nome">💥 DAR GOLPE</span>
                        <span className="acao-desc">-7 💰 · Elimina carta do alvo</span>
                      </button>
                    )}

                    {alvoId ? (
                      <div className="alvo-selecionado">
                        Alvo: <strong>{jogadores[alvoId]?.nome}</strong>
                        <button
                          className="btn-limpar-alvo"
                          onClick={() => setAlvoId(null)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="hint-alvo">
                        Clique em um jogador para selecionar como alvo
                      </div>
                    )}
                  </>
                )}

                {sala.fase === "DUVIDA" &&
                  sala.acaoPendente?.autorId !== minhaInfo.id && (
                    <>
                      <div className="acoes-titulo">DUVIDAR DA AÇÃO?</div>
                      <button
                        className="btn-acao btn-azul"
                        onClick={() => reagir("DUVIDO")}
                      >
                        <span className="acao-nome">🤔 DUVIDAR!</span>
                        <span className="acao-desc">Desafiar — se ganhar, autor perde carta</span>
                      </button>
                      <button
                        className="btn-acao btn-cinza"
                        onClick={() => reagir("PASSAR")}
                      >
                        <span className="acao-nome">✓ ACEITAR</span>
                        <span className="acao-desc">Deixar a ação prosseguir</span>
                      </button>
                    </>
                  )}

                {sala.fase === "BLOQUEIO" &&
                  sala.acaoPendente?.alvoId === minhaInfo.id && (
                    <>
                      <div className="acoes-titulo">BLOQUEAR A AÇÃO?</div>
                      <button
                        className="btn-acao btn-azul"
                        onClick={() => reagir("BLOQUEIO")}
                      >
                        <span className="acao-nome">🛡️ BLOQUEAR</span>
                        <span className="acao-desc">Usar personagem para impedir</span>
                      </button>
                      <button
                        className="btn-acao btn-cinza"
                        onClick={() => reagir("PASSAR")}
                      >
                        <span className="acao-nome">✓ ACEITAR</span>
                        <span className="acao-desc">Deixar acontecer</span>
                      </button>
                    </>
                  )}

                {((sala.fase === "ACAO" && sala.vezDe !== minhaInfo.id) ||
                  (sala.fase === "DUVIDA" &&
                    sala.acaoPendente?.autorId === minhaInfo.id)) && (
                  <div className="aguardando-msg">
                    Aguardando{" "}
                    {jogadores[sala.vezDe!]?.nome || "outro jogador"}...
                  </div>
                )}

                {sala.fase === "DUVIDA_BLOQUEIO" && (
                  <div className="aguardando-msg">
                    Bloco em andamento...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* MEU STATUS */}
        <div className="meu-status">
          <div className="minha-identidade">
            <div className="meu-nome">{minhaInfo.nome}</div>
            <div className="minhas-moedas">💰 {minhasMoedas}</div>
          </div>
          <div className="minhas-cartas">
            {minhasCartas.map((c, i) => (
              <div key={i} className="minha-carta">
                <div className="carta-topo">★</div>
                <div className="carta-nome">{c}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
