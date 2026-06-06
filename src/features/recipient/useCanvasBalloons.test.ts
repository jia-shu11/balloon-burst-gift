import { cleanup, render } from "@testing-library/react";
import { createElement, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeCanvasContext } from "../../test/fakeCanvasContext";
import type { LaidOutBalloon } from "../../visual/balloonLayout";
import { drawBalloon } from "../../visual/drawBalloon";
import { createResponsiveStageSize, hitTestBalloon, useCanvasBalloons } from "./useCanvasBalloons";

const voiceSignature = {
  durationSec: 2,
  energyEnvelope: Array.from({ length: 32 }, () => 0.5),
  waveformContour: Array.from({ length: 48 }, () => 0),
  melTexture: [1, 1, 1, 1, 1, 1, 1, 1],
  pausePattern: [],
  rhythmDensity: 2,
  pitchAccent: 1200,
  dynamicRange: 0.2
};

vi.mock("../../visual/drawBalloon", () => ({
  drawBalloon: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("hitTestBalloon", () => {
  it("finds the topmost balloon under a point", () => {
    const hit = hitTestBalloon(
      [
        { id: "a", x: 100, y: 100, radius: 40 },
        { id: "b", x: 130, y: 100, radius: 50 }
      ],
      { x: 130, y: 100 }
    );

    expect(hit).toBe("b");
  });

  it("returns null when the point misses every balloon", () => {
    expect(hitTestBalloon([{ id: "a", x: 100, y: 100, radius: 40 }], { x: 300, y: 300 })).toBeNull();
  });

  it("uses the visible stretched balloon body for hit testing", () => {
    const hit = hitTestBalloon(
      [{ id: "a", x: 100, y: 100, radius: 50, stretchX: 1, stretchY: 1.4 }],
      { x: 100, y: 165 }
    );

    expect(hit).toBe("a");
  });
});

describe("useCanvasBalloons", () => {
  it("creates a logical stage that matches a portrait mobile display ratio", () => {
    expect(createResponsiveStageSize({ width: 390, height: 780 })).toEqual({
      width: 1200,
      height: 2400
    });
  });

  it("draws into the provided logical stage so the canvas is not stretched by CSS", () => {
    const context = createFakeCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", { configurable: true, get: () => 600 });
    Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", { configurable: true, get: () => 360 });
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });

    const layout: LaidOutBalloon[] = [
      {
        x: 600,
        y: 360,
        driftPhase: 0,
        gift: {
          id: "gift",
          roomId: "room",
          giverName: "Alice",
          audioUrl: "audio.webm",
          audioDurationSec: 8,
          averageVolume: 0.4,
          peakVolume: 0.8,
          transcript: "生日快乐",
          editedTranscript: "生日快乐",
          extraText: "",
          imageUrls: [],
          imageBytes: 0,
          deletedAt: null,
          createdAt: "2026-05-27T00:00:00.000Z",
          balloonParams: {
            radius: 80,
            stretchX: 1,
            stretchY: 1.1,
            wobble: 0.4,
            glow: 0.7,
            lightness: 64,
            surfaceWaveDensity: 8,
            floatSpeed: 0.3,
            stringLength: 70,
            fragmentCount: 14,
            burstRadius: 200,
            hue: 330,
            spikeCount: 0,
            spikeLength: 0.14,
            audioFeatures: {
              durationSec: 2,
              spectralCentroid: 1200,
              rmsEnergy: 0.18,
              peakEnergy: 0.6,
              speechRate: 2,
              melBands: [1, 1, 1, 1, 1, 1, 1, 1],
              voiceSignature
            },
            voiceSignature
          }
        }
      }
    ];

    function Harness() {
      const canvasRef = createRef<HTMLCanvasElement>();
      useCanvasBalloons(canvasRef, layout, new Set(), { width: 1200, height: 2400 });
      return createElement("canvas", { ref: canvasRef });
    }

    const { container } = render(createElement(Harness));
    const canvas = container.querySelector("canvas")!;

    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(2400);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1200, 2400);
    expect(drawBalloon).toHaveBeenCalledWith(context, layout[0].gift.balloonParams, 600, 360, 0);
  });
});
