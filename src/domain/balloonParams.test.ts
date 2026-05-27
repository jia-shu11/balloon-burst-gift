import { describe, expect, it } from "vitest";
import { generateBalloonParams } from "./balloonParams";

describe("generateBalloonParams", () => {
  it("uses audio duration as the primary size source for audio-only gifts", () => {
    const shortGift = generateBalloonParams({
      seed: "short",
      audioDurationSec: 8,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const longGift = generateBalloonParams({
      seed: "long",
      audioDurationSec: 55,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    expect(longGift.radius).toBeGreaterThan(shortGift.radius);
    expect(shortGift.surfaceWaveDensity).toBeLessThanOrEqual(longGift.surfaceWaveDensity);
  });

  it("adds extra inflation for mixed text and image data", () => {
    const audioOnly = generateBalloonParams({
      seed: "same",
      audioDurationSec: 30,
      averageVolume: 0.35,
      peakVolume: 0.6,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const mixed = generateBalloonParams({
      seed: "same",
      audioDurationSec: 30,
      averageVolume: 0.35,
      peakVolume: 0.6,
      transcriptChars: 260,
      extraTextChars: 120,
      imageCount: 2,
      imageBytes: 900_000
    });

    expect(mixed.radius).toBeGreaterThan(audioOnly.radius);
    expect(mixed.fragmentCount).toBeGreaterThan(audioOnly.fragmentCount);
    expect(mixed.surfaceWaveDensity).toBeGreaterThan(audioOnly.surfaceWaveDensity);
  });

  it("clamps extreme data to keep the recipient stage readable", () => {
    const params = generateBalloonParams({
      seed: "huge",
      audioDurationSec: 600,
      averageVolume: 1,
      peakVolume: 1,
      transcriptChars: 9000,
      extraTextChars: 9000,
      imageCount: 30,
      imageBytes: 90_000_000
    });

    expect(params.radius).toBeLessThanOrEqual(132);
    expect(params.fragmentCount).toBeLessThanOrEqual(36);
    expect(params.glow).toBeLessThanOrEqual(1);
  });

  it("normalizes malformed and negative metrics before scoring", () => {
    const params = generateBalloonParams({
      seed: "malformed",
      audioDurationSec: Number.NaN,
      averageVolume: Number.POSITIVE_INFINITY,
      peakVolume: -1,
      transcriptChars: Number.NEGATIVE_INFINITY,
      extraTextChars: -250,
      imageCount: -10,
      imageBytes: 900_000
    });

    expect(Object.values(params).every(Number.isFinite)).toBe(true);
    expect(params.radius).toBeGreaterThanOrEqual(42);
    expect(params.radius).toBeLessThanOrEqual(132);
    expect(params.fragmentCount).toBeGreaterThanOrEqual(8);
    expect(params.fragmentCount).toBeLessThanOrEqual(36);
    expect(params.glow).toBeGreaterThanOrEqual(0.25);
    expect(params.glow).toBeLessThanOrEqual(1);
  });
});
