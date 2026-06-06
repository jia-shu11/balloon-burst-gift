import { describe, expect, it } from "vitest";
import { createFallbackAudioFeatures, extractAudioFeaturesFromSamples } from "./audioFeatures";
import { generateBalloonParams, getHighMelRatio } from "../../domain/balloonParams";
import type { AudioFeatureSummary } from "../../domain/types";

const SAMPLE_RATE = 8000;

function sineWave(frequency: number, seconds = 1, amplitude = 0.7) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((Math.PI * 2 * frequency * index) / SAMPLE_RATE) * amplitude;
  }
  return samples;
}

function pulseTrain(pulsesPerSecond: number, seconds = 2) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const interval = Math.floor(SAMPLE_RATE / pulsesPerSecond);
  for (let index = 0; index < samples.length; index += 1) {
    const phase = index % interval;
    if (phase < 80) samples[index] = 0.9 * (1 - phase / 80);
  }
  return samples;
}

function harmonicVoice(fundamental: number, seconds = 1.6, brightness = 0.35) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const harmonics = [1, 2, 3, 4, 5, 7, 9, 12];
  for (let index = 0; index < samples.length; index += 1) {
    let value = 0;
    for (const harmonic of harmonics) {
      const rolloff = 1 / harmonic;
      const brightBoost = harmonic > 4 ? brightness : 1;
      value += Math.sin((Math.PI * 2 * fundamental * harmonic * index) / SAMPLE_RATE) * rolloff * brightBoost;
    }
    samples[index] = Math.max(-1, Math.min(1, value * 0.55));
  }
  return samples;
}

function makeBalloonLightness(audioFeatures: AudioFeatureSummary) {
  return generateBalloonParams({
    seed: "frequency-voice-map",
    audioDurationSec: audioFeatures.durationSec,
    averageVolume: audioFeatures.rmsEnergy,
    peakVolume: audioFeatures.peakEnergy,
    transcriptChars: 0,
    extraTextChars: 0,
    imageCount: 0,
    imageBytes: 0,
    selectedHue: 155,
    audioFeatures
  }).lightness;
}

describe("extractAudioFeaturesFromSamples", () => {
  it("extracts a higher spectral centroid for higher pitched sound", () => {
    const low = extractAudioFeaturesFromSamples(sineWave(220), SAMPLE_RATE);
    const high = extractAudioFeaturesFromSamples(sineWave(1760), SAMPLE_RATE);

    expect(high.spectralCentroid).toBeGreaterThan(low.spectralCentroid * 3);
  });

  it("extracts RMS energy from signal amplitude", () => {
    const quiet = extractAudioFeaturesFromSamples(sineWave(440, 1, 0.1), SAMPLE_RATE);
    const loud = extractAudioFeaturesFromSamples(sineWave(440, 1, 0.7), SAMPLE_RATE);

    expect(loud.rmsEnergy).toBeGreaterThan(quiet.rmsEnergy * 5);
    expect(loud.peakEnergy).toBeGreaterThan(quiet.peakEnergy);
  });

  it("uses envelope peaks as a speech-rate proxy", () => {
    const slow = extractAudioFeaturesFromSamples(pulseTrain(1.5), SAMPLE_RATE);
    const fast = extractAudioFeaturesFromSamples(pulseTrain(5), SAMPLE_RATE);

    expect(fast.speechRate).toBeGreaterThan(slow.speechRate);
  });

  it("separates low and high Mel-band energy", () => {
    const low = extractAudioFeaturesFromSamples(sineWave(240), SAMPLE_RATE);
    const high = extractAudioFeaturesFromSamples(sineWave(2200), SAMPLE_RATE);

    expect(getHighMelRatio(high.melBands)).toBeGreaterThan(getHighMelRatio(low.melBands));
  });

  it("maps low and bright voice-like frequency differences to visibly different lightness", () => {
    const lowVoice = extractAudioFeaturesFromSamples(harmonicVoice(120, 1.6, 0.12), SAMPLE_RATE);
    const brightVoice = extractAudioFeaturesFromSamples(harmonicVoice(220, 1.6, 0.8), SAMPLE_RATE);

    expect(brightVoice.spectralCentroid).toBeGreaterThan(lowVoice.spectralCentroid);
    expect(makeBalloonLightness(brightVoice) - makeBalloonLightness(lowVoice)).toBeGreaterThan(20);
  });

  it("creates a voice signature from rhythm, waveform, pauses, and spectral texture", () => {
    const steadyVoice = extractAudioFeaturesFromSamples(sineWave(440, 2, 0.45), SAMPLE_RATE);
    const rhythmicVoice = extractAudioFeaturesFromSamples(pulseTrain(5, 2), SAMPLE_RATE);

    expect(steadyVoice.voiceSignature?.energyEnvelope).toHaveLength(32);
    expect(steadyVoice.voiceSignature?.waveformContour).toHaveLength(48);
    expect(steadyVoice.voiceSignature?.melTexture).toHaveLength(8);
    expect(rhythmicVoice.voiceSignature?.rhythmDensity).toBeGreaterThan(steadyVoice.voiceSignature?.rhythmDensity ?? 0);
    expect(rhythmicVoice.voiceSignature?.pausePattern.length).toBeGreaterThan(0);
    expect(rhythmicVoice.voiceSignature?.dynamicRange).toBeGreaterThan(steadyVoice.voiceSignature?.dynamicRange ?? 0);
  });
});

describe("createFallbackAudioFeatures", () => {
  it("keeps the old recorder summary usable when decoding is unavailable", () => {
    const fallback = createFallbackAudioFeatures({
      durationSec: 3,
      averageVolume: 0.25,
      peakVolume: 0.7
    });

    expect(fallback.durationSec).toBe(3);
    expect(fallback.spectralCentroid).toBe(600);
    expect(fallback.rmsEnergy).toBe(0.25);
    expect(fallback.peakEnergy).toBe(0.7);
    expect(fallback.melBands).toHaveLength(8);
  });
});
