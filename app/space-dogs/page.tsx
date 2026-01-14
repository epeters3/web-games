import { levelOrder } from "./levels";
import { SpaceDogsClient } from "./SpaceDogsClient";

export default function SpaceDogsPage() {
  const defaultLevel = levelOrder[0] ?? "embrium-defense";
  return <SpaceDogsClient levelId={defaultLevel} />;
}
