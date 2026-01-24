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

/**
 * Looks up a level config by ID for routing and gameplay setup. Returns
 * `undefined` when an unknown ID is requested so callers can fail fast.
 */
export const getLevel = (id: string): LevelConfig | undefined => levels[id];

/**
 * Returns all level configs in display order for menus and static generation.
 * Use this instead of `Object.values` to preserve the curated sequence.
 */
export const getAllLevels = (): LevelConfig[] =>
  levelOrder.map((id) => levels[id]).filter(Boolean);

// Re-export individual levels for direct imports
export { asteroidDogfight, embriumDefense };
