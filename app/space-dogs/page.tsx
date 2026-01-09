"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { Game } from "./engine";
import { embriumDefense } from "./levels";

export default function SpaceDogsPage() {
  const config = embriumDefense;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{config.eyebrow}</p>
          <h1>{config.name}</h1>
          <p className={styles.status}>Under construction</p>
          <p className={styles.lead}>{config.description}</p>
        </div>
      </header>

      <Game config={config} />

      <footer className={styles.footer}>
        <Link href="/">Back to home</Link>
      </footer>
    </div>
  );
}
