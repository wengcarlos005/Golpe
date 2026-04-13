interface HomeProps {
  onJogar: () => void;
}

export default function Home({ onJogar }: HomeProps) {
  return (
    <div className="home-screen">
      <div className="home-content">
        <p className="home-tagline">BLEFE. PODER. TRAIÇÃO.</p>
        <h1 className="home-logo">GOLPE</h1>
        <p className="home-subtitle">VERSÃO BRASILEIRA</p>
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
