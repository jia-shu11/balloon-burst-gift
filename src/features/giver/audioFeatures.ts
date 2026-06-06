import type { AudioFeatureSummary, VoiceGiftSignature } from "../../domain/types";

const MEL_BAND_COUNT = 8;
const DEFAULT_SAMPLE_RATE = 44100;
const ENERGY_ENVELOPE_COUNT = 32;
const WAVEFORM_CONTOUR_COUNT = 48;

export interface RecordingFeatureFallback {
  durationSec: number;
  averageVolume: number;
  peakVolume: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function toSampleArray(samples: Float32Array | number[]) {
  return Array.from(samples, (sample) => clamp(finiteNumber(sample), -1, 1));
}

function nearestPowerOfTwo(value: number) {
  return 2 ** Math.floor(Math.log2(Math.max(2, value)));
}

function hzToMel(hz: number) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number) {
  return 700 * (10 ** (mel / 2595) - 1);
}

function computeSpectrum(samples: number[], sampleRate: number) {
  const frameSize = Math.min(2048, nearestPowerOfTwo(samples.length));
  if (frameSize < 2) return { magnitudes: [0], frameSize: 2 };

  const start = Math.max(0, Math.floor((samples.length - frameSize) / 2));
  const frame = samples.slice(start, start + frameSize);
  const magnitudes: number[] = [];
  const binCount = Math.floor(frameSize / 2);

  for (let bin = 1; bin <= binCount; bin += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const windowedSample = frame[index] * (0.5 - 0.5 * Math.cos((Math.PI * 2 * index) / (frameSize - 1)));
      const angle = (Math.PI * 2 * bin * index) / frameSize;
      real += windowedSample * Math.cos(angle);
      imaginary -= windowedSample * Math.sin(angle);
    }
    magnitudes.push(Math.hypot(real, imaginary));
  }

  return { magnitudes, frameSize, sampleRate };
}

function computeSpectralCentroid(magnitudes: number[], frameSize: number, sampleRate: number) {
  let weighted = 0;
  let total = 0;
  for (let index = 0; index < magnitudes.length; index += 1) {
    const magnitude = magnitudes[index];
    const frequency = ((index + 1) * sampleRate) / frameSize;
    weighted += frequency * magnitude;
    total += magnitude;
  }
  return total > 0 ? Number((weighted / total).toFixed(2)) : 0;
}

function computeMelBands(magnitudes: number[], frameSize: number, sampleRate: number) {
  const minMel = hzToMel(80);
  const maxMel = hzToMel(sampleRate / 2);
  const bandTotals = Array(MEL_BAND_COUNT).fill(0) as number[];
  const boundaries = Array.from({ length: MEL_BAND_COUNT + 1 }, (_, index) =>
    melToHz(minMel + ((maxMel - minMel) * index) / MEL_BAND_COUNT)
  );

  for (let index = 0; index < magnitudes.length; index += 1) {
    const frequency = ((index + 1) * sampleRate) / frameSize;
    const bandIndex = boundaries.findIndex((boundary, boundaryIndex) => {
      const next = boundaries[boundaryIndex + 1];
      return next !== undefined && frequency >= boundary && frequency < next;
    });
    if (bandIndex >= 0) bandTotals[bandIndex] += magnitudes[index];
  }

  const maxBand = Math.max(...bandTotals, 1);
  return bandTotals.map((value) => Number((value / maxBand).toFixed(4)));
}

function segmentBounds(length: number, segmentCount: number, index: number) {
  const start = Math.floor((length * index) / segmentCount);
  const end = Math.max(start + 1, Math.floor((length * (index + 1)) / segmentCount));
  return { start, end: Math.min(length, end) };
}

function computeEnergyEnvelope(samples: number[], segmentCount = ENERGY_ENVELOPE_COUNT) {
  const rawEnvelope = Array.from({ length: segmentCount }, (_, segmentIndex) => {
    const { start, end } = segmentBounds(samples.length, segmentCount, segmentIndex);
    let sum = 0;
    for (let index = start; index < end; index += 1) {
      sum += samples[index] ** 2;
    }
    return Math.sqrt(sum / Math.max(1, end - start));
  });

  const maxEnergy = Math.max(...rawEnvelope, 0);
  const normalizedEnvelope =
    maxEnergy > 0 ? rawEnvelope.map((value) => Number((value / maxEnergy).toFixed(3))) : rawEnvelope.map(() => 0);

  return { rawEnvelope, normalizedEnvelope };
}

