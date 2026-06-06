import { describe, expect, it } from "vitest";
import { createOrganicBalloonOutline, createSmoothClosedCurve, createSvgBalloonPath } from "./balloonOutline";

describe("createOrganicBalloonOutline", () => {
  it("preserves a pear-shaped balloon body without spikes", () => {
    const points = createOrganicBalloonOutline(0, 0.14);
    const widest = Math.max(...points.map((point) => Math.abs(point.x)));
    const lowerNeck = points.filter((point) => point.y > 0.9);

    expect(points.some((point) => point.y <= -0.99)).toBe(true);
    expect(points.some((point) => point.y >= 0.99)).toBe(true);
    expect(widest).toBeGreaterThan(0.8);
    expect(lowerNeck.every((point) => Math.abs(point.x) < 0.5)).toBe(true);
    expect(points.some((point) => point.kind === "spike-tip")).toBe(false);
  });

  it("adds the requested number of fixed-length spike tips outside the lower neck", () => {
    const spikeLength = 0.14;
    const points = createOrganicBalloonOutline(12, spikeLength);
    const tips = points.filter((point) => point.kind === "spike-tip");

    expect(tips).toHaveLength(12);
    expect(tips.every((point) => point.baseY < 0.72)).toBe(true);
    expect(
      tips.every((point) => Math.abs(Math.hypot(point.x - point.baseX, point.y - point.baseY) - spikeLength) < 0.001)
    ).toBe(true);
  });

  it("increases only spike count while keeping maximum spike extension fixed", () => {
    const low = createOrganicBalloonOutline(4, 0.14).filter((point) => point.kind === "spike-tip");
    const high = createOrganicBalloonOutline(20, 0.14).filter((point) => point.kind === "spike-tip");
    const extension = (point: (typeof high)[number]) => Math.hypot(point.x - point.baseX, point.y - point.baseY);

    expect(high).toHaveLength(20);
    expect(high.length).toBeGreaterThan(low.length);
    expect(Math.max(...high.map(extension))).toBeCloseTo(Math.max(...low.map(extension)), 6);
  });
});

describe("organic balloon curve output", () => {
  it("converts the deformed outline into a smooth closed curve instead of polygon lines", () => {
    const points = createOrganicBalloonOutline(12, 0.14);
    const curve = createSmoothClosedCurve(points);
    const svgPath = createSvgBalloonPath(points);

    expect(curve.segments).toHaveLength(points.length);
    expect(svgPath).toContain(" C ");
    expect(svgPath).not.toContain(" L ");
    expect(svgPath.endsWith(" Z")).toBe(true);
  });
});
