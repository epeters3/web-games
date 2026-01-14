import type { LevelConfig } from "../engine/types";

export const asteroidDogfight: LevelConfig = {
  id: "asteroid-dogfight",
  name: "Space Dogs",
  eyebrow: "Asteroid Field Dogfight",
  description:
    "Hostile squadrons are hunting you through a dense asteroid belt. Outfly them, outshoot them, and survive the rock storm.",

  // Scene
  skyColor: [0.01, 0.015, 0.035, 1],
  ambientIntensity: 0.2,
  glowIntensity: 0.85,

  // Environment - Asteroid field
  environment: {
    type: "asteroid-field",
    asteroids: {
      asset: "large_asteroid_small_moon_1k.glb",
      count: 140,
      spawnArea: {
        center: [0, 0, 0],
        radius: 8192,
      },
      scaleMin: 4,
      scaleMax: 140,
      collisionScale: 0.5,
    },
  },

  // Lighting - cold key light + soft rim
  lights: [
    {
      type: "directional",
      direction: [0.4, -0.6, 0.3],
      intensity: 50,
      diffuse: [0.9, 0.95, 1],
      specular: [0.9, 0.9, 1],
    },
    {
      type: "point",
      position: [-120, 60, 140],
      intensity: 0.6,
      range: 800,
      diffuse: [1, 0.75, 0.55],
      specular: [1, 0.75, 0.55],
    },
  ],

  // Enemies
  enemies: {
    asset: "stealth_spaceship_1k.glb",
    count: 8,
    scale: 0.005,
    maxSpeed: 12,
    health: 4,
    hitRadius: 1.1,
    movement: {
      type: "random-area",
      area: {
        center: [0, 0, 0],
        radius: 140,
      },
      speedMin: 6,
      speedMax: 11,
      directionChangeInterval: 2.5,
    },
    faceMovementDirection: true,
  },

  // Player
  player: {
    startPosition: [0, 8, 160],
    lookAt: [0, 0, 0],
    maxSpeed: 54,
    thrustAccel: 18,
    angularAccel: 3.9,
    linearDamping: 0.995,
    angularDamping: 0.9,
    radius: 1.1,
  },

  // Weapons
  weapons: {
    laserSpeed: 300,
    laserLifetime: 0.7,
    laserLength: 10,
    laserDiameter: 0.12,
    laserColor: [0.3, 0.9, 1],
    fireRate: 120,
  },

  // Stars
  stars: {
    count: 2200,
    radiusMin: 520,
    radiusMax: 980,
    scaleMin: 1.5,
    scaleMax: 2.2,
  },

  // Victory condition - destroy all enemy ships
  victory: {
    type: "destroy-all",
  },
};