function computeWaveformContour(samples: number[], segmentCount = WAVEFORM_CONTOUR_COUNT) {
  if (samples.length === 0) return Array(segmentCount).fill(0) as number[];

  return Array.from({ length: segmentCount }, (_, segmentIndex) => {
    const { start, end } = segmentBounds(samples.length, segmentCount, segmentIndex);
    let positivePeak = 0;
    let negativePeak = 0;
    for (let index = start; index < end; index += 1) {
      positivePeak = Math.max(positivePeak, samples[index]);
      negativePeak = Math.min(negativePeak, samples[index]);
    }
    const dominant = Math.abs(positivePeak) >= Math.abs(negativePeak) ? positivePeak : negativePeak;
    return Number(clamp(dominant, -1, 1).toFixed(3));
  });
}

function quantile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function computePausePattern(normalizedEnvelope: number[]) {
  const mean = normalizedEnvelope.reduce((sum, value) => sum + value, 0) / Math.max(1, normalizedEnvelope.length);
  const threshold = Math.max(0.12, mean * 0.45);
  return normalizedEnvelope
    .map((value, index) => ({
      position: Number(((index + 0.5) / normalizedEnvelope.length).toFixed(3)),
      strength: Number(clamp(1 - value / threshold, 0, 1).toFixed(3))
    }))
    .filter((pause) => pause.strength > 0.2)
    .slice(0, 8);
}

function computeRhythmDensity(normalizedEnvelope: number[], durationSec: number) {
  if (normalizedEnvelope.length < 3 || durationSec <= 0) return 0;
  const mean = normalizedEnvelope.reduce((sum, value) => sum + value, 0) / normalizedEnvelope.length;
  let peaks = 0;
  for (let index = 1; index < normalizedEnvelope.length - 1; index += 1) {
    const current = normalizedEnvelope[index];
    if (current > mean && current >= normalizedEnvelope[index - 1] && current > normalizedEnvelope[index + 1]) {
      peaks += 1;
    }
  }
  return Number((peaks / durationSec).toFixed(3));
}

function createVoiceSignature(
  samples: number[],
  durationSec: number,
  melTexture: number[],
  spectralCentroid: number
): VoiceGiftSignature {
  const { rawEnvelope, normalizedEnvelope } = computeEnergyEnvelope(samples);
  const p10 = quantile(rawEnvelope, 0.1);
  const p90 = quantile(rawEnvelope, 0.9);
  const maxEnergy = Math.max(...rawEnvelope, 1);

  return {
    durationSec,
    energyEnvelope: normalizedEnvelope,
    waveformContour: computeWaveformContour(samples),
    melTexture,
    pausePattern: computePausePattern(normalizedEnvelope),
    rhythmDensity: computeRhythmDensity(normalizedEnvelope, durationSec),
    pitchAccent: Number(finiteNumber(spectralCentroid, 600).toFixed(2)),
    dynamicRange: Number(clamp((p90 - p10) / maxEnergy, 0, 1).toFixed(3))
  };
}

function createFallbackVoiceSignature(summary: RecordingFeatureFallback): VoiceGiftSignature {
  const durationSec = Number(Math.max(0, finiteNumber(summary.durationSec)).toFixed(2));
  return {
    durationSec,
    energyEnvelope: Array(ENERGY_ENVELOPE_COUNT).fill(0),
    waveformContour: Array(WAVEFORM_CONTOUR_COUNT).fill(0),
    melTexture: [1, 1, 1, 1, 0.2, 0.2, 0.2, 0.2],
    pausePattern: [],
    rhythmDensity: 0,
    pitchAccent: 600,
    dynamicRange: 0
  };
}

function computeSpeechRate(samples: number[], sampleRate: number) {
  const frameSize = Math.max(64, Math.round(sampleRate * 0.04));
  const hopSize = Math.max(32, Math.round(sampleRate * 0.02));
  const envelopes: number[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sum = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      sum += samples[index] ** 2;
    }
    envelopes.push(Math.sqrt(sum / frameSize));
  }

  if (envelopes.length < 3) return 0;

  const mean = envelopes.reduce((sum, value) => sum + value, 0) / envelopes.length;
  const variance = envelopes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / envelopes.length;
  const threshold = mean + Math.sqrt(variance) * 0.35;
  let peaks = 0;

  for (let index = 1; index < envelopes.length - 1; index += 1) {
    const current = envelopes[index];
    if (current > threshold && current >= envelopes[index - 1] && current > envelopes[index + 1]) {
      peaks += 1;
    }
  }

  const durationSec = samples.length / sampleRate;
  return durationSec > 0 ? Number((peaks / durationSec).toFixed(2)) : 0;
}

