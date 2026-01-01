export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Web Games</p>
        <h1>Playful prototypes, cosmic vibes.</h1>
        <p className="lead">
          A home for experimental browser games. Expect neon trails, punchy
          sprites, and ideas that ship fast.
        </p>
        <div className="cta-row">
          <a className="button" href="#ideas">
            Explore ideas
          </a>
          <a className="button ghost" href="https://github.com">
            GitHub
          </a>
        </div>
      </section>

      <section id="ideas" className="ideas">
        <div className="card">
          <h2>Space Snake</h2>
          <p>
            Neon space monster meets classic snake. Feast on asteroids, glow
            trails in the void.
          </p>
        </div>
        <div className="card">
          <h2>Space Dogs</h2>
          <p>
            3D dogfighting in asteroid fields. Rails, lightning, and cinematic
            chaos.
          </p>
        </div>
        <div className="card">
          <h2>Knights of the Forest</h2>
          <p>
            Elf knight side-scroller. Level up, unlock magic, survive the
            onslaught.
          </p>
        </div>
      </section>
    </main>
  );
}
