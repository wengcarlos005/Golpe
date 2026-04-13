import { useEffect, useRef, useState, useCallback } from "react";
import { ref, onValue, update, get, set } from "firebase/database";
import { db } from "../firebase";
import { Sala, MinhaInfo, AcaoPendente } from "../types";

interface MesaProps {
  minhaInfo: MinhaInfo;
}

// Which actions require a target
const ACOES_COM_ALVO = ["Bicheiro", "Bandido", "Investigar", "Trocar", "Golpe"];

// Which character is needed to BLOCK each action
const BLOQUEADOR_CHAR: Record<string, string> = {
  "Ajuda Externa": "Político",
  "Bicheiro": "Miliciano",
  "Bandido": "Miliciano",
  "Investigar": "Juiz",
  "Trocar": "Juiz",
  "Disfarce": "Juiz",
};

// Which actions can be DOUBTED (require a character claim)
const ACOES_COM_DUVIDA = [
  "Político", "Bicheiro", "Bandido", "Investigar", "Trocar", "Disfarce",
];

// Which actions skip doubt and go to bloqueio / straight to execucao
function getFaseInicial(tipo: string): string {
  if (tipo === "Trabalhar" || tipo === "Golpe") return "EXECUCAO";
  if (tipo === "Ajuda Externa") return "BLOQUEIO"; // anyone can get foreign aid; no doubt
  return "DUVIDA"; // others can be doubted first
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
      quemPerde: null,
      bloqueadorId: null,
      bloqueadorPersonagem: null,
    });
    setAlvoId(null);
    executandoRef.current = false;
  }, [minhaInfo.sala]);

  const entrarFasePerda = useCallback(
    async (id: string) => {
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "PERDER_CARTA",
        quemPerde: id,
        timerFinal: Date.now() + 15000,
      });
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
    const baralho = [...(d.baralho || [])];
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
      upd[`jogadores/${a.autorId}/moedas`] = Math.max(0, aut.moedas - 3);
      upd.acaoPendente = null;
      await update(ref(db, `salas/${minhaInfo.sala}`), upd);
      await entrarFasePerda(a.alvoId!);
      executandoRef.current = false;
      return;
    }

    if (a.tipo === "Golpe") {
      upd[`jogadores/${a.autorId}/moedas`] = Math.max(0, aut.moedas - 7);
      upd.acaoPendente = null;
      await update(ref(db, `salas/${minhaInfo.sala}`), upd);
      await entrarFasePerda(a.alvoId!);
      executandoRef.current = false;
      return;
    }

    // Investigar → target reveals a card
    if (a.tipo === "Investigar") {
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "REVELAR_CARTA",
        timerFinal: Date.now() + 15000,
      });
      executandoRef.current = false;
      return;
    }

    // Trocar → swap one of target's cards with deck
    if (a.tipo === "Trocar") {
      const alvoCa = [...(d.jogadores![a.alvoId!].cartas || [])];
      if (alvoCa.length > 0) {
        baralho.push(alvoCa.pop()!);
        baralho.sort(() => Math.random() - 0.5);
        if (baralho.length > 0) alvoCa.push(baralho.pop()!);
      }
      upd[`jogadores/${a.alvoId!}/cartas`] = alvoCa;
      upd.baralho = baralho;
    }

    // Disfarce → swap one of own cards with deck
    if (a.tipo === "Disfarce") {
      const autCa = [...(aut.cartas || [])];
      if (autCa.length > 0) {
        baralho.push(autCa.pop()!);
        baralho.sort(() => Math.random() - 0.5);
        if (baralho.length > 0) autCa.push(baralho.pop()!);
      }
      upd[`jogadores/${a.autorId}/cartas`] = autCa;
      upd.baralho = baralho;
    }

    upd.fase = "ACAO";
    upd.acaoPendente = null;
    upd.quemPerde = null;
    upd.bloqueadorId = null;
    upd.bloqueadorPersonagem = null;
    await update(ref(db, `salas/${minhaInfo.sala}`), upd);
    await passarTurno();
  }, [minhaInfo.sala, passarTurno, entrarFasePerda]);

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
      const total = d.fase === "ACAO" ? 30000 : 15000;

      setTimerPercent(Math.max(0, (restante / total) * 100));
      setTempoRestante(Math.max(0, Math.floor(restante / 1000)));

      if (restante <= 0 && !executandoRef.current) {
        if (d.fase === "ACAO" && d.vezDe === minhaInfo.id) {
          await passarTurno();
        } else if (d.fase === "PERDER_CARTA" && d.quemPerde === minhaInfo.id) {
          await confirmarPerda(0);
        } else if (
          d.fase === "REVELAR_CARTA" &&
          d.acaoPendente?.alvoId === minhaInfo.id
        ) {
          const cartas = d.jogadores?.[minhaInfo.id]?.cartas || [];
          if (cartas.length > 0) await revelarParaInvestigador(cartas[0]);
        } else if (
          d.fase !== "ACAO" &&
          d.fase !== "PERDER_CARTA" &&
          d.fase !== "REVELAR_CARTA" &&
          d.vezDe === minhaInfo.id
        ) {
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

  async function confirmarPerda(idx: number) {
    const snap = await get(
      ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/cartas`)
    );
    const cartas = (snap.val() as string[]) || [];
    const cartaPerdida = cartas[idx];
    cartas.splice(idx, 1);
    await set(
      ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/cartas`),
      cartas
    );
    await adicionarLog(`⚠️ ${minhaInfo.nome} perdeu ${cartaPerdida}`);
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      fase: "ACAO",
      quemPerde: null,
    });
    await passarTurno();
  }

  async function revelarParaInvestigador(carta: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    const autorNome =
      d.jogadores?.[d.acaoPendente?.autorId!]?.nome || "Investigador";
    await adicionarLog(`🕵️ ${autorNome} viu: ${carta} (de ${minhaInfo.nome})`);
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      fase: "ACAO",
      acaoPendente: null,
    });
    await passarTurno();
  }

  async function pedirAcao(tipo: string) {
    if (ACOES_COM_ALVO.includes(tipo) && !alvoId) {
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

    const fase = getFaseInicial(tipo);
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      acaoPendente: { autorId: minhaInfo.id, tipo, alvoId: alvoId || null },
      fase,
      timerFinal: Date.now() + 10000,
    });
    await adicionarLog(`▶ ${minhaInfo.nome} usou ${tipo}`);
    if (fase === "EXECUCAO") await executarEfeito();
  }

  async function reagir(r: string, char?: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    const a = d.acaoPendente as AcaoPendente;

    if (r === "DUVIDO") {
      // Map Investigar/Trocar/Disfarce actions to the Investigador character
      const cartaNecessaria = ["Investigar", "Trocar", "Disfarce"].includes(a.tipo)
        ? "Investigador"
        : a.tipo;
      const temCarta = (d.jogadores![a.autorId].cartas || []).includes(cartaNecessaria);
      if (temCarta) {
        // Doubter wrong — doubter loses a card
        await adicionarLog(`🤔 ${minhaInfo.nome} duvidou mas ${jogadores[a.autorId]?.nome} tinha ${cartaNecessaria}!`);
        await entrarFasePerda(minhaInfo.id);
      } else {
        // Bluff caught — author loses a card
        await adicionarLog(`🤔 ${minhaInfo.nome} duvidou! ${jogadores[a.autorId]?.nome} estava blefando!`);
        await entrarFasePerda(a.autorId);
      }
    } else if (r === "BLOQUEIO" && char) {
      // Blocker declares which character they're using
      await adicionarLog(`🛡️ ${minhaInfo.nome} bloqueou com ${char}`);
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "DUVIDA_BLOQUEIO",
        bloqueadorId: minhaInfo.id,
        bloqueadorPersonagem: char,
        timerFinal: Date.now() + 10000,
      });
    } else {
      // PASSAR — advance the phase
      if (d.fase === "DUVIDA") {
        // After doubt phase passes, offer blocking
        await update(ref(db, `salas/${minhaInfo.sala}`), {
          fase: "BLOQUEIO",
          timerFinal: Date.now() + 10000,
        });
      } else if (d.fase === "BLOQUEIO") {
        // Target accepted, execute action
        await executarEfeito();
      } else {
        await executarEfeito();
      }
    }
  }

  async function contestarBloqueio(duvidar: boolean) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;

    if (!duvidar) {
      // Author accepts the block — turn passes
      await adicionarLog(`✓ ${minhaInfo.nome} aceitou o bloqueio`);
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "ACAO",
        acaoPendente: null,
        bloqueadorId: null,
        bloqueadorPersonagem: null,
      });
      await passarTurno();
      return;
    }

    // Author doubts the block
    const bloqueadorTemCarta = (
      d.jogadores![d.bloqueadorId!]?.cartas || []
    ).includes(d.bloqueadorPersonagem!);

    if (bloqueadorTemCarta) {
      // Blocker was honest — author loses a card, block stands
      await adicionarLog(
        `🛡️ Bloqueio válido! ${d.jogadores![d.bloqueadorId!]?.nome} tinha ${d.bloqueadorPersonagem}`
      );
      await entrarFasePerda(minhaInfo.id);
    } else {
      // Blocker was bluffing — blocker loses a card, action executes
      await adicionarLog(
        `❌ Bloqueio falso! ${d.jogadores![d.bloqueadorId!]?.nome} estava blefando!`
      );
      await entrarFasePerda(d.bloqueadorId!);
      // After the blocker loses their card, action should execute
      // This is handled after confirmarPerda → passarTurno
      // For simplicity, we execute immediately after setting the perda phase
    }
  }

  async function reiniciarJogo() {
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      iniciado: false,
      fase: "ESPERA",
      timerFinal: null,
      acaoPendente: null,
      quemPerde: null,
      bloqueadorId: null,
      bloqueadorPersonagem: null,
      log: [],
    });
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

  const fasePerder =
    sala.fase === "PERDER_CARTA" && sala.quemPerde === minhaInfo.id;
  const faseRevelar =
    sala.fase === "REVELAR_CARTA" &&
    sala.acaoPendente?.alvoId === minhaInfo.id;
  const faseDuvidaBloqueio =
    sala.fase === "DUVIDA_BLOQUEIO" &&
    sala.acaoPendente?.autorId === minhaInfo.id;

  // Can this player block the current action?
  const acaoPend = sala.acaoPendente;
  const possoBloquear =
    sala.fase === "BLOQUEIO" &&
    acaoPend?.alvoId === minhaInfo.id &&
    !!BLOQUEADOR_CHAR[acaoPend?.tipo || ""];

  // The character needed to block the current action
  const charParaBloquear = acaoPend ? BLOQUEADOR_CHAR[acaoPend.tipo] : null;

  return (
    <div className="mesa-wrapper">
      <div className="ui-mesa-completa">
        {/* LOG */}
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
              const isPerdendo =
                sala.fase === "PERDER_CARTA" && sala.quemPerde === id;
              const isRevelando =
                sala.fase === "REVELAR_CARTA" &&
                sala.acaoPendente?.alvoId === id;
              return (
                <div
                  key={id}
                  className={`player-card ${isVez ? "active-turn" : ""} ${isAlvo ? "target-selected" : ""} ${!vivo ? "eliminado" : ""} ${isPerdendo ? "perdendo" : ""}`}
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
                  {isPerdendo && (
                    <div className="perdendo-indicator">ESCOLHENDO</div>
                  )}
                  {isRevelando && (
                    <div
                      className="perdendo-indicator"
                      style={{ background: "#1565c0" }}
                    >
                      REVELANDO
                    </div>
                  )}
                  {isVez && vivo && !isPerdendo && !isRevelando && (
                    <div className="vez-indicator">VEZ</div>
                  )}
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
          {sala.acaoPendente && sala.fase !== "PERDER_CARTA" && (
            <div className="acao-pendente-info">
              {jogadores[sala.acaoPendente.autorId]?.nome} usa{" "}
              <strong>{sala.acaoPendente.tipo}</strong>
              {sala.acaoPendente.alvoId && (
                <> em {jogadores[sala.acaoPendente.alvoId]?.nome}</>
              )}
            </div>
          )}
          {sala.fase === "PERDER_CARTA" && sala.quemPerde && (
            <div className="acao-pendente-info perdendo-aviso">
              {jogadores[sala.quemPerde]?.nome} deve escolher uma carta para perder
            </div>
          )}
          {sala.fase === "DUVIDA_BLOQUEIO" && sala.bloqueadorId && (
            <div className="acao-pendente-info" style={{ color: "#90caf9" }}>
              {jogadores[sala.bloqueadorId]?.nome} bloqueou com{" "}
              <strong>{sala.bloqueadorPersonagem}</strong>
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
              <>
                <div className="vencedor-banner">
                  🏆 {vencedor.nome.toUpperCase()} VENCEU!
                </div>
                {minhaInfo.isHost && (
                  <button
                    className="btn-acao btn-amarelo"
                    style={{ marginTop: 12 }}
                    onClick={reiniciarJogo}
                  >
                    <span className="acao-nome">🔄 NOVO JOGO</span>
                    <span className="acao-desc">Voltar ao lobby</span>
                  </button>
                )}
              </>
            ) : minhasCartas.length === 0 ? (
              <div className="fora-jogo">Você está fora do jogo.</div>
            ) : (
              <>
                {/* MINHA VEZ */}
                {sala.fase === "ACAO" && sala.vezDe === minhaInfo.id && (
                  <>
                    <div className="acoes-titulo">SUA VEZ — Escolha uma ação:</div>

                    <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Político")}>
                      <span className="acao-nome">🏛️ Político</span>
                      <span className="acao-desc">+3 💰 (pode ser desafiado)</span>
                    </button>

                    <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Ajuda Externa")}>
                      <span className="acao-nome">🤝 Ajuda Externa</span>
                      <span className="acao-desc">+2 💰 (Político pode bloquear)</span>
                    </button>

                    <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Bicheiro")}>
                      <span className="acao-nome">🎰 Bicheiro</span>
                      <span className="acao-desc">Rouba 2 💰 do alvo</span>
                    </button>

                    {minhasMoedas >= 3 && (
                      <button className="btn-acao btn-vermelho" onClick={() => pedirAcao("Bandido")}>
                        <span className="acao-nome">🔪 Bandido</span>
                        <span className="acao-desc">Assassina alvo (-3 💰)</span>
                      </button>
                    )}

                    <button className="btn-acao btn-azul" onClick={() => pedirAcao("Investigar")}>
                      <span className="acao-nome">🕵️ Investigar</span>
                      <span className="acao-desc">Ver uma carta do alvo</span>
                    </button>

                    <button className="btn-acao btn-azul" onClick={() => pedirAcao("Trocar")}>
                      <span className="acao-nome">🔀 Trocar Carta</span>
                      <span className="acao-desc">Troca carta do alvo com baralho</span>
                    </button>

                    <button className="btn-acao btn-cinza" onClick={() => pedirAcao("Disfarce")}>
                      <span className="acao-nome">🎭 Disfarce</span>
                      <span className="acao-desc">Troca sua própria carta</span>
                    </button>

                    <button className="btn-acao btn-cinza" onClick={() => pedirAcao("Trabalhar")}>
                      <span className="acao-nome">⚒️ Trabalhar</span>
                      <span className="acao-desc">+1 💰 (sempre funciona)</span>
                    </button>

                    {minhasMoedas >= 7 && (
                      <button className="btn-acao btn-vermelho" onClick={() => pedirAcao("Golpe")}>
                        <span className="acao-nome">💥 DAR GOLPE</span>
                        <span className="acao-desc">-7 💰 · Alvo perde uma carta</span>
                      </button>
                    )}

                    {alvoId ? (
                      <div className="alvo-selecionado">
                        Alvo: <strong>{jogadores[alvoId]?.nome}</strong>
                        <button className="btn-limpar-alvo" onClick={() => setAlvoId(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="hint-alvo">Clique em um jogador para selecionar como alvo</div>
                    )}
                  </>
                )}

                {/* FASE DUVIDA — outros podem questionar a ação */}
                {sala.fase === "DUVIDA" &&
                  acaoPend?.autorId !== minhaInfo.id &&
                  ACOES_COM_DUVIDA.includes(acaoPend?.tipo || "") && (
                    <>
                      <div className="acoes-titulo">DUVIDAR DA AÇÃO?</div>
                      <button className="btn-acao btn-vermelho" onClick={() => reagir("DUVIDO")}>
                        <span className="acao-nome">🤔 DUVIDAR!</span>
                        <span className="acao-desc">Se ganhar: autor perde carta</span>
                      </button>
                      <button className="btn-acao btn-cinza" onClick={() => reagir("PASSAR")}>
                        <span className="acao-nome">✓ PASSAR</span>
                        <span className="acao-desc">Deixar avançar para bloqueio</span>
                      </button>
                    </>
                  )}

                {/* FASE BLOQUEIO — alvo pode bloquear com personagem */}
                {possoBloquear && (
                  <>
                    <div className="acoes-titulo">BLOQUEAR A AÇÃO?</div>
                    <button
                      className="btn-acao btn-azul"
                      onClick={() => reagir("BLOQUEIO", charParaBloquear!)}
                    >
                      <span className="acao-nome">🛡️ Bloquear com {charParaBloquear}</span>
                      <span className="acao-desc">Autor pode contestar seu bloqueio</span>
                    </button>
                    <button className="btn-acao btn-cinza" onClick={() => reagir("PASSAR")}>
                      <span className="acao-nome">✓ ACEITAR</span>
                      <span className="acao-desc">Deixar a ação acontecer</span>
                    </button>
                  </>
                )}

                {/* FASE DUVIDA_BLOQUEIO — autor pode contestar o bloqueio */}
                {faseDuvidaBloqueio && (
                  <>
                    <div className="acoes-titulo" style={{ color: "#90caf9" }}>
                      🛡️ Bloqueio com {sala.bloqueadorPersonagem}!
                    </div>
                    <div className="aguardando-msg" style={{ marginBottom: 8 }}>
                      {jogadores[sala.bloqueadorId!]?.nome} afirma ter {sala.bloqueadorPersonagem}
                    </div>
                    <button
                      className="btn-acao btn-vermelho"
                      onClick={() => contestarBloqueio(true)}
                    >
                      <span className="acao-nome">🤔 DUVIDAR DO BLOQUEIO</span>
                      <span className="acao-desc">Se vencer: ação executa; se perder: você perde carta</span>
                    </button>
                    <button
                      className="btn-acao btn-cinza"
                      onClick={() => contestarBloqueio(false)}
                    >
                      <span className="acao-nome">✓ ACEITAR BLOQUEIO</span>
                      <span className="acao-desc">Seu turno termina</span>
                    </button>
                  </>
                )}

                {/* FASE REVELAR_CARTA — investigado escolhe qual carta mostrar */}
                {faseRevelar && (
                  <>
                    <div className="acoes-titulo" style={{ color: "#90caf9" }}>
                      🕵️ INVESTIGADO! Escolha qual carta mostrar:
                    </div>
                    {minhasCartas.map((c, i) => (
                      <button
                        key={i}
                        className="btn-acao btn-azul"
                        onClick={() => revelarParaInvestigador(c)}
                      >
                        <span className="acao-nome">👁️ Mostrar: {c}</span>
                        <span className="acao-desc">O investigador verá esta carta</span>
                      </button>
                    ))}
                  </>
                )}

                {/* MENSAGENS DE AGUARDO */}
                {((sala.fase === "ACAO" && sala.vezDe !== minhaInfo.id) ||
                  (sala.fase === "DUVIDA" && acaoPend?.autorId === minhaInfo.id)) && (
                  <div className="aguardando-msg">
                    Aguardando {jogadores[sala.vezDe!]?.nome || "outro jogador"}...
                  </div>
                )}

                {sala.fase === "DUVIDA_BLOQUEIO" && !faseDuvidaBloqueio && (
                  <div className="aguardando-msg">
                    {jogadores[acaoPend?.autorId!]?.nome} está decidindo se contesta o bloqueio...
                  </div>
                )}

                {sala.fase === "BLOQUEIO" && !possoBloquear && (
                  <div className="aguardando-msg">
                    Aguardando {jogadores[acaoPend?.alvoId!]?.nome} bloquear ou aceitar...
                  </div>
                )}

                {sala.fase === "REVELAR_CARTA" && !faseRevelar && (
                  <div className="aguardando-msg">
                    {jogadores[acaoPend?.alvoId!]?.nome} está escolhendo qual carta revelar...
                  </div>
                )}

                {sala.fase === "PERDER_CARTA" && !fasePerder && (
                  <div className="aguardando-msg">
                    {jogadores[sala.quemPerde!]?.nome} está escolhendo qual carta perder...
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
              <div
                key={i}
                className={`minha-carta ${fasePerder ? "carta-perder" : ""}`}
                onClick={fasePerder ? () => confirmarPerda(i) : undefined}
                title={fasePerder ? `Perder ${c}` : undefined}
              >
                <div className="carta-topo">{fasePerder ? "⚠️" : "★"}</div>
                <div className="carta-nome">{c}</div>
                {fasePerder && (
                  <div className="carta-perder-label">CLIQUE PARA PERDER</div>
                )}
              </div>
            ))}
          </div>
          {fasePerder && (
            <div className="perder-instrucao">
              Escolha qual carta revelar e perder!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
