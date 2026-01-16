import type { LevelConfig } from "../engine/types";

export const embriumDefense: LevelConfig = {
  id: "embrium-defense",
  name: "Space Dogs",
  eyebrow: "Embrium Defense",
  description:
    "Alien mining drones are stealing Embrium—the galaxy's most precious substance—from our volcanic reserves. Destroy all drones before they drain the planet dry.",

  // Scene
  skyColor: [0.02, 0.04, 0.08, 1],
  ambientIntensity: 0.15,
  glowIntensity: 1.0,

  // Environment - Single planet
  environment: {
    type: "single-body",
    body: {
      asset: "fire_planet_4k.glb",
      scale: 256,
      position: [-18, -10, 0],
      emissiveScale: 0.4,
      diffuseScale: 0.7,
      hasCollision: true,
    },
  },

  // Lighting - Point light from planet (lava glow)
  lights: [
    {
      type: "point",
      position: [-18, -10, 0], // Same as planet
      intensity: 2.6,
      range: 1200,
      diffuse: [1, 0.55, 0.2],
      specular: [1, 0.6, 0.25],
    },
  ],

  // Enemies (UFO drones)
  enemies: {
    asset: "ufo_flying_saucer_spaceship_ovni_1k.glb",
    count: 6,
    scale: 3,
    maxSpeed: 10,
    health: 5,
    movement: {
      type: "orbital",
      center: [-18, -10, 0], // Orbit around planet
      altitudeMin: 10,
      altitudeMax: 25,
      speedMin: 0.00008,
      speedMax: 0.0002,
      tiltRange: 0.3, // multiplied by PI
    },
    facePoint: [-18, -10, 0], // Face towards planet
  },

  // Tractor beam
  tractorBeam: {
    enabled: true,
    targetPoint: [-18, -10, 0], // Beam points towards planet
    color: [1, 0.15, 0.1],
    duration: 2.5,
    delayMin: 1,
    delayMax: 5,
    lumpColor: [0.45, 0.28, 0.12],
    lumpEmissive: [0.15, 0.08, 0.02],
    lumpDiameter: 0.15,
    beamDiameterTop: 0.2,
    beamDiameterBottom: 1,
  },

  // Player
  player: {
    startPosition: [0, 6, 220],
    lookAt: [-18, -10, 0], // Look at planet
    maxSpeed: 54,
    thrustAccel: 16,
    angularAccel: 3.9,
    linearDamping: 0.99,
    angularDamping: 0.9,
    radius: 1.1,
  },

  // Weapons
  weapons: {
    laserSpeed: 300,
    laserLifetime: 0.7,
    laserLength: 20,
    laserDiameter: 0.12,
    laserColor: [0.3, 1, 0.55],
    fireRate: 135,
  },

  // Stars
  stars: {
    count: 1800,
    radiusMin: 240,
    radiusMax: 460,
    scaleMin: 0.6,
    scaleMax: 2.0,
  },

  // Victory condition - destroy all drones
  victory: {
    type: "destroy-all",
  },
};