export function createFallbackAudioFeatures(summary: RecordingFeatureFallback): AudioFeatureSummary {
  return {
    durationSec: Number(Math.max(0, finiteNumber(summary.durationSec)).toFixed(2)),
    spectralCentroid: 600,
    rmsEnergy: Number(clamp(finiteNumber(summary.averageVolume), 0, 1).toFixed(3)),
    peakEnergy: Number(clamp(finiteNumber(summary.peakVolume), 0, 1).toFixed(3)),
    speechRate: 2,
    melBands: [1, 1, 1, 1, 0.2, 0.2, 0.2, 0.2],
    voiceSignature: createFallbackVoiceSignature(summary)
  };
}

function sameMelBands(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.0001);
}

export function isFallbackAudioFeatures(features: AudioFeatureSummary) {
  const fallback = createFallbackAudioFeatures({ durationSec: features.durationSec, averageVolume: features.rmsEnergy, peakVolume: features.peakEnergy });
  return (
    Math.abs(features.spectralCentroid - fallback.spectralCentroid) < 0.01 &&
    Math.abs(features.speechRate - fallback.speechRate) < 0.01 &&
    sameMelBands(features.melBands, fallback.melBands)
  );
}

export function resolveFinalAudioFeatures(
  decodedFeatures: AudioFeatureSummary,
  realtimeFeatures: AudioFeatureSummary | null,
  fallback: RecordingFeatureFallback
) {
  if (!realtimeFeatures || !isFallbackAudioFeatures(decodedFeatures)) return decodedFeatures;

  const durationSec = decodedFeatures.durationSec || fallback.durationSec || realtimeFeatures.durationSec;
  return {
    ...realtimeFeatures,
    durationSec: Number(Math.max(0, durationSec).toFixed(2))
  };
}

export function extractAudioFeaturesFromSamples(samples: Float32Array | number[], sampleRate = DEFAULT_SAMPLE_RATE): AudioFeatureSummary {
  const normalizedSamples = toSampleArray(samples);
  const safeSampleRate = Math.max(1, finiteNumber(sampleRate, DEFAULT_SAMPLE_RATE));
  if (normalizedSamples.length === 0) {
    return createFallbackAudioFeatures({ durationSec: 0, averageVolume: 0, peakVolume: 0 });
  }

  let energySum = 0;
  let peakEnergy = 0;
  for (const sample of normalizedSamples) {
    const absolute = Math.abs(sample);
    energySum += sample ** 2;
    peakEnergy = Math.max(peakEnergy, absolute);
  }

  const { magnitudes, frameSize } = computeSpectrum(normalizedSamples, safeSampleRate);
  const rmsEnergy = Math.sqrt(energySum / normalizedSamples.length);
  const durationSec = Number((normalizedSamples.length / safeSampleRate).toFixed(2));
  const spectralCentroid = computeSpectralCentroid(magnitudes, frameSize, safeSampleRate);
  const melBands = computeMelBands(magnitudes, frameSize, safeSampleRate);

  return {
    durationSec,
    spectralCentroid,
    rmsEnergy: Number(rmsEnergy.toFixed(3)),
    peakEnergy: Number(peakEnergy.toFixed(3)),
    speechRate: computeSpeechRate(normalizedSamples, safeSampleRate),
    melBands,
    voiceSignature: createVoiceSignature(normalizedSamples, durationSec, melBands, spectralCentroid)
  };
}

export async function analyzeAudioBlob(blob: Blob, fallback: RecordingFeatureFallback): Promise<AudioFeatureSummary> {
  const fallbackFeatures = createFallbackAudioFeatures(fallback);

  if (typeof window === "undefined") return fallbackFeatures;

  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return fallbackFeatures;

  const context = new AudioContextConstructor();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      for (let index = 0; index < channelData.length; index += 1) {
        samples[index] += channelData[index] / buffer.numberOfChannels;
      }
    }
    return extractAudioFeaturesFromSamples(samples, buffer.sampleRate);
  } catch {
    return fallbackFeatures;
  } finally {
    void context.close();
  }
}
