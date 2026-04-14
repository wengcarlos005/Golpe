export interface Jogador {
  nome: string;
  moedas: number;
  vivo: boolean;
  host: boolean;
  cartas?: string[];
}

export interface AcaoPendente {
  autorId: string;
  tipo: string;
  alvoId: string | null;
}

export interface Sala {
  iniciado: boolean;
  host: string;
  fase: string;
  vezDe?: string;
  timerFinal?: number;
  baralho?: string[];
  log?: string[];
  acaoPendente?: AcaoPendente | null;
  jogadores?: Record<string, Jogador>;
  quemPerde?: string | null;
  bloqueadorId?: string | null;
  bloqueadorPersonagem?: string | null;
  votos?: Record<string, string> | null;
}

export interface MinhaInfo {
  nome: string;
  id: string;
  sala: string;
  isHost: boolean;
}

export const PERSONAGENS = [
  "Político",
  "Bicheiro",
  "Assassino",
  "X9",
  "Juiz",
  "Miliciano",
];

export const PERSONAGEM_INFO: Record<string, { emoji: string; desc: string; icon: string }> = {
  Político: {
    emoji: "🏛️",
    icon: "fa-user-tie",
    desc: "Ganha 3 moedas por turno. Pode bloquear Ajuda Externa.",
  },
  Bicheiro: {
    emoji: "🎰",
    icon: "fa-dice",
    desc: "Rouba 2 moedas de um jogador. Miliciano bloqueia.",
  },
  Assassino: {
    emoji: "🔪",
    icon: "fa-skull",
    desc: "Custa 3 moedas. Elimina uma carta do alvo. Miliciano bloqueia.",
  },
  X9: {
    emoji: "🕵️",
    icon: "fa-mask",
    desc: "Vê carta do alvo, troca carta do alvo com o baralho, ou troca a própria carta (Disfarce). Juiz bloqueia.",
  },
  Juiz: {
    emoji: "⚖️",
    icon: "fa-gavel",
    desc: "Bloqueia investigações do X9.",
  },
  Miliciano: {
    emoji: "🛡️",
    icon: "fa-shield-halved",
    desc: "Bloqueia roubos (Bicheiro) e assassinatos (Assassino).",
  },
};

// Brazilian slang display names for actions
export const ACAO_DISPLAY: Record<string, { label: string; desc: string }> = {
  "Político":      { label: "🏛️ Faz o L",             desc: "+3 💰 (pode ser desafiado)" },
  "Ajuda Externa": { label: "💸 Imposto é Roubo",      desc: "+2 💰 (Político pode bloquear)" },
  "Bicheiro":      { label: "🎰 Puxar o Bicho",        desc: "Rouba 2 💰 do alvo" },
  "Assassino":     { label: "🔪 Mandar pro Vasco",     desc: "Elimina carta do alvo (-3 💰)" },
  "Investigar":    { label: "🕵️ Acionar o X9",         desc: "Ver uma carta do alvo" },
  "Trocar":        { label: "🔀 X9: Trocar Carta",     desc: "Troca carta do alvo com baralho (-1 💰)" },
  "Disfarce":      { label: "🎭 X9: Disfarce",         desc: "Troca sua própria carta" },
  "Trabalhar":     { label: "⚒️ Trampo Suado",         desc: "+1 💰 (sempre funciona)" },
  "Golpe":         { label: "💥 DAR GOLPE",             desc: "-7 💰 · Alvo perde uma carta" },
};
