import { useEffect, useRef, useCallback } from "react";
import {
  Axis,
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  Space,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import type { ControlState, EnvironmentState, LevelConfig } from "./types";
import { createDefaultControlState } from "./constants";

export interface PlayerResult {
  player: Mesh | null;
  camera: UniversalCamera | null;
  controlState: ControlState;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  fireRequested: React.MutableRefObject<boolean>;
  updatePlayer: (dt: number, environmentState: EnvironmentState) => number; // returns speed
}

export const usePlayer = (
  scene: Scene | null,
  config: LevelConfig
): PlayerResult => {
  const playerRef = useRef<Mesh | null>(null);
  const cameraRef = useRef<UniversalCamera | null>(null);
  const controlStateRef = useRef<ControlState>(createDefaultControlState());
  const linearVelocityRef = useRef(new Vector3(0, 0, 0));
  const angularVelocityRef = useRef(new Vector3(0, 0, 0));
  const fireRequestedRef = useRef(false);

  useEffect(() => {
    if (!scene) return;

    const { player: playerConfig } = config;

    // Create player mesh (invisible placeholder for now)
    const player = MeshBuilder.CreateBox(
      "player",
      { width: 1.4, height: 0.6, depth: 2.4 },
      scene
    );
    player.position = new Vector3(...playerConfig.startPosition);
    player.rotationQuaternion = Quaternion.Identity();

    // Look at point if specified, otherwise look at center
    if (playerConfig.lookAt) {
      player.lookAt(new Vector3(...playerConfig.lookAt));
    }

    const playerMat = new StandardMaterial("playerMat", scene);
    playerMat.diffuseColor = new Color3(0.95, 0.4, 0.55);
    player.material = playerMat;
    player.isVisible = false;

    // Camera attached to player
    const camera = new UniversalCamera(
      "camera",
      new Vector3(0, 0.25, -0.8),
      scene
    );
    camera.parent = player;
    camera.rotation = new Vector3(0, 0, 0);

    // Wings (invisible)
    const wingLeft = MeshBuilder.CreateBox(
      "wingLeft",
      { width: 0.3, height: 0.1, depth: 1 },
      scene
    );
    wingLeft.parent = player;
    wingLeft.position = new Vector3(-0.9, -0.1, 0);
    wingLeft.isVisible = false;

    const wingRight = wingLeft.clone("wingRight");
    if (wingRight) {
      wingRight.parent = player;
      wingRight.position = new Vector3(0.9, -0.1, 0);
      wingRight.isVisible = false;
    }

    // Engine trail (invisible)
    const trail = MeshBuilder.CreateCylinder(
      "trail",
      { diameterTop: 0.2, diameterBottom: 0.5, height: 3, tessellation: 12 },
      scene
    );
    trail.position = new Vector3(0, -0.1, 1.8);
    trail.rotation = new Vector3(Math.PI / 2, 0, 0);
    const trailMat = new StandardMaterial("trailMat", scene);
    trailMat.emissiveColor = new Color3(0.9, 0.5, 0.8);
    trailMat.alpha = 0.5;
    trail.material = trailMat;
    trail.parent = player;
    trail.isVisible = false;

    playerRef.current = player;
    cameraRef.current = camera;

    // Input handling
    const controlState = controlStateRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW") controlState.pitchDown = true;
      if (event.code === "KeyS") controlState.pitchUp = true;
      if (event.code === "KeyL") controlState.reverse = true;
      if (event.code === "KeyO") controlState.throttle = true;
      if (event.code === "Space") {
        event.preventDefault();
        fireRequestedRef.current = true;
        controlState.fire = true;
      }
      if (event.code === "KeyA") controlState.yawLeft = true;
      if (event.code === "KeyD") controlState.yawRight = true;
      if (event.code === "KeyK") controlState.rollLeft = true;
      if (event.code === "Semicolon") controlState.rollRight = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW") controlState.pitchDown = false;
      if (event.code === "KeyS") controlState.pitchUp = false;
      if (event.code === "KeyL") controlState.reverse = false;
      if (event.code === "KeyO") controlState.throttle = false;
      if (event.code === "Space") controlState.fire = false;
      if (event.code === "KeyA") controlState.yawLeft = false;
      if (event.code === "KeyD") controlState.yawRight = false;
      if (event.code === "KeyK") controlState.rollLeft = false;
      if (event.code === "Semicolon") controlState.rollRight = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      playerRef.current = null;
      cameraRef.current = null;
    };
  }, [scene, config]);

  const updatePlayer = useCallback(
    (dt: number, environmentState: EnvironmentState): number => {
      const player = playerRef.current;
      if (!player) return 0;

      const { player: playerConfig } = config;
      const controlState = controlStateRef.current;
      const linearVelocity = linearVelocityRef.current;
      const angularVelocity = angularVelocityRef.current;

      // Calculate input
      const yawInput =
        (controlState.yawRight ? 1 : 0) - (controlState.yawLeft ? 1 : 0);
      const pitchInput =
        (controlState.pitchUp ? 1 : 0) - (controlState.pitchDown ? 1 : 0);
      const rollInput =
        (controlState.rollLeft ? 1 : 0) - (controlState.rollRight ? 1 : 0);

      // Angular acceleration
      angularVelocity.x += pitchInput * playerConfig.angularAccel * dt;
      angularVelocity.y += yawInput * playerConfig.angularAccel * dt;
      angularVelocity.z += rollInput * playerConfig.angularAccel * dt;

      // Angular damping
      angularVelocity.scaleInPlace(
        Math.pow(playerConfig.angularDamping, dt * 60)
      );

      // Apply rotation
      if (Math.abs(angularVelocity.x) > 0.0001) {
        player.rotate(Axis.X, angularVelocity.x * dt, Space.LOCAL);
      }
      if (Math.abs(angularVelocity.y) > 0.0001) {
        player.rotate(Axis.Y, angularVelocity.y * dt, Space.LOCAL);
      }
      if (Math.abs(angularVelocity.z) > 0.0001) {
        player.rotate(Axis.Z, angularVelocity.z * dt, Space.LOCAL);
      }

      // Linear thrust
      const forward = player.getDirection(Vector3.Forward());
      if (controlState.throttle) {
        linearVelocity.addInPlace(forward.scale(playerConfig.thrustAccel * dt));
      }
      if (controlState.reverse) {
        linearVelocity.addInPlace(
          forward.scale(-playerConfig.thrustAccel * 0.7 * dt)
        );
      }

      // Linear damping
      linearVelocity.scaleInPlace(
        Math.pow(playerConfig.linearDamping, dt * 60)
      );

      // Speed limit
      const speed = linearVelocity.length();
      if (speed > playerConfig.maxSpeed) {
        linearVelocity.scaleInPlace(playerConfig.maxSpeed / speed);
      }

      // Position update
      const displacement = linearVelocity.scale(dt);
      const nextPosition = player.position.add(displacement);

      // Check collision with all collision bodies
      let collided = false;
      for (const body of environmentState.collisionBodies) {
        const bodyCenter = new Vector3(...body.center);
        const bodyRadius = body.radius;
        const toShip = nextPosition.subtract(bodyCenter);
        const minDistance = bodyRadius + playerConfig.radius;

        if (toShip.length() < minDistance) {
          // Push player outside the body
          toShip.normalize();
          player.position = bodyCenter.add(toShip.scale(minDistance));
          linearVelocity.scaleInPlace(0.2);
          collided = true;
          break;
        }
      }

      if (!collided) {
        player.position = nextPosition;
      }

      return linearVelocity.length();
    },
    [config]
  );

  return {
    player: playerRef.current,
    camera: cameraRef.current,
    controlState: controlStateRef.current,
    linearVelocity: linearVelocityRef.current,
    angularVelocity: angularVelocityRef.current,
    fireRequested: fireRequestedRef,
    updatePlayer,
  };
};
