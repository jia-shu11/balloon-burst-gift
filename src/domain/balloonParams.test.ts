import { describe, expect, it } from "vitest";
import { generateBalloonParams, getAudioInflationScale } from "./balloonParams";

describe("generateBalloonParams", () => {
  it("uses audio duration as the primary size source for audio-only gifts", () => {
    const shortGift = generateBalloonParams({
      seed: "short",
      audioDurationSec: 1,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const longGift = generateBalloonParams({
      seed: "long",
      audioDurationSec: 3,
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

  it("inflates audio-only balloon size by half of its base size every second before clamping", () => {
    expect(getAudioInflationScale(0)).toBe(1);
    expect(getAudioInflationScale(1)).toBe(1.5);
    expect(getAudioInflationScale(2)).toBe(2);

    const baseGift = generateBalloonParams({
      seed: "paced-audio",
      audioDurationSec: 0,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const oneSecondGift = generateBalloonParams({
      seed: "paced-audio",
      audioDurationSec: 1,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const twoSecondGift = generateBalloonParams({
      seed: "paced-audio",
      audioDurationSec: 2,
      averageVolume: 0.4,
      peakVolume: 0.7,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    expect(oneSecondGift.radius).toBeCloseTo(baseGift.radius * 1.5, 1);
    expect(twoSecondGift.radius).toBeCloseTo(baseGift.radius * 2, 1);
  });

  it("adds extra inflation for mixed text and image data", () => {
    const audioOnly = generateBalloonParams({
      seed: "same",
      audioDurationSec: 2,
      averageVolume: 0.35,
      peakVolume: 0.6,
      transcriptChars: 0,
      extraTextChars: 0,
      imageCount: 0,
      imageBytes: 0
    });

    const mixed = generateBalloonParams({
      seed: "same",
      audioDurationSec: 2,
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

    expect(params.radius).toBeLessThanOrEqual(260);
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
    expect(params.radius).toBeLessThanOrEqual(260);
    expect(params.fragmentCount).toBeGreaterThanOrEqual(8);
    expect(params.fragmentCount).toBeLessThanOrEqual(36);
    expect(params.glow).toBeGreaterThanOrEqual(0.25);
    expect(params.glow).toBeLessThanOrEqual(1);
  });

  it("uses the selected mood as a stable color and motion bias", () => {
    const baseMetrics = {
      seed: "mood-sync",
      audioDurationSec: 8,
      averageVolume: 0.5,
      peakVolume: 0.8,
      transcriptChars: 80,
      extraTextChars: 20,
      imageCount: 1,
      imageBytes: 600_000
    };

    const gentle = generateBalloonParams({ ...baseMetrics, mood: "gentle" });
    const playful = generateBalloonParams({ ...baseMetrics, mood: "playful" });
    const secret = generateBalloonParams({ ...baseMetrics, mood: "secret" });

    expect(gentle.hue).toBeGreaterThanOrEqual(130);
    expect(gentle.hue).toBeLessThanOrEqual(180);
    expect(playful.hue).toBeGreaterThanOrEqual(300);
    expect(playful.hue).toBeLessThanOrEqual(345);
    expect(secret.hue).toBeGreaterThanOrEqual(220);
    expect(secret.hue).toBeLessThanOrEqual(270);
    expect(playful.wobble).toBeGreaterThan(gentle.wobble);
    expect(secret.floatSpeed).toBeLessThan(playful.floatSpeed);
  });
});
