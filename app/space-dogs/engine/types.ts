import type {
  Mesh,
  PointLight,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

// =============================================================================
// Entity Types
// =============================================================================

export type BeamState = "idle" | "beaming" | "waiting";

export interface Drone {
  node: TransformNode;
  health: number;
  // Movement state (interpretation depends on movement type)
  angle: number;
  speed: number;
  tilt: number;
  altitude: number;
  // For random/patrol movement
  targetPosition?: Vector3;
  velocity?: Vector3;
  // Tractor beam properties
  beamMesh: Mesh;
  beamLight: PointLight;
  lumpMesh: Mesh;
  beamState: BeamState;
  beamTimer: number;
  lumpProgress: number;
}

export interface Laser {
  mesh: Mesh;
  light: PointLight;
  ttl: number;
  direction: Vector3;
}

export interface Explosion {
  mesh: Mesh;
  ttl: number;
}

export interface SparkParticle {
  mesh: Mesh;
  ttl: number;
  velocity: Vector3;
}

export interface ControlState {
  throttle: boolean;
  reverse: boolean;
  fire: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
}

// =============================================================================
// Environment Configuration
// =============================================================================

// Collision body (sphere) for player collision detection
export interface CollisionSphere {
  center: [number, number, number];
  radius: number;
}

// A single celestial body (planet, moon, asteroid)
export interface CelestialBody {
  asset: string;
  position: [number, number, number];
  scale: number;
  rotation?: [number, number, number]; // Euler angles
  emissiveScale?: number;
  diffuseScale?: number;
  // If true, creates a collision sphere at this body's position
  hasCollision?: boolean;
}

// Environment types
export type EnvironmentType = "single-body" | "asteroid-field" | "empty";

// Single large body (planet, moon, station)
export interface SingleBodyEnvironment {
  type: "single-body";
  body: CelestialBody;
}

// Multiple smaller bodies (asteroid field)
export interface AsteroidFieldEnvironment {
  type: "asteroid-field";
  asteroids: {
    asset: string; // Asset to use for asteroids
    count: number;
    // Spawn area (box or sphere)
    spawnArea: {
      center: [number, number, number];
      radius: number; // Spherical spawn area
    };
    scaleMin: number;
    scaleMax: number;
    // Optional: collision radius multiplier (relative to visual scale)
    collisionScale?: number;
  };
  // Additional static bodies (e.g., a large asteroid as focal point)
  staticBodies?: CelestialBody[];
}

// Empty space (no collision bodies, just stars)
export interface EmptyEnvironment {
  type: "empty";
  // Optional decorative bodies with no collision
  decorations?: CelestialBody[];
}

export type EnvironmentConfig =
  | SingleBodyEnvironment
  | AsteroidFieldEnvironment
  | EmptyEnvironment;

// =============================================================================
// Lighting Configuration
// =============================================================================

export type LightType = "point" | "directional" | "hemisphere";

export interface PointLightConfig {
  type: "point";
  position: [number, number, number];
  intensity: number;
  range: number;
  diffuse: [number, number, number];
  specular: [number, number, number];
}

export interface DirectionalLightConfig {
  type: "directional";
  direction: [number, number, number]; // Normalized direction vector
  intensity: number;
  diffuse: [number, number, number];
  specular: [number, number, number];
}

export interface HemisphereLightConfig {
  type: "hemisphere";
  direction: [number, number, number];
  intensity: number;
  diffuse?: [number, number, number];
  groundColor?: [number, number, number];
}

export type LightConfig =
  | PointLightConfig
  | DirectionalLightConfig
  | HemisphereLightConfig;

// =============================================================================
// Enemy Movement Configuration
// =============================================================================

export type EnemyMovementType =
  | "orbital"
  | "patrol"
  | "random-area"
  | "stationary";

// Orbit around a center point
export interface OrbitalMovement {
  type: "orbital";
  center: [number, number, number]; // Point to orbit around
  altitudeMin: number;
  altitudeMax: number;
  speedMin: number;
  speedMax: number;
  tiltRange: number; // Orbital plane tilt variation
}

// Patrol between random points in an area
export interface PatrolMovement {
  type: "patrol";
  area: {
    center: [number, number, number];
    radius: number;
  };
  speed: number;
  pauseTime?: number; // Time to pause at each waypoint
}

// Random movement within an area
export interface RandomAreaMovement {
  type: "random-area";
  area: {
    center: [number, number, number];
    radius: number;
  };
  speedMin: number;
  speedMax: number;
  directionChangeInterval: number; // Seconds between direction changes
}

// Stay in one place
export interface StationaryMovement {
  type: "stationary";
  positions: [number, number, number][]; // Fixed positions for each enemy
}

export type EnemyMovementConfig =
  | OrbitalMovement
  | PatrolMovement
  | RandomAreaMovement
  | StationaryMovement;

// =============================================================================
// Victory Condition Configuration
// =============================================================================

export type VictoryConditionType =
  | "destroy-all"
  | "destroy-count"
  | "survive-time";

// Destroy all enemies
export interface DestroyAllVictory {
  type: "destroy-all";
}

// Destroy a specific number of enemies
export interface DestroyCountVictory {
  type: "destroy-count";
  count: number;
}

// Survive for a specific amount of time
export interface SurviveTimeVictory {
  type: "survive-time";
  duration: number; // seconds
}

export type VictoryCondition =
  | DestroyAllVictory
  | DestroyCountVictory
  | SurviveTimeVictory;

// =============================================================================
// Level Configuration
// =============================================================================

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  eyebrow: string;

  // Scene basics
  skyColor: [number, number, number, number];
  ambientIntensity: number;
  glowIntensity: number;

  // Environment (replaces old planet config)
  environment: EnvironmentConfig;

  // Lighting (array allows multiple lights)
  lights: LightConfig[];

  // Enemies
  enemies: {
    asset: string;
    count: number;
    scale: number;
    maxSpeed: number;
    health: number;
    hitRadius: number;
    movement: EnemyMovementConfig;
    // Orientation
    faceMovementDirection?: boolean; // Face direction of travel
    facePoint?: [number, number, number]; // Face towards a point (e.g., planet)
  };

  // Tractor beam (optional)
  tractorBeam?: {
    enabled: boolean;
    targetPoint?: [number, number, number]; // Where beam points (defaults to environment center)
    color: [number, number, number];
    duration: number;
    delayMin: number;
    delayMax: number;
    lumpColor: [number, number, number];
    lumpEmissive: [number, number, number];
    lumpDiameter: number;
    beamDiameterTop: number;
    beamDiameterBottom: number;
  };

  // Player
  player: {
    startPosition: [number, number, number];
    lookAt?: [number, number, number]; // Initial look direction
    maxSpeed: number;
    thrustAccel: number;
    angularAccel: number;
    linearDamping: number;
    angularDamping: number;
    radius: number;
  };

  // Weapons
  weapons: {
    laserSpeed: number;
    laserLifetime: number;
    laserLength: number;
    laserDiameter: number;
    laserColor: [number, number, number];
    fireRate: number;
  };

  // Stars background
  stars: {
    count: number;
    radiusMin: number;
    radiusMax: number;
    scaleMin: number;
    scaleMax: number;
  };

  // Victory condition
  victory: VictoryCondition;

  // Optional custom setup
  customSetup?: (scene: Scene) => void;
}

// =============================================================================
// Game State
// =============================================================================

export interface GameState {
  drones: Drone[];
  lasers: Laser[];
  explosions: Explosion[];
  sparks: SparkParticle[];
}

// Runtime environment data computed from config
export interface EnvironmentState {
  // For collision detection
  collisionBodies: CollisionSphere[];
  // For enemy orientation/beams
  centerPoint: Vector3;
  // Meshes that should be excluded from laser lights
  environmentMeshes: Mesh[];
}

export interface GameRefs {
  engine: React.MutableRefObject<import("@babylonjs/core").Engine | null>;
  scene: React.MutableRefObject<Scene | null>;
  player: React.MutableRefObject<Mesh | null>;
  timerStart: React.MutableRefObject<number | null>;
  timerStop: React.MutableRefObject<number | null>;
}
