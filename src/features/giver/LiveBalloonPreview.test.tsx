import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BalloonParams } from "../../domain/types";
import { LiveBalloonPreview } from "./LiveBalloonPreview";

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

afterEach(() => {
  cleanup();
});

describe("LiveBalloonPreview", () => {
  it("keeps the balloon body, knot, and string inside one assembly", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");
    const assembly = preview.querySelector(".live-balloon-assembly");

    expect(assembly).toBeTruthy();
    expect(preview.children).toHaveLength(1);
    expect(assembly?.querySelector(".live-balloon")).toBeTruthy();
    expect(assembly?.querySelector(".live-balloon-knot")).toBeTruthy();
    expect(assembly?.querySelector(".live-balloon-string")).toBeTruthy();
  });

  it("scales oversized previews down so they fit beside the form", () => {
    render(
      <LiveBalloonPreview
        params={{
          ...params,
          radius: 260,
          stretchX: 1.14,
          stretchY: 1.28,
          stringLength: 110
        }}
        level={0.3}
      />
    );

    const assembly = screen.getByLabelText("实时鼓胀气球预览").querySelector<HTMLElement>(".live-balloon-assembly");

    expect(assembly?.style.transform).toMatch(/^scale\(0\.\d+\)$/);
  });

  it("applies frequency-derived lightness to the preview balloon", () => {
    render(<LiveBalloonPreview params={{ ...params, lightness: 82 }} level={0.3} />);

    const balloon = screen.getByRole("button", { name: "轻触气球预览" });

    expect(balloon).toHaveStyle({ "--balloon-lightness": "82%" });
  });

  it("renders only the white voice signature line without dark texture bands", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const balloon = screen.getByRole("button", { name: "轻触气球预览" });

    expect(balloon.querySelector(".live-balloon-voice-line")).toBeTruthy();
    expect(balloon.querySelector(".live-balloon-texture-band")).toBeNull();
  });

  it("renders Mel spikes as a smooth organic body path without a polygon clip mask", () => {
    render(<LiveBalloonPreview params={{ ...params, spikeCount: 12 }} level={0.3} />);

    const balloon = screen.getByRole("button", { name: "轻触气球预览" });
    const body = balloon.querySelector(".live-balloon-body");

    expect(balloon.style.clipPath).toBe("");
    expect(balloon).toHaveStyle({ boxShadow: "none" });
    expect(body?.tagName.toLowerCase()).toBe("path");
    expect(body?.getAttribute("d")).toContain(" C ");
    expect(body?.getAttribute("d")).not.toContain(" L ");
  });

  it("does not render visible rim or ring decorations around the preview balloon", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");

    expect(preview.querySelector(".live-balloon-rim")).toBeNull();
    expect(preview.querySelector(".live-balloon-wave")).toBeNull();
  });

  it("lets the giver tap the preview balloon for a soft rebound", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");
    fireEvent.click(screen.getByRole("button", { name: "轻触气球预览" }));

    expect(preview).toHaveClass("is-poked");
  });
});
