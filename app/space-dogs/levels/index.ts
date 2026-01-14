import type { LevelConfig } from "../engine/types";
import { asteroidDogfight } from "./asteroid-dogfight";
import { embriumDefense } from "./embrium-defense";

// Registry of all available levels
export const levels: Record<string, LevelConfig> = {
  "asteroid-dogfight": asteroidDogfight,
  "embrium-defense": embriumDefense,
};

// Ordered list for level select menu
export const levelOrder: string[] = ["embrium-defense", "asteroid-dogfight"];

// Get level by ID
export const getLevel = (id: string): LevelConfig | undefined => levels[id];

// Get all levels in order
export const getAllLevels = (): LevelConfig[] =>
  levelOrder.map((id) => levels[id]).filter(Boolean);

// Re-export individual levels for direct imports
export { asteroidDogfight, embriumDefense };
