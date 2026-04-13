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
    desc: "Ganha 3 moedas. Bloqueia Ajuda Externa.",
  },
  Bicheiro: {
    emoji: "🎰",
    desc: "Rouba 2 moedas de um alvo. Miliciano bloqueia.",
  },
  Bandido: {
    emoji: "🔪",
    desc: "Assassina (alvo perde carta). Custa 3 moedas. Miliciano bloqueia.",
  },
  X9: {
    emoji: "🕵️",
    desc: "Investiga uma carta do alvo.",
  },
  Juiz: {
    emoji: "⚖️",
    desc: "Bloqueia investigação do X9.",
  },
  Miliciano: {
    emoji: "🛡️",
    desc: "Bloqueia Bandido e Bicheiro.",
  },
};
