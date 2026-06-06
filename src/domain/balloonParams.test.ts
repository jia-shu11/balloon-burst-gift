import { describe, expect, it } from "vitest";
import type { AudioFeatureSummary, VoiceGiftSignature } from "./types";
import {
  generateBalloonParams,
  getAudioInflationScale,
  getHighMelRatio,
  mapLinear
} from "./balloonParams";

const baseAudio: AudioFeatureSummary = {
  durationSec: 2,
  spectralCentroid: 1200,
  rmsEnergy: 0.18,
  peakEnergy: 0.6,
  speechRate: 2,
  melBands: [1, 1, 1, 1, 1, 1, 1, 1]
};

const voiceSignature: VoiceGiftSignature = {
  durationSec: 2,
  energyEnvelope: [0.1, 0.7, 0.2, 0.8],
  waveformContour: [-0.2, 0.4, -0.1, 0.5],
  melTexture: [0.2, 0.4, 0.8, 0.3, 0.1, 0.7, 0.5, 0.9],
  pausePattern: [{ position: 0.5, strength: 0.7 }],
  rhythmDensity: 4,
  pitchAccent: 650,
  dynamicRange: 0.6
};

function makeParams(audioFeatures: AudioFeatureSummary, selectedHue = 210) {
  return generateBalloonParams({
    seed: "audio-map",
    audioDurationSec: audioFeatures.durationSec,
    averageVolume: audioFeatures.rmsEnergy,
    peakVolume: audioFeatures.peakEnergy,
    transcriptChars: 0,
    extraTextChars: 0,
    imageCount: 0,
    imageBytes: 0,
    selectedHue,
    audioFeatures
  });
}

describe("mapLinear", () => {
  it("maps values proportionally between normalized ranges", () => {
    expect(mapLinear(300, 300, 3300, 32, 82)).toBe(32);
    expect(mapLinear(1800, 300, 3300, 32, 82)).toBe(57);
    expect(mapLinear(3300, 300, 3300, 32, 82)).toBe(82);
    expect(mapLinear(-20, 300, 3300, 32, 82)).toBe(32);
    expect(mapLinear(9000, 300, 3300, 32, 82)).toBe(82);
  });
});

