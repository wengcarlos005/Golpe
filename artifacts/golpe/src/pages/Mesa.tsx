import { useEffect, useRef, useState, useCallback } from "react";
import { ref, onValue, update, get, set } from "firebase/database";
import { db } from "../firebase";
import { Sala, MinhaInfo, AcaoPendente, ACAO_DISPLAY, PERSONAGEM_INFO } from "../types";

interface MesaProps {
  minhaInfo: MinhaInfo;
}

const ACOES_COM_ALVO = ["Bicheiro", "Assassino", "Investigar", "Trocar", "Golpe"];

const BLOQUEADOR_CHAR: Record<string, string> = {
  "Ajuda Externa": "Político",
  "Bicheiro":      "Miliciano",
  "Assassino":     "Miliciano",
  "Investigar":    "Juiz",
  "Trocar":        "Juiz",
  "Disfarce":      "Juiz",
};

const ACOES_COM_DUVIDA = ["Político", "Bicheiro", "Assassino", "Investigar", "Trocar", "Disfarce"];

function getFaseInicial(tipo: string): string {
  if (tipo === "Trabalhar" || tipo === "Golpe") return "EXECUCAO";
  if (tipo === "Ajuda Externa") return "BLOQUEIO";
  return "DUVIDA";
}

function getCardIcon(carta: string): string {
  return PERSONAGEM_INFO[carta]?.icon || "fa-id-card";
}

const PIADAS_DUVIDAR = [
  "O golpe tá aí, cai quem quer!",
  "Aqui não, violão!",
  "Malandro demais o bicho come.",
  "Tentou a sorte mas o azar é certo.",
  "Blefe detectado, sistema antifraude ativado!",
  "Para! Isso é uma emboscada!",
];

const PIADAS_PERDA = [
  "Mais um que caiu no conto do vigário.",
  "Assim não dá, meu parceiro.",
  "A conta chegou.",
  "Quem vive de blefe, morre de vergonha.",
  "Era um bom soldado.",
];

