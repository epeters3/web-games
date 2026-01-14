"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Vec = { x: number; y: number };

type GameState = {
  snake: Vec[];
  direction: Vec;
  pendingDirection: Vec | null;
  food: Vec;
  score: number;
  isRunning: boolean;
  isGameOver: boolean;
};

const GRID_SIZE = 22;
const CELL_SIZE = 28;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const STEP_MS = 110;

const DIRECTIONS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const NEON = {
  background: "#090a12",
  grid: "rgba(255,255,255,0.05)",
  snake: "#3cf0d2",
  snakeGlow: "rgba(60, 240, 210, 0.6)",
  head: "#ff6f91",
  food: "#f9e65c",
  text: "#f8f5ff",
};

const createInitialState = (): GameState => {
  const center = Math.floor(GRID_SIZE / 2);
  return {
    snake: [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ],
    direction: { x: 1, y: 0 },
    pendingDirection: null,
    food: { x: 4, y: 4 },
    score: 0,
    isRunning: false,
    isGameOver: false,
  };
};

const isOpposite = (a: Vec, b: Vec) => a.x + b.x === 0 && a.y + b.y === 0;

const positionKey = (pos: Vec) => `${pos.x},${pos.y}`;

const placeFood = (snake: Vec[]) => {
  const occupied = new Set(snake.map(positionKey));
  const free: Vec[] = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = positionKey({ x, y });
      if (!occupied.has(key)) {
        free.push({ x, y });
      }
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
};

