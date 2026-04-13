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
  "X9",
  "Juiz",
  "Miliciano",
  "Segurança",
];