function piada(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Mesa({ minhaInfo }: MesaProps) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [timerPercent, setTimerPercent] = useState(100);
  const [tempoRestante, setTempoRestante] = useState(30);
  const [x9Popup, setX9Popup] = useState<{ alvoNome: string; carta: string } | null>(null);
  const executandoRef = useRef(false);

  // ─── Core helpers ────────────────────────────────────────

  const passarTurno = useCallback(async () => {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    if (!d) return;
    const ids = Object.keys(d.jogadores || {}).filter(
      (id) => (d.jogadores![id].cartas || []).length > 0
    );
    const prox = ids[(ids.indexOf(d.vezDe!) + 1) % ids.length];
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      vezDe: prox, fase: "ACAO", timerFinal: Date.now() + 30000,
      acaoPendente: null, quemPerde: null,
      bloqueadorId: null, bloqueadorPersonagem: null, votos: null,
    });
    setAlvoId(null);
    executandoRef.current = false;
  }, [minhaInfo.sala]);

  const entrarFasePerda = useCallback(async (id: string) => {
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      fase: "PERDER_CARTA", quemPerde: id, votos: null,
      timerFinal: Date.now() + 15000,
    });
  }, [minhaInfo.sala]);

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

    if (a.tipo === "Político")     upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 3;
    if (a.tipo === "Ajuda Externa") upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 2;
    if (a.tipo === "Trabalhar")    upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 1;
    if (a.tipo === "Bicheiro") {
      upd[`jogadores/${a.autorId}/moedas`] = aut.moedas + 2;
      upd[`jogadores/${a.alvoId!}/moedas`] = Math.max(0, d.jogadores![a.alvoId!].moedas - 2);
    }
    if (a.tipo === "Assassino") {
      upd[`jogadores/${a.autorId}/moedas`] = Math.max(0, aut.moedas - 3);
      upd.acaoPendente = null; upd.votos = null;
      await update(ref(db, `salas/${minhaInfo.sala}`), upd);
      await entrarFasePerda(a.alvoId!);
      executandoRef.current = false; return;
    }
    if (a.tipo === "Golpe") {
      upd[`jogadores/${a.autorId}/moedas`] = Math.max(0, aut.moedas - 7);
      upd.acaoPendente = null; upd.votos = null;
      await update(ref(db, `salas/${minhaInfo.sala}`), upd);
      await entrarFasePerda(a.alvoId!);
      executandoRef.current = false; return;
    }
    if (a.tipo === "Investigar") {
      upd.fase = "REVELAR_CARTA"; upd.votos = null;
      upd.timerFinal = Date.now() + 15000;
      await update(ref(db, `salas/${minhaInfo.sala}`), upd);
      executandoRef.current = false; return;
    }
    if (a.tipo === "Trocar") {
      upd[`jogadores/${a.autorId}/moedas`] = Math.max(0, aut.moedas - 1);
      const alvoCa = [...(d.jogadores![a.alvoId!].cartas || [])];
      if (alvoCa.length > 0) {
        baralho.push(alvoCa.pop()!); baralho.sort(() => Math.random() - 0.5);
        if (baralho.length > 0) alvoCa.push(baralho.pop()!);
      }
      upd[`jogadores/${a.alvoId!}/cartas`] = alvoCa; upd.baralho = baralho;
    }
    if (a.tipo === "Disfarce") {
      const autCa = [...(aut.cartas || [])];
      if (autCa.length > 0) {
        baralho.push(autCa.pop()!); baralho.sort(() => Math.random() - 0.5);
        if (baralho.length > 0) autCa.push(baralho.pop()!);
      }
      upd[`jogadores/${a.autorId}/cartas`] = autCa; upd.baralho = baralho;
    }

    upd.fase = "ACAO"; upd.acaoPendente = null;
    upd.quemPerde = null; upd.bloqueadorId = null;
    upd.bloqueadorPersonagem = null; upd.votos = null;
    await update(ref(db, `salas/${minhaInfo.sala}`), upd);
    await passarTurno();
  }, [minhaInfo.sala, passarTurno, entrarFasePerda]);

  // ─── Voting ──────────────────────────────────────────────

  async function votar(tipo: "DUVIDAR" | "PASSAR" | "BLOQUEIO", char?: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    const a = d.acaoPendente as AcaoPendente;

    if (tipo === "DUVIDAR") {
      const cartaNecessaria = ["Investigar", "Trocar", "Disfarce"].includes(a.tipo) ? "X9" : a.tipo;
      const temCarta = (d.jogadores![a.autorId].cartas || []).includes(cartaNecessaria);
      if (temCarta) {
        await adicionarLog(`🤔 ${minhaInfo.nome} duvidou mas ${d.jogadores![a.autorId]?.nome} tinha o ${cartaNecessaria}! "${piada(PIADAS_DUVIDAR)}"`);
        await entrarFasePerda(minhaInfo.id);
      } else {
        await adicionarLog(`🤔 ${minhaInfo.nome} duvidou! ${d.jogadores![a.autorId]?.nome} tava blefando! "${piada(PIADAS_DUVIDAR)}"`);
        await entrarFasePerda(a.autorId);
      }
      return;
    }

    if (tipo === "BLOQUEIO" && char) {
      await adicionarLog(`🛡️ ${minhaInfo.nome} bloqueou com ${char}! Espera que isso cheira a blefe...`);
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "DUVIDA_BLOQUEIO", bloqueadorId: minhaInfo.id,
        bloqueadorPersonagem: char, votos: null,
        timerFinal: Date.now() + 10000,
      });
      return;
    }

    await update(ref(db, `salas/${minhaInfo.sala}/votos/${minhaInfo.id}`), "PASSAR");
    const snap2 = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d2 = snap2.val() as Sala;
    const vivos = Object.keys(d2.jogadores || {}).filter(
      (id) => (d2.jogadores![id].cartas || []).length > 0
    );
    const votosCount = Object.keys(d2.votos || {}).length;
    if (votosCount >= vivos.length - 1) {
      if (d2.fase === "DUVIDA") {
        await update(ref(db, `salas/${minhaInfo.sala}`), {
          fase: "BLOQUEIO", votos: null, timerFinal: Date.now() + 10000,
        });
      } else if (d2.fase === "BLOQUEIO") {
        await executarEfeito();
      }
    }
  }

  async function contestarBloqueio(duvidar: boolean) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    if (!duvidar) {
      await adicionarLog(`✓ ${minhaInfo.nome} aceitou o bloqueio`);
      await update(ref(db, `salas/${minhaInfo.sala}`), {
        fase: "ACAO", acaoPendente: null,
        bloqueadorId: null, bloqueadorPersonagem: null, votos: null,
      });
      await passarTurno(); return;
    }
    const tem = (d.jogadores![d.bloqueadorId!]?.cartas || []).includes(d.bloqueadorPersonagem!);
    if (tem) {
      await adicionarLog(`🛡️ Bloqueio válido! ${d.jogadores![d.bloqueadorId!]?.nome} tinha ${d.bloqueadorPersonagem}`);
      await entrarFasePerda(minhaInfo.id);
    } else {
      await adicionarLog(`❌ Bloqueio falso! ${d.jogadores![d.bloqueadorId!]?.nome} tava blefando!`);
      await entrarFasePerda(d.bloqueadorId!);
    }
  }

  useEffect(() => {
    const unsub = onValue(ref(db, `salas/${minhaInfo.sala}`), (snap) => {
      const data = snap.val() as Sala;
      setSala(data);
      if (data?.x9Privado && data.x9Privado.para === minhaInfo.id) {
        setX9Popup({ alvoNome: data.x9Privado.alvoNome, carta: data.x9Privado.carta });
        set(ref(db, `salas/${minhaInfo.sala}/x9Privado`), null);
      }
    });
    return () => unsub();
  }, [minhaInfo.sala, minhaInfo.id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
      const d = snap.val() as Sala;
      if (!d || !d.iniciado || !d.timerFinal) return;
      const restante = d.timerFinal - Date.now();
      const total = d.fase === "ACAO" ? 30000 : 15000;
      setTimerPercent(Math.max(0, (restante / total) * 100));
      setTempoRestante(Math.max(0, Math.floor(restante / 1000)));
      if (restante <= 0 && !executandoRef.current) {
        if (d.fase === "ACAO" && d.vezDe === minhaInfo.id) await passarTurno();
        else if (d.fase === "PERDER_CARTA" && d.quemPerde === minhaInfo.id) await confirmarPerda(0);
        else if (d.fase === "REVELAR_CARTA" && d.acaoPendente?.alvoId === minhaInfo.id) {
          const c = d.jogadores?.[minhaInfo.id]?.cartas || [];
          if (c.length > 0) await revelarParaX9(c[0]);
        } else if (
          (d.fase === "DUVIDA" || d.fase === "BLOQUEIO") &&
          d.vezDe === minhaInfo.id
        ) await executarEfeito();
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
    const snap = await get(ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/cartas`));
    const cartas = (snap.val() as string[]) || [];
    const perdida = cartas[idx];
    cartas.splice(idx, 1);
    await set(ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/cartas`), cartas);
    await adicionarLog(`💀 ${minhaInfo.nome} perdeu ${perdida}. ${piada(PIADAS_PERDA)}`);
    await update(ref(db, `salas/${minhaInfo.sala}`), { fase: "ACAO", quemPerde: null });
    await passarTurno();
  }

  async function revelarParaX9(carta: string) {
    const snap = await get(ref(db, `salas/${minhaInfo.sala}`));
    const d = snap.val() as Sala;
    const autorId = d.acaoPendente?.autorId;
    const autorNome = d.jogadores?.[autorId!]?.nome || "X9";
    await adicionarLog(`🕵️ ${minhaInfo.nome} mostrou uma carta para ${autorNome}... eles sabem de tudo agora.`);
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      fase: "ACAO",
      acaoPendente: null,
      x9Privado: { para: autorId, alvoNome: minhaInfo.nome, carta },
    });
    await passarTurno();
  }

  async function pedirAcao(tipo: string) {
    if (ACOES_COM_ALVO.includes(tipo) && !alvoId) {
      alert("Selecione um alvo clicando em um jogador!");
      return;
    }
    const snap = await get(ref(db, `salas/${minhaInfo.sala}/jogadores/${minhaInfo.id}/moedas`));
    const moedas = snap.val() as number;
    if (tipo === "Assassino" && moedas < 3) { alert("Precisa de 3 moedas!"); return; }
    if (tipo === "Golpe"     && moedas < 7) { alert("Precisa de 7 moedas!"); return; }
    if (tipo === "Trocar"    && moedas < 1) { alert("Precisa de 1 moeda!");  return; }

    const fase = getFaseInicial(tipo);
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      acaoPendente: { autorId: minhaInfo.id, tipo, alvoId: alvoId || null },
      fase, timerFinal: Date.now() + 10000, votos: {},
    });
    const d = ACAO_DISPLAY[tipo];
    const alvoNome = alvoId ? (await get(ref(db, `salas/${minhaInfo.sala}/jogadores/${alvoId}/nome`))).val() : null;
    const logMsg = alvoNome
      ? `🚩 ${minhaInfo.nome} tentou ${d?.label || tipo} em ${alvoNome}!`
      : `🚩 ${minhaInfo.nome} tentou ${d?.label || tipo}!`;
    await adicionarLog(logMsg);
    if (fase === "EXECUCAO") await executarEfeito();
  }

  async function reiniciarJogo() {
    await update(ref(db, `salas/${minhaInfo.sala}`), {
      iniciado: false, fase: "ESPERA", timerFinal: null,
      acaoPendente: null, quemPerde: null,
      bloqueadorId: null, bloqueadorPersonagem: null, votos: null, log: [],
    });
  }

  // ─── Render ──────────────────────────────────────────────

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
  const ativos = Object.keys(jogadores).filter((id) => (jogadores[id].cartas || []).length > 0);
  const vencedor = ativos.length === 1 ? jogadores[ativos[0]] : null;
  const minhasMoedas = eu?.moedas ?? 0;
  const acaoPend = sala.acaoPendente;
  const forcaGolpe = minhasMoedas >= 10;

  const fasePerder   = sala.fase === "PERDER_CARTA"  && sala.quemPerde === minhaInfo.id;
  const faseRevelar  = sala.fase === "REVELAR_CARTA" && acaoPend?.alvoId === minhaInfo.id;
  const faseDuvidaBlq = sala.fase === "DUVIDA_BLOQUEIO" && acaoPend?.autorId === minhaInfo.id;
  const jaVotei      = !!(sala.votos && sala.votos[minhaInfo.id]);
  const ehAutor      = acaoPend?.autorId === minhaInfo.id;
  const podeDuvidar  = !ehAutor && !jaVotei && sala.fase === "DUVIDA" && ACOES_COM_DUVIDA.includes(acaoPend?.tipo || "");
  const possoBloquear = !ehAutor && !jaVotei && sala.fase === "BLOQUEIO" && acaoPend?.alvoId === minhaInfo.id && !!BLOQUEADOR_CHAR[acaoPend?.tipo || ""];
  const podePasar    = !ehAutor && !jaVotei && (sala.fase === "DUVIDA" || sala.fase === "BLOQUEIO");
  const votosCount   = Object.keys(sala.votos || {}).length;
  const totalVotos   = ativos.length - 1;

  // Circular adversary positions
  const adversarios = Object.entries(jogadores).filter(([id]) => id !== minhaInfo.id);
  const RAIO = 220;

  return (
    <div className="mesa-wrapper">
      <div className="ui-mesa-completa">

        {/* LOG */}
        <div className="log-container">
          {(sala.log || []).slice().reverse().slice(0, 20).map((msg, i) => (
            <div key={i} className="action-msg">{msg}</div>
          ))}
          <div className="log-titulo">HISTÓRICO</div>
        </div>

        {/* ARENA — circular table */}
        <div className="arena">
          {/* Timer circle */}
          <div className={`timer-circle ${sala.fase !== "ACAO" ? "timer-reaction" : ""}`}>
            <div className="timer-val">{tempoRestante}</div>
            <div className="timer-sub">{sala.fase === "ACAO" ? "AÇÃO" : "REAÇÃO"}</div>
            <svg className="timer-ring" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={sala.fase === "ACAO" ? "#ffcc00" : "#ff3b3b"}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerPercent / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>

          {/* Adversários posicionados em círculo */}
          <div className="table-ring">
            {adversarios.map(([id, j], i) => {
              const angle = (i / adversarios.length) * 2 * Math.PI - Math.PI / 2;
              const x = Math.cos(angle) * RAIO;
              const y = Math.sin(angle) * RAIO;
              const vivo = (j.cartas || []).length > 0;
              const isVez = id === sala.vezDe;
              const isAlvo = id === alvoId;
              const isPerdendo = sala.fase === "PERDER_CARTA" && sala.quemPerde === id;
              const isRevelando = sala.fase === "REVELAR_CARTA" && acaoPend?.alvoId === id;
              const votouPasar = !!(sala.votos && sala.votos[id]);
              return (
                <div
                  key={id}
                  className={`node-jogador ${isVez ? "node-vez" : ""} ${isAlvo ? "node-alvo" : ""} ${!vivo ? "node-morto" : ""} ${isPerdendo ? "node-perdendo" : ""}`}
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  onClick={() => vivo && setAlvoId(id === alvoId ? null : id)}
                >
                  <div className="node-nome">{j.nome}</div>
                  <div className="node-moedas">💰 {j.moedas}</div>
                  <div className="node-cartas">
                    {(j.cartas || []).map((_, ci) => (
                      <div key={ci} className="node-carta-dot" />
                    ))}
                  </div>
                  {isPerdendo && <div className="node-badge badge-red">ESCOLHENDO</div>}
                  {isRevelando && <div className="node-badge badge-blue">REVELANDO</div>}
                  {votouPasar && (sala.fase === "DUVIDA" || sala.fase === "BLOQUEIO") && (
                    <div className="node-badge badge-green">✓</div>
                  )}
                  {isVez && vivo && !isPerdendo && !isRevelando && (
                    <div className="node-badge badge-gold">VEZ</div>
                  )}
                  {isAlvo && <div className="node-target-ring" />}
                </div>
              );
            })}
          </div>

          {/* Status overlay on arena */}
          {acaoPend && sala.fase !== "PERDER_CARTA" && (
            <div className="arena-status-badge">
              {jogadores[acaoPend.autorId]?.nome}: <strong>{ACAO_DISPLAY[acaoPend.tipo]?.label || acaoPend.tipo}</strong>
              {acaoPend.alvoId && <> → {jogadores[acaoPend.alvoId]?.nome}</>}
              {(sala.fase === "DUVIDA" || sala.fase === "BLOQUEIO") && totalVotos > 0 && (
                <span className="votos-mini"> ({votosCount}/{totalVotos} ✓)</span>
              )}
            </div>
          )}
          {sala.fase === "DUVIDA_BLOQUEIO" && sala.bloqueadorId && (
            <div className="arena-status-badge badge-blue-bg">
              🛡️ {jogadores[sala.bloqueadorId]?.nome} bloqueou com <strong>{sala.bloqueadorPersonagem}</strong>
            </div>
          )}
          {sala.fase === "PERDER_CARTA" && sala.quemPerde && (
            <div className="arena-status-badge badge-red-bg">
              ⚠️ {jogadores[sala.quemPerde]?.nome} escolhendo qual carta perder
            </div>
          )}
        </div>

        {/* MENU AÇÕES */}
        <div className="menu-acoes">
          <div className="timer-section">
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${timerPercent}%`, background: sala.fase === "ACAO" ? undefined : "#ff3b3b" }} />
            </div>
          </div>

          <div className="area-botoes">
            {vencedor ? (
              <>
                <div className="vencedor-banner">🏆 {vencedor.nome.toUpperCase()} VENCEU!</div>
                {minhaInfo.isHost && (
                  <button className="btn-acao btn-amarelo" style={{ marginTop: 12 }} onClick={reiniciarJogo}>
                    <span className="acao-nome">🔄 NOVO JOGO</span>
                    <span className="acao-desc">Voltar ao lobby</span>
                  </button>
                )}
              </>
            ) : minhasCartas.length === 0 ? (
              <div className="fora-jogo">Você está fora do jogo.</div>
            ) : (
              <>
                {/* SUA VEZ */}
                {sala.fase === "ACAO" && sala.vezDe === minhaInfo.id && (
                  <>
                    <div className="acoes-titulo">SUA VEZ</div>

                    {forcaGolpe ? (
                      <>
                        <div className="alerta-10">⚠️ 10+ moedas — só pode GOLPE!</div>
                        {alvoId && (
                          <button className="btn-acao btn-vermelho" onClick={() => pedirAcao("Golpe")}>
                            <span className="acao-nome">💥 DAR GOLPE</span>
                            <span className="acao-desc">-7 💰 · Alvo perde uma carta</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button className="btn-acao btn-cinza" onClick={() => pedirAcao("Trabalhar")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Trabalhar"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Trabalhar"].desc}</span>
                        </button>
                        <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Ajuda Externa")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Ajuda Externa"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Ajuda Externa"].desc}</span>
                        </button>
                        <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Político")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Político"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Político"].desc}</span>
                        </button>
                        <button className="btn-acao btn-amarelo" onClick={() => pedirAcao("Bicheiro")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Bicheiro"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Bicheiro"].desc}</span>
                        </button>
                        {minhasMoedas >= 3 && (
                          <button className="btn-acao btn-vermelho" onClick={() => pedirAcao("Assassino")}>
                            <span className="acao-nome">{ACAO_DISPLAY["Assassino"].label}</span>
                            <span className="acao-desc">{ACAO_DISPLAY["Assassino"].desc}</span>
                          </button>
                        )}
                        <button className="btn-acao btn-azul" onClick={() => pedirAcao("Investigar")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Investigar"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Investigar"].desc}</span>
                        </button>
                        <button className="btn-acao btn-azul" onClick={() => pedirAcao("Trocar")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Trocar"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Trocar"].desc}</span>
                        </button>
                        <button className="btn-acao btn-cinza" onClick={() => pedirAcao("Disfarce")}>
                          <span className="acao-nome">{ACAO_DISPLAY["Disfarce"].label}</span>
                          <span className="acao-desc">{ACAO_DISPLAY["Disfarce"].desc}</span>
                        </button>
                        {minhasMoedas >= 7 && (
                          <button className="btn-acao btn-vermelho" onClick={() => pedirAcao("Golpe")}>
                            <span className="acao-nome">{ACAO_DISPLAY["Golpe"].label}</span>
                            <span className="acao-desc">{ACAO_DISPLAY["Golpe"].desc}</span>
                          </button>
                        )}
                      </>
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

                {/* VOTAÇÃO */}
                {(podeDuvidar || possoBloquear || podePasar) && (
                  <>
                    <div className="acoes-titulo" style={{ color: sala.fase === "DUVIDA" ? "#ff8a65" : "#90caf9" }}>
                      {sala.fase === "DUVIDA" ? "DUVIDAR DA AÇÃO?" : "BLOQUEAR A AÇÃO?"}
                    </div>
                    {podeDuvidar && (
                      <button className="btn-acao btn-vermelho" onClick={() => votar("DUVIDAR")}>
                        <span className="acao-nome">🤔 DUVIDAR!</span>
                        <span className="acao-desc">Resolve imediatamente</span>
                      </button>
                    )}
                    {possoBloquear && (
                      <button className="btn-acao btn-azul" onClick={() => votar("BLOQUEIO", BLOQUEADOR_CHAR[acaoPend!.tipo])}>
                        <span className="acao-nome">🛡️ Bloquear com {BLOQUEADOR_CHAR[acaoPend!.tipo]}</span>
                        <span className="acao-desc">Autor pode contestar</span>
                      </button>
                    )}
                    {podePasar && (
                      <button className="btn-acao btn-cinza" onClick={() => votar("PASSAR")}>
                        <span className="acao-nome">✓ PASSAR</span>
                        <span className="acao-desc">{sala.fase === "DUVIDA" ? "Avança para bloqueio" : "Deixa acontecer"}</span>
                      </button>
                    )}
                  </>
                )}

                {jaVotei && (sala.fase === "DUVIDA" || sala.fase === "BLOQUEIO") && (
                  <div className="aguardando-msg">Você confirmou ✓ ({votosCount}/{totalVotos})</div>
                )}

                {/* DUVIDA_BLOQUEIO */}
                {faseDuvidaBlq && (
                  <>
                    <div className="acoes-titulo" style={{ color: "#90caf9" }}>🛡️ Bloqueio!</div>
                    <div className="aguardando-msg" style={{ marginBottom: 8 }}>
                      {jogadores[sala.bloqueadorId!]?.nome} afirma ter {sala.bloqueadorPersonagem}
                    </div>
                    <button className="btn-acao btn-vermelho" onClick={() => contestarBloqueio(true)}>
                      <span className="acao-nome">🤔 DUVIDAR DO BLOQUEIO</span>
                      <span className="acao-desc">Vencer: ação executa · Perder: você perde carta</span>
                    </button>
                    <button className="btn-acao btn-cinza" onClick={() => contestarBloqueio(false)}>
                      <span className="acao-nome">✓ ACEITAR BLOQUEIO</span>
                      <span className="acao-desc">Seu turno termina</span>
                    </button>
                  </>
                )}

                {sala.fase === "DUVIDA_BLOQUEIO" && !faseDuvidaBlq && (
                  <div className="aguardando-msg">{jogadores[acaoPend?.autorId!]?.nome} decidindo se contesta...</div>
                )}

                {/* REVELAR_CARTA */}
                {faseRevelar && (
                  <>
                    <div className="acoes-titulo" style={{ color: "#90caf9" }}>🕵️ X9 TE INVESTIGOU!</div>
                    {minhasCartas.map((c, i) => (
                      <button key={i} className="btn-acao btn-azul" onClick={() => revelarParaX9(c)}>
                        <span className="acao-nome">👁️ Mostrar: {c}</span>
                        <span className="acao-desc">O X9 verá esta carta</span>
                      </button>
                    ))}
                  </>
                )}
                {sala.fase === "REVELAR_CARTA" && !faseRevelar && (
                  <div className="aguardando-msg">{jogadores[acaoPend?.alvoId!]?.nome} escolhendo qual carta mostrar...</div>
                )}
                {sala.fase === "PERDER_CARTA" && !fasePerder && (
                  <div className="aguardando-msg">{jogadores[sala.quemPerde!]?.nome} escolhendo qual carta perder...</div>
                )}
                {sala.fase === "ACAO" && sala.vezDe !== minhaInfo.id && (
                  <div className="aguardando-msg">Vez de {jogadores[sala.vezDe!]?.nome || "..."}...</div>
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
              >
                <i className={`fa-solid ${getCardIcon(c)} carta-icon`} />
                <div className="carta-nome">{c}</div>
                {fasePerder && <div className="carta-perder-label">PERDER</div>}
              </div>
            ))}
          </div>
          {fasePerder && <div className="perder-instrucao">Escolha qual carta perder!</div>}
        </div>

      </div>
    </div>
  );
}
