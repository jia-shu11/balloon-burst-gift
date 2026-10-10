import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BalloonParams } from "../../domain/types";
import { getPreviewFitScale, LiveBalloonPreview } from "./LiveBalloonPreview";

const { renderScene } = vi.hoisted(() => ({ renderScene: vi.fn((_props: SceneProps) => null) }));

vi.mock("../../visual/three/BalloonScene", () => ({ BalloonScene: renderScene }));

interface SceneProps {
  variant: string;
  balloons: Array<{ id: string; params: BalloonParams }>;
  level: number;
  onBalloonClick: (id: string, point: { x: number; y: number }) => void;
  onStatus: (status: "ready" | "fallback") => void;
}

function sceneProps() {
  return renderScene.mock.lastCall?.[0];
}

const params: BalloonParams = {
  radius: 80,
  stretchX: 1,
  stretchY: 1.18,
  wobble: 0.4,
  glow: 0.6,
  lightness: 64,
  surfaceWaveDensity: 6,
  floatSpeed: 0.3,
  stringLength: 72,
  fragmentCount: 18,
  burstRadius: 220,
  hue: 142,
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
    waveformContour: Array.from({ length: 48 }, (_, index) => Number(Math.sin(index / 4).toFixed(3))),
    melTexture: [0.2, 0.35, 0.5, 0.7, 0.4, 0.8, 0.3, 0.6],
    pausePattern: [{ position: 0.5, strength: 0.7 }],
    rhythmDensity: 2.5,
    pitchAccent: 800,
    dynamicRange: 0.45
  }
};

beforeEach(() => {
  renderScene.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LiveBalloonPreview", () => {
  it("updates the 3D balloon from the live voice shape and microphone level", () => {
    const { rerender } = render(<LiveBalloonPreview params={params} level={0.3} />);

    expect(sceneProps()?.variant).toBe("preview");
    expect(sceneProps()?.balloons).toEqual([{ id: "preview", params }]);
    expect(sceneProps()?.level).toBe(0.3);

    const changedParams = { ...params, radius: 130, lightness: 82, spikeCount: 12 };
    rerender(<LiveBalloonPreview params={changedParams} level={0.8} />);

    expect(sceneProps()?.balloons[0].params).toEqual(changedParams);
    expect(sceneProps()?.level).toBe(0.8);
  });

  it("preserves the public fit calculation for oversized balloon shapes", () => {
    expect(getPreviewFitScale(592.8, 665.6, 110)).toBe(0.607);
    expect(getPreviewFitScale(160, 188.8, 72)).toBe(1);
  });

  it("lets the giver activate the accessible control for a temporary 3D rebound", () => {
    vi.useFakeTimers();
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");
    fireEvent.click(screen.getByRole("button", { name: "轻触气球预览" }));

    expect(preview).toHaveClass("is-poked");
    expect(sceneProps()?.level).toBeGreaterThan(0.3);

    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(preview).not.toHaveClass("is-poked");
    expect(sceneProps()?.level).toBe(0.3);
  });

  it("responds to a 3D raycast with the same rebound as the accessible control", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    expect(sceneProps()).toBeDefined();
    act(() => {
      sceneProps()!.onBalloonClick("preview", { x: 240, y: 300 });
    });

    expect(screen.getByLabelText("实时鼓胀气球预览")).toHaveClass("is-poked");
  });

  it("reports the available rendering mode on the preview", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    expect(sceneProps()).toBeDefined();
    act(() => {
      sceneProps()!.onStatus("fallback");
    });

    expect(screen.getByLabelText("实时鼓胀气球预览")).toHaveAttribute("data-scene-mode", "fallback");
  });
});