describe("generateBalloonParams", () => {
  it("uses audio duration as a proportional inflation source", () => {
    expect(getAudioInflationScale(0)).toBe(1);
    expect(getAudioInflationScale(1)).toBe(1.5);
    expect(getAudioInflationScale(2)).toBe(2);

    const baseGift = makeParams({ ...baseAudio, durationSec: 0 });
    const oneSecondGift = makeParams({ ...baseAudio, durationSec: 1 });
    const twoSecondGift = makeParams({ ...baseAudio, durationSec: 2 });

    expect(oneSecondGift.radius).toBeCloseTo(baseGift.radius * 1.5, 1);
    expect(twoSecondGift.radius).toBeCloseTo(baseGift.radius * 2, 1);
  });

  it("maps spectral centroid linearly to color lightness while hue stays user-controlled", () => {
    const low = makeParams({ ...baseAudio, spectralCentroid: 200 }, 144);
    const mid = makeParams({ ...baseAudio, spectralCentroid: 600 }, 144);
    const high = makeParams({ ...baseAudio, spectralCentroid: 1000 }, 144);

    expect(low.hue).toBe(144);
    expect(high.hue).toBe(144);
    expect(low.lightness).toBe(32);
    expect(mid.lightness).toBe(57);
    expect(high.lightness).toBe(82);
  });

  it("maps audio energy linearly to glow strength", () => {
    const quiet = makeParams({ ...baseAudio, rmsEnergy: 0.03 });
    const medium = makeParams({ ...baseAudio, rmsEnergy: 0.125 });
    const loud = makeParams({ ...baseAudio, rmsEnergy: 0.22 });

    expect(quiet.glow).toBeCloseTo(0.25, 2);
    expect(medium.glow).toBeCloseTo(0.625, 2);
    expect(loud.glow).toBeCloseTo(1, 2);
  });

  it("maps rhythm density to movement speed", () => {
    const slow = makeParams({ ...baseAudio, speechRate: 0.8 });
    const medium = makeParams({ ...baseAudio, speechRate: 2.9 });
    const fast = makeParams({ ...baseAudio, speechRate: 5 });

    expect(slow.floatSpeed).toBeCloseTo(0.246, 2);
    expect(medium.floatSpeed).toBeCloseTo(0.577, 2);
    expect(fast.floatSpeed).toBeCloseTo(0.75, 2);
  });

  it("maps high Mel ratio only to spike count, with fixed spike length", () => {
    const lowMel = makeParams({ ...baseAudio, melBands: [4, 4, 3, 3, 1, 1, 1, 1] });
    const highMel = makeParams({ ...baseAudio, melBands: [1, 1, 1, 1, 4, 4, 4, 4] });

    expect(getHighMelRatio(lowMel.audioFeatures.melBands)).toBeLessThan(getHighMelRatio(highMel.audioFeatures.melBands));
    expect(highMel.spikeCount).toBeGreaterThan(lowMel.spikeCount);
    expect(highMel.spikeLength).toBe(lowMel.spikeLength);
  });

  it("carries voice signatures so same-pitch voices can still produce different identities", () => {
    const calm = makeParams({
      ...baseAudio,
      spectralCentroid: 620,
      voiceSignature: {
        ...voiceSignature,
        energyEnvelope: [0.2, 0.22, 0.2, 0.21],
        waveformContour: [0, 0.1, 0, -0.1],
        rhythmDensity: 0.8,
        dynamicRange: 0.05
      }
    });
    const expressive = makeParams({
      ...baseAudio,
      spectralCentroid: 620,
      voiceSignature
    });

    expect(expressive.voiceSignature.waveformContour.slice(0, voiceSignature.waveformContour.length)).toEqual(
      voiceSignature.waveformContour
    );
    expect(expressive.voiceSignature.waveformContour).toHaveLength(48);
    expect(expressive.wobble).toBeGreaterThan(calm.wobble);
    expect(expressive.floatSpeed).toBeGreaterThan(calm.floatSpeed);
    expect(expressive.glow).toBeGreaterThan(calm.glow);
  });

  it("amplifies ordinary voice-range differences into visibly distinct balloons", () => {
    const lowVoice = makeParams({
      ...baseAudio,
      spectralCentroid: 420,
      rmsEnergy: 0.055,
      speechRate: 1.1,
      melBands: [3, 3, 2.4, 2, 1, 0.8, 0.6, 0.5]
    });
    const layeredVoice = makeParams({
      ...baseAudio,
      spectralCentroid: 950,
      rmsEnergy: 0.18,
      speechRate: 4.1,
      melBands: [0.6, 0.7, 0.8, 1, 2.4, 2.8, 3, 3.2]
    });

    expect(layeredVoice.lightness - lowVoice.lightness).toBeGreaterThan(30);
    expect(layeredVoice.glow - lowVoice.glow).toBeGreaterThan(0.45);
    expect(layeredVoice.floatSpeed - lowVoice.floatSpeed).toBeGreaterThan(0.4);
    expect(layeredVoice.spikeCount - lowVoice.spikeCount).toBeGreaterThanOrEqual(16);
  });

  it("normalizes malformed metrics before scoring", () => {
    const params = generateBalloonParams({
      seed: "malformed",
      audioDurationSec: Number.NaN,
      averageVolume: Number.POSITIVE_INFINITY,
      peakVolume: -1,
      transcriptChars: Number.NEGATIVE_INFINITY,
      extraTextChars: -250,
      imageCount: -10,
      imageBytes: 900_000,
      selectedHue: Number.NaN,
      audioFeatures: {
        durationSec: Number.NaN,
        spectralCentroid: Number.POSITIVE_INFINITY,
        rmsEnergy: -1,
        peakEnergy: -1,
        speechRate: Number.NaN,
        melBands: [Number.NaN, -1, Number.POSITIVE_INFINITY]
      }
    });

    expect(Object.values(params).filter((value) => typeof value === "number").every(Number.isFinite)).toBe(true);
    expect(params.radius).toBeGreaterThanOrEqual(42);
    expect(params.radius).toBeLessThanOrEqual(260);
    expect(params.fragmentCount).toBeGreaterThanOrEqual(8);
    expect(params.fragmentCount).toBeLessThanOrEqual(36);
    expect(params.glow).toBeGreaterThanOrEqual(0.25);
    expect(params.glow).toBeLessThanOrEqual(1);
  });
});
