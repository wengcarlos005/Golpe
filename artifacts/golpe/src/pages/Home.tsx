import { useState } from "react";
import { PERSONAGEM_INFO } from "../types";

interface HomeProps {
  onJogar: () => void;
}

export default function Home({ onJogar }: HomeProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="home-screen">
      <div className="home-content">
        <p className="home-tagline">BLEFE. PODER. TRAIÇÃO.</p>
        <h1 className="home-logo">GOLPE</h1>
        <p className="home-subtitle">VERSÃO BRASILEIRA</p>
        <button className="btn-yellow btn-large" onClick={onJogar}>
          JOGAR AGORA →
        </button>

        <div className="char-grid">
          {Object.entries(PERSONAGEM_INFO).map(([nome, info]) => (
            <div
              key={nome}
              className="char-item"
              onClick={() => setTooltip(tooltip === nome ? null : nome)}
            >
              <div className="char-emoji">{info.emoji}</div>
              <div className="char-nome">{nome}</div>
              {tooltip === nome && (
                <div className="char-tooltip">{info.desc}</div>
              )}
            </div>
          ))}
        </div>
        <p className="char-hint">Clique nos personagens para ver as habilidades</p>
      </div>
      <div className="home-particles">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`particle particle-${i}`} />
        ))}
      </div>
    </div>
  );
}