export default function SpaceSnakePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [game, setGame] = useState<GameState>(() => {
    const initial = createInitialState();
    return { ...initial, food: placeFood(initial.snake) };
  });
  const gameRef = useRef<GameState>(game);
  const lastStepRef = useRef<number>(0);
  const starsRef = useRef<Vec[]>([]);
  const frameRef = useRef<number | null>(null);

  const scoreLabel = useMemo(
    () => game.score.toString().padStart(2, "0"),
    [game.score]
  );

  const resetGame = useCallback(() => {
    setGame(() => {
      const initial = createInitialState();
      return { ...initial, food: placeFood(initial.snake) };
    });
    lastStepRef.current = 0;
  }, []);

  const toggleRun = useCallback(() => {
    setGame((prev) => {
      if (prev.isGameOver) {
        return prev;
      }
      return { ...prev, isRunning: !prev.isRunning };
    });
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        toggleRun();
        return;
      }
      if (event.code === "KeyR") {
        resetGame();
        return;
      }
      const next = DIRECTIONS[event.code];
      if (!next) {
        return;
      }
      setGame((prev) => {
        if (prev.isGameOver) {
          return prev;
        }
        if (isOpposite(prev.direction, next)) {
          return prev;
        }
        return { ...prev, pendingDirection: next, isRunning: true };
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resetGame, toggleRun]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    if (starsRef.current.length === 0) {
      starsRef.current = Array.from({ length: 120 }, () => ({
        x: Math.random() * CANVAS_SIZE,
        y: Math.random() * CANVAS_SIZE,
      }));
    }

    let isActive = true;
    const draw = (timestamp: number) => {
      if (!isActive) {
        return;
      }
      const time = timestamp || 0;
      if (!lastStepRef.current) {
        lastStepRef.current = time;
      }

      const current = gameRef.current;
      if (
        current.isRunning &&
        !current.isGameOver &&
        time - lastStepRef.current > STEP_MS
      ) {
        lastStepRef.current = time;
        setGame((prev) => {
          if (!prev.isRunning || prev.isGameOver) {
            return prev;
          }
          const direction = prev.pendingDirection ?? prev.direction;
          const nextHead = {
            x: (prev.snake[0].x + direction.x + GRID_SIZE) % GRID_SIZE,
            y: (prev.snake[0].y + direction.y + GRID_SIZE) % GRID_SIZE,
          };

          const snakeSet = new Set(prev.snake.map(positionKey));
          if (snakeSet.has(positionKey(nextHead))) {
            return { ...prev, isRunning: false, isGameOver: true };
          }

          const ateFood =
            nextHead.x === prev.food.x && nextHead.y === prev.food.y;
          const newSnake = [nextHead, ...prev.snake];
          if (!ateFood) {
            newSnake.pop();
          }

          return {
            snake: newSnake,
            direction,
            pendingDirection: null,
            food: ateFood ? placeFood(newSnake) : prev.food,
            score: ateFood ? prev.score + 1 : prev.score,
            isRunning: prev.isRunning,
            isGameOver: false,
          };
        });
      }

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const gradient = ctx.createRadialGradient(
        CANVAS_SIZE * 0.4,
        CANVAS_SIZE * 0.2,
        20,
        CANVAS_SIZE * 0.4,
        CANVAS_SIZE * 0.2,
        CANVAS_SIZE * 0.8
      );
      gradient.addColorStop(0, "#101634");
      gradient.addColorStop(0.5, NEON.background);
      gradient.addColorStop(1, "#05060c");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.strokeStyle = NEON.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i += 1) {
        const pos = i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(CANVAS_SIZE, pos);
        ctx.stroke();
      }

      for (const star of starsRef.current) {
        const twinkle = 0.4 + 0.6 * Math.sin(time / 400 + star.x);
        ctx.fillStyle = `rgba(255,255,255,${0.2 + twinkle * 0.4})`;
        ctx.fillRect(star.x, star.y, 1.6, 1.6);
      }

      const drawCell = (pos: Vec, color: string, glow?: string) => {
        const x = pos.x * CELL_SIZE;
        const y = pos.y * CELL_SIZE;
        if (glow) {
          ctx.shadowColor = glow;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = color;
        const inset = 3;
        const size = CELL_SIZE - inset * 2;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, size, size, 6);
        ctx.fill();
      };

      gameRef.current.snake.forEach((segment, index) => {
        const color = index === 0 ? NEON.head : NEON.snake;
        const glow = index === 0 ? "rgba(255, 111, 145, 0.65)" : NEON.snakeGlow;
        drawCell(segment, color, glow);
      });

      ctx.shadowBlur = 0;
      const pulse = 0.6 + 0.4 * Math.sin(time / 180);
      ctx.fillStyle = NEON.food;
      const foodX = gameRef.current.food.x * CELL_SIZE + CELL_SIZE / 2;
      const foodY = gameRef.current.food.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.beginPath();
      ctx.arc(foodX, foodY, 6 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 230, 92, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(foodX, foodY, 10 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();

      if (!gameRef.current.isRunning) {
        ctx.fillStyle = "rgba(9, 10, 18, 0.68)";
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.fillStyle = NEON.text;
        ctx.font = "600 20px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        const message = gameRef.current.isGameOver
          ? "Signal lost — press R"
          : "Press Space to launch";
        ctx.fillText(message, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      isActive = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.page}>
      <header className={`header-grid ${styles.header}`}>
        <div>
          <p className={`eyebrow ${styles.eyebrowSpacing}`}>Arcade Run</p>
          <h1>Space Snake</h1>
          <p className={`lead ${styles.leadSpacing}`}>
            Neon trails in deep space. Eat asteroids, grow your monster, and
            avoid your own tail.
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={toggleRun}>
            {game.isRunning ? "Pause" : "Launch"}
          </button>
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={resetGame}
          >
            Reset
          </button>
        </div>
      </header>

      <section className={`stage-shell ${styles.stage}`}>
        <div className={styles.scoreboard}>
          <span>Score</span>
          <strong>{scoreLabel}</strong>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.hud}>
          <span>Controls: WASD or Arrows</span>
          <span>Space = pause/launch · R = reset</span>
        </div>
      </section>

      <footer className={`footer-row ${styles.footer}`}>
        <Link className="footer-link" href="/">
          Back to home
        </Link>
      </footer>
    </div>
  );
}
