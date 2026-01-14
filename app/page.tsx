import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Web Games</p>
        <h1>Playful worlds, cosmic vibes.</h1>
        <p className="lead">
          A home for browser games with neon trails, punchy sprites, and plenty
          of surprises. Jump in for a quick run or stay for the long haul.
        </p>
      </section>

      <section id="ideas" className="ideas">
        <div className="card">
          <h2>Space Snake</h2>
          <p>
            Neon space monster meets classic snake. Feast on asteroids and grow
            your trail through the void.
          </p>
          <Link className="card-cta" href="/space-snake">
            Play now
          </Link>
        </div>
        <div className="card">
          <h2>Space Dogs</h2>
          <span className="card-status">Under construction</span>
          <p>
            3D dogfighting in asteroid fields. Rails, lightning, and cinematic
            chaos.
          </p>
          <Link className="card-cta" href="/space-dogs/embrium-defense/">
            Fly now
          </Link>
        </div>
        {/* <div className="card">
          <h2>Knights of the Forest</h2>
          <p>
            Elf knight side-scroller. Level up, unlock magic, survive the
            onslaught.
          </p>
        </div> */}
      </section>
    </main>
  );
}
