import { describe, expect, it } from "vitest";
import type { BalloonGift } from "../domain/types";
import { createBurstFragments, updateFragments } from "./fragments";

const gift: BalloonGift = {
  id: "gift-1",
  roomId: "room",
  giverName: "Alice",
  audioUrl: "audio.webm",
  audioDurationSec: 20,
  averageVolume: 0.4,
  peakVolume: 0.8,
  transcript: "生日快乐 天天开心",
  editedTranscript: "生日快乐 天天开心",
  extraText: "永远闪闪发光",
  imageUrls: ["image.png"],
  imageBytes: 1000,
  deletedAt: null,
  createdAt: "2026-05-27T00:00:00.000Z",
  balloonParams: {
    radius: 80,
    stretchX: 1,
    stretchY: 1.15,
    wobble: 0.5,
    glow: 0.8,
    surfaceWaveDensity: 10,
    floatSpeed: 0.4,
    stringLength: 80,
    fragmentCount: 16,
    burstRadius: 220,
    hue: 332
  }
};

describe("createBurstFragments", () => {
  it("creates text, image, waveform, and signature fragments", () => {
    const fragments = createBurstFragments(gift, { x: 400, y: 300 }, false);

    expect(fragments.some((fragment) => fragment.kind === "text")).toBe(true);
    expect(fragments.some((fragment) => fragment.kind === "image")).toBe(true);
    expect(fragments.some((fragment) => fragment.kind === "waveform")).toBe(true);
    expect(fragments.some((fragment) => fragment.kind === "signature")).toBe(true);
    expect(fragments.every((fragment) => fragment.giftId === gift.id)).toBe(true);
  });

  it("keeps fragments alive across updates", () => {
    const fragments = createBurstFragments(gift, { x: 400, y: 300 }, true);
    const updated = updateFragments(fragments, 0.016, { width: 800, height: 600 });

    expect(updated).toHaveLength(fragments.length);
  });

  it("keeps fragments drifting and rotating after the burst", () => {
    const fragments = createBurstFragments(gift, { x: 400, y: 300 }, false);
    const updated = updateFragments(fragments, 0.2, { width: 800, height: 600 });

    expect(updated.some((fragment, index) => fragment.x !== fragments[index].x || fragment.y !== fragments[index].y)).toBe(
      true
    );
    expect(updated.some((fragment, index) => fragment.rotation !== fragments[index].rotation)).toBe(true);
  });

  it("holds a dragged fragment in place while it is being grabbed", () => {
    const [fragment] = createBurstFragments(gift, { x: 400, y: 300 }, false);
    const updated = updateFragments([{ ...fragment, held: true, x: 420, y: 320 }], 0.2, { width: 800, height: 600 });

    expect(updated[0]).toMatchObject({ x: 420, y: 320, held: true });
  });

  it("omits playable waveform fragments during burst-all", () => {
    const fragments = createBurstFragments(gift, { x: 400, y: 300 }, true);

    expect(fragments.some((fragment) => fragment.kind === "waveform")).toBe(false);
    expect(fragments.some((fragment) => fragment.kind === "text")).toBe(true);
  });
});
