import { describe, expect, it, vi } from "vitest";
import type { BalloonParams } from "../domain/types";
import { createBalloonPathCommands, createVoiceLinePoints, drawBalloon } from "./drawBalloon";

const params: BalloonParams = {
  radius: 90,
  stretchX: 1.08,
  stretchY: 1.22,
  wobble: 0.5,
  glow: 0.8,
  lightness: 64,
  surfaceWaveDensity: 10,
  floatSpeed: 0.3,
  stringLength: 88,
  fragmentCount: 20,
  burstRadius: 260,
  hue: 332,
  spikeCount: 0,
  spikeLength: 0.14,
  audioFeatures: {
    durationSec: 2,
    spectralCentroid: 1200,
    rmsEnergy: 0.18,
    peakEnergy: 0.6,
    speechRate: 2,
    melBands: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  voiceSignature: {
    durationSec: 2,
    energyEnvelope: Array.from({ length: 32 }, (_, index) => Number((index / 31).toFixed(3))),
    waveformContour: Array.from({ length: 48 }, (_, index) => Number(Math.sin(index / 5).toFixed(3))),
    melTexture: [0.2, 0.35, 0.5, 0.7, 0.4, 0.8, 0.3, 0.6],
    pausePattern: [{ position: 0.5, strength: 0.7 }],
    rhythmDensity: 2.5,
    pitchAccent: 800,
    dynamicRange: 0.45
  }
};

describe("createBalloonPathCommands", () => {
  it("creates a soft-body path with knot and tether anchors", () => {
    const commands = createBalloonPathCommands(params, 200, 180, 1.3);

    expect(commands[0].type).toBe("moveTo");
    expect(commands.some((command) => command.type === "bezierCurveTo")).toBe(true);
    expect(commands.some((command) => command.type === "knot")).toBe(true);
    expect(commands.some((command) => command.type === "string")).toBe(true);
  });

  it("keeps high-Mel balloons on a smooth organic curve instead of switching to a polygon", () => {
    const commands = createBalloonPathCommands({ ...params, spikeCount: 12, spikeLength: 0.14 }, 200, 180, 1.3);

    expect(commands.map((command) => command.type)).not.toContain("lineTo");
    expect(commands.filter((command) => command.type === "bezierCurveTo").length).toBeGreaterThan(40);
    expect(commands.some((command) => command.type === "knot")).toBe(true);
    expect(commands.some((command) => command.type === "string")).toBe(true);
  });

  it("creates internal voice-line points from the stored signature", () => {
    const points = createVoiceLinePoints(params, 200, 180);

    expect(points).toHaveLength(params.voiceSignature.waveformContour.length);
    expect(points[0].x).toBeLessThan(200);
    expect(points.at(-1)?.x).toBeGreaterThan(200);
    expect(new Set(points.map((point) => Math.round(point.y))).size).toBeGreaterThan(4);
  });
});

describe("drawBalloon", () => {
  it("draws only the knot ellipse and no dark internal stripe ellipses", () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fill: vi.fn(),
      stroke: vi.fn(),
      ellipse: vi.fn(),
      quadraticCurveTo: vi.fn()
    } as unknown as CanvasRenderingContext2D;

    drawBalloon(context, params, 200, 180, 1.3);

    expect(context.ellipse).toHaveBeenCalledTimes(1);
  });
});
