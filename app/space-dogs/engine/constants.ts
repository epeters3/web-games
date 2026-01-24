import type { ControlState } from "./types";

// =============================================================================
// Default Control State
// =============================================================================

/**
 * Provides a fresh control-state object so each player session starts from the
 * same neutral inputs. Use this instead of reusing a shared object to avoid
 * stale references across resets.
 */
export const createDefaultControlState = (): ControlState => ({
  throttle: false,
  reverse: false,
  fire: false,
  yawLeft: false,
  yawRight: false,
  pitchUp: false,
  pitchDown: false,
  rollLeft: false,
  rollRight: false,
});

// =============================================================================
// Effect Defaults
// =============================================================================

export const EXPLOSION_DURATION = 0.6;
export const SPARK_DURATION = 0.4;
export const SPARK_COUNT_ON_HIT = 6;
export const SPARK_COUNT_ON_DESTROY = 12;

// =============================================================================
// Visual Defaults
// =============================================================================

export const EXPLOSION_DIAMETER = 1.6;
export const EXPLOSION_COLOR: [number, number, number] = [1, 0.6, 0.2];

export const SPARK_DIAMETER = 0.18;
export const SPARK_COLOR: [number, number, number] = [1, 0.8, 0.2];
export const SPARK_VELOCITY_SPREAD = 6;

// =============================================================================
// HUD Update Rate
// =============================================================================

export const HUD_UPDATE_INTERVAL_MS = 120;
