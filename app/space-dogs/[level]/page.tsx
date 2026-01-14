import { notFound } from "next/navigation";
import { levelOrder, getLevel } from "../levels";
import { SpaceDogsClient } from "../SpaceDogsClient";

interface SpaceDogsLevelPageProps {
  params: Promise<{ level: string }>;
}

export const dynamicParams = false;

export const generateStaticParams = () =>
  levelOrder.map((level) => ({ level }));

export default async function SpaceDogsLevelPage({
  params,
}: SpaceDogsLevelPageProps) {
  const { level } = await params;
  if (!getLevel(level)) {
    notFound();
  }

  return <SpaceDogsClient levelId={level} />;
}
