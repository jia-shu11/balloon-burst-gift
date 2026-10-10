import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { stageToWorld, worldToStage, qualityPixelRatio } from "./sceneMath";

describe("3D scene coordinate mapping", () => {
  it.each([[1200, 720], [1200, 2100]])("round trips gift positions on a %i by %i stage at different depths", (width, height) => {
    const camera = new PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 14);
    camera.updateMatrixWorld();
    for (const z of [-1, 0, 1]) {
      const point = { x: width * 0.31, y: height * 0.72 };
      const world = stageToWorld(point, { width, height }, camera, z);
      expect(world.z).toBeCloseTo(z);
      expect(worldToStage(world, { width, height }, camera).x).toBeCloseTo(point.x);
      expect(worldToStage(world, { width, height }, camera).y).toBeCloseTo(point.y);
    }
  });
  it("maps screen center onto the viewing axis", () => {
    const camera = new PerspectiveCamera(38, 2, 0.1, 100);
    camera.position.z = 14;
    camera.updateMatrixWorld();
    expect(stageToWorld({ x: 600, y: 300 }, { width: 1200, height: 600 }, camera, 0).distanceTo(new Vector3())).toBeLessThan(0.001);
  });
  it("caps retina rendering cost and scales down balanced mode", () => {
    expect(qualityPixelRatio(3, "high")).toBe(1.75);
    expect(qualityPixelRatio(3, "balanced")).toBe(1);
    expect(qualityPixelRatio(1, "high")).toBe(1);
  });
});
