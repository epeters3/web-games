"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { Game } from "./engine";
import { getAllLevels, getLevel } from "./levels";

interface SpaceDogsClientProps {
  levelId: string;
}

export const SpaceDogsClient = ({ levelId }: SpaceDogsClientProps) => {
  const router = useRouter();
  const levels = useMemo(() => getAllLevels(), []);
  const config = getLevel(levelId) ?? levels[0];

  if (!config) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={`header-grid ${styles.header}`}>
        <div>
          <p className={`eyebrow ${styles.eyebrowSpacing}`}>
            {config.eyebrow}
          </p>
          <h1>{config.name}</h1>
          <p className={styles.status}>Under construction</p>
          <p className={`lead ${styles.leadSpacing}`}>{config.description}</p>
        </div>
        <div className={styles.levelSelect}>
          <label className={styles.levelLabel} htmlFor="level-select">
            Mission
          </label>
          <select
            id="level-select"
            className={styles.levelDropdown}
            value={levelId}
            onChange={(event) =>
              router.push(`/space-dogs/${event.target.value}/`)
            }
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.eyebrow}
              </option>
            ))}
          </select>
        </div>
      </header>

      <Game config={config} key={config.id} />

      <footer className={`footer-row ${styles.footer}`}>
        <Link className="footer-link" href="/">
          Back to home
        </Link>
      </footer>
    </div>
  );
};
