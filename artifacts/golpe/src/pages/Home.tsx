import { useState } from "react";
import { PERSONAGEM_INFO } from "../types";

interface HomeProps {
  onJogar: () => void;
}

export default function Home({ onJogar }: HomeProps) {
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  return (
    <div className="home-screen">
      <div className="home-content">
        <p className="home-tagline">BLEFE. PODER. TRAIÇÃO.</p>
        <h1 className="home-logo">GOLPE</h1>

        <div className="desc-box">
          {selectedChar ? (
            <>
              <strong style={{ color: "var(--gold)" }}>{selectedChar}</strong>
              {": "}
              {PERSONAGEM_INFO[selectedChar].desc}
            </>
          ) : (
            <span style={{ opacity: 0.5 }}>
              Clique em um personagem para ver suas habilidades
            </span>
          )}
        </div>

        <div className="char-row">
          {Object.entries(PERSONAGEM_INFO).map(([nome, info]) => (
            <div
              key={nome}
              className={`char-card-small ${selectedChar === nome ? "char-selected" : ""}`}
              onClick={() =>
                setSelectedChar(selectedChar === nome ? null : nome)
              }
            >
              <div className="char-emoji">{info.emoji}</div>
              <div className="char-nome">{nome}</div>
            </div>
          ))}
        </div>

        <button className="btn-yellow btn-large" onClick={onJogar}>
          JOGAR AGORA →
        </button>
      </div>
      <div className="home-particles">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`particle particle-${i}`} />
        ))}
      </div>
    </div>
  );
}
