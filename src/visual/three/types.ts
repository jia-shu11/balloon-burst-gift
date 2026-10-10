import type { BalloonParams } from "../../domain/types";

export type SceneVariant = "hero" | "preview" | "recipient";
export type SceneQuality = "high" | "balanced";
export interface SceneBalloon {
  id: string;
  params: BalloonParams;
  x?: number;
  y?: number;
  z?: number;
}
export interface SceneState {
  balloons: SceneBalloon[];
  excludedIds: Set<string>;
  burstIds: Set<string>;
  stageSize: { width: number; height: number };
  level: number;
  paused: boolean;
  quality: SceneQuality;
}
