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
  "Bandido",
  "X9",
  "Juiz",
  "Miliciano",
];

export const PERSONAGEM_INFO: Record<string, { emoji: string; desc: string }> = {
  Político: {
    emoji: "🏛️",
    desc: "Ganha 3 moedas por turno. Pode bloquear Ajuda Externa.",
  },
  Bicheiro: {
    emoji: "🎰",
    desc: "Rouba 2 moedas de um jogador. Miliciano bloqueia.",
  },
  Bandido: {
    emoji: "🔪",
    desc: "Custa 3 moedas. Elimina uma carta do alvo. Miliciano bloqueia.",
  },
  X9: {
    emoji: "🕵️",
    desc: "Olha uma carta do alvo. Juiz bloqueia.",
  },
  Juiz: {
    emoji: "⚖️",
    desc: "Bloqueia investigações do X9.",
  },
  Miliciano: {
    emoji: "🛡️",
    desc: "Bloqueia roubos (Bicheiro) e assassinatos (Bandido).",
  },
};
