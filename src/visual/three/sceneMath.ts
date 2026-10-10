import { PerspectiveCamera, Vector3 } from "three";
import type { SceneQuality } from "./types";

export function stageToWorld(point: { x: number; y: number }, size: { width: number; height: number }, camera: PerspectiveCamera, depth: number) {
  const ray = new Vector3(point.x / size.width * 2 - 1, 1 - point.y / size.height * 2, 0.5).unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(ray, (depth - camera.position.z) / ray.z);
}

export function worldToStage(point: Vector3, size: { width: number; height: number }, camera: PerspectiveCamera) {
  const projected = point.clone().project(camera);
  return { x: (projected.x + 1) * size.width / 2, y: (1 - projected.y) * size.height / 2 };
}

export function qualityPixelRatio(deviceRatio: number, quality: SceneQuality) {
  return quality === "balanced" ? 1 : Math.min(deviceRatio || 1, 1.75);
}
