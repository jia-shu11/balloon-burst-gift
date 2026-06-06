import type { AudioFeatureSummary, BalloonParams, GiftInputMetrics, VoiceGiftSignature, VoicePause } from "./types";

const MIN_BALLOON_RADIUS = 42;
const MAX_BALLOON_RADIUS = 260;
const AUDIO_INFLATION_PER_SECOND = 0.5;
const DEFAULT_HUE = 155;
const DEFAULT_MEL_BANDS = 8;
const DEFAULT_ENVELOPE_POINTS = 32;
const DEFAULT_CONTOUR_POINTS = 48;
const FIXED_SPIKE_LENGTH = 0.14;
const FREQUENCY_RANGE = { min: 200, max: 1000 };
const ENERGY_RANGE = { min: 0.03, max: 0.22 };
const HIGH_MEL_RATIO_RANGE = { min: 0.3, max: 0.75 };
const RHYTHM_DENSITY_RANGE = { min: 0, max: 4 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function finiteNonNegative(value: number, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededUnit(seed: string, salt: number) {
  const x = Math.sin(hashSeed(seed) + salt * 999) * 10000;
  return x - Math.floor(x);
}

function normalizeHue(value: number | undefined, seed: string) {
  const fallbackHue = Math.round((DEFAULT_HUE + seededUnit(seed, 6) * 80) % 360);
  const source = Number.isFinite(value) ? value! : fallbackHue;
  return Math.round(((source % 360) + 360) % 360);
}

function normalizeMelBands(melBands: number[] | undefined) {
  const source = melBands?.length ? melBands : Array(DEFAULT_MEL_BANDS).fill(0);
  return Array.from({ length: DEFAULT_MEL_BANDS }, (_, index) => finiteNonNegative(source[index] ?? 0));
}

function normalizeArray(values: number[] | undefined, length: number, fallback: number, min: number, max: number) {
  const source = values?.length ? values : Array(length).fill(fallback);
  return Array.from({ length }, (_, index) => Number(clamp(finiteNumber(source[index] ?? fallback, fallback), min, max).toFixed(3)));
}

function normalizePausePattern(pauses: VoicePause[] | undefined) {
  return (pauses ?? []).slice(0, 8).map((pause) => ({
    position: Number(clamp(finiteNumber(pause.position), 0, 1).toFixed(3)),
    strength: Number(clamp(finiteNumber(pause.strength), 0, 1).toFixed(3))
  }));
}

function normalizeAudioFeatures(metrics: GiftInputMetrics): AudioFeatureSummary {
  const source = metrics.audioFeatures;
  const durationSec = finiteNonNegative(source?.durationSec ?? metrics.audioDurationSec);
  const rmsEnergy = finiteNonNegative(source?.rmsEnergy ?? metrics.averageVolume);
  const peakEnergy = finiteNonNegative(source?.peakEnergy ?? metrics.peakVolume);

  return {
    durationSec,
    spectralCentroid: finiteNonNegative(source?.spectralCentroid ?? 600, 600),
    rmsEnergy,
    peakEnergy,
    speechRate: finiteNonNegative(source?.speechRate ?? 2, 2),
    melBands: normalizeMelBands(source?.melBands),
    voiceSignature: source?.voiceSignature
  };
}

function createDefaultVoiceSignature(audioFeatures: AudioFeatureSummary): VoiceGiftSignature {
  return {
    durationSec: audioFeatures.durationSec,
    energyEnvelope: Array(DEFAULT_ENVELOPE_POINTS).fill(0),
    waveformContour: Array(DEFAULT_CONTOUR_POINTS).fill(0),
    melTexture: normalizeMelBands(audioFeatures.melBands),
    pausePattern: [],
    rhythmDensity: finiteNonNegative(audioFeatures.speechRate),
    pitchAccent: finiteNonNegative(audioFeatures.spectralCentroid, 600),
    dynamicRange: 0
  };
}

function normalizeVoiceSignature(source: VoiceGiftSignature | undefined, audioFeatures: AudioFeatureSummary): VoiceGiftSignature {
  const fallback = createDefaultVoiceSignature(audioFeatures);
  const signature = source ?? fallback;

  return {
    durationSec: finiteNonNegative(signature.durationSec ?? audioFeatures.durationSec),
    energyEnvelope: normalizeArray(signature.energyEnvelope, DEFAULT_ENVELOPE_POINTS, 0, 0, 1),
    waveformContour: normalizeArray(signature.waveformContour, DEFAULT_CONTOUR_POINTS, 0, -1, 1),
    melTexture: normalizeMelBands(signature.melTexture),
    pausePattern: normalizePausePattern(signature.pausePattern),
    rhythmDensity: finiteNonNegative(signature.rhythmDensity ?? audioFeatures.speechRate),
    pitchAccent: finiteNonNegative(signature.pitchAccent ?? audioFeatures.spectralCentroid, 600),
    dynamicRange: Number(clamp(finiteNonNegative(signature.dynamicRange), 0, 1).toFixed(3))
  };
}

export function mapLinear(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
  if (inputMax === inputMin) return Number(outputMin.toFixed(3));
  const ratio = clamp((finiteNumber(value, inputMin) - inputMin) / (inputMax - inputMin), 0, 1);
  return Number((outputMin + ratio * (outputMax - outputMin)).toFixed(3));
}

export function getHighMelRatio(melBands: number[]) {
  const normalized = normalizeMelBands(melBands);
  const total = normalized.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;

  const splitIndex = Math.floor(normalized.length / 2);
  const highTotal = normalized.slice(splitIndex).reduce((sum, value) => sum + value, 0);
  return Number((highTotal / total).toFixed(4));
}

export function getAudioInflationScale(audioDurationSec: number) {
  return Number((1 + finiteNonNegative(audioDurationSec) * AUDIO_INFLATION_PER_SECOND).toFixed(3));
}

export function generateBalloonParams(metrics: GiftInputMetrics): BalloonParams {
  const audioFeatures = normalizeAudioFeatures(metrics);
  const voiceSignature = normalizeVoiceSignature(metrics.voiceSignature ?? audioFeatures.voiceSignature, audioFeatures);
  const imageCount = finiteNonNegative(metrics.imageCount);
  const imageBytes = finiteNonNegative(metrics.imageBytes);

  const radius = Number(
    clamp(48 * getAudioInflationScale(audioFeatures.durationSec), MIN_BALLOON_RADIUS, MAX_BALLOON_RADIUS).toFixed(2)
  );
  const lightness = mapLinear(audioFeatures.spectralCentroid, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, 32, 82);
  const glow = Number(clamp(mapLinear(audioFeatures.rmsEnergy, ENERGY_RANGE.min, ENERGY_RANGE.max, 0.25, 1) + voiceSignature.dynamicRange * 0.22, 0.25, 1).toFixed(3));
  const floatSpeed = mapLinear(voiceSignature.rhythmDensity, RHYTHM_DENSITY_RANGE.min, RHYTHM_DENSITY_RANGE.max, 0.12, 0.75);
  const highMelRatio = getHighMelRatio(voiceSignature.melTexture);
  const imageScore = clamp(imageCount / 4 + imageBytes / 4_000_000, 0, 1);
  const rhythmWobble = mapLinear(voiceSignature.rhythmDensity, RHYTHM_DENSITY_RANGE.min, RHYTHM_DENSITY_RANGE.max, 0.1, 0.75);

  return {
    radius,
    stretchX: Number((0.96 + seededUnit(metrics.seed, 2) * 0.12).toFixed(3)),
    stretchY: Number((1.08 + seededUnit(metrics.seed, 3) * 0.08 + voiceSignature.dynamicRange * 0.06).toFixed(3)),
    wobble: Number(clamp(rhythmWobble + voiceSignature.dynamicRange * 0.25, 0.1, 0.95).toFixed(3)),
    glow,
    lightness,
    surfaceWaveDensity: Math.round(clamp(4 + highMelRatio * 10 + voiceSignature.dynamicRange * 4, 4, 18)),
    floatSpeed,
    stringLength: Math.round(42 + seededUnit(metrics.seed, 5) * 48),
    fragmentCount: Math.round(clamp(8 + audioFeatures.durationSec * 1.5 + imageScore * 10, 8, 36)),
    burstRadius: Math.round(clamp(radius * 2.2 + glow * 70, 120, 560)),
    hue: normalizeHue(metrics.selectedHue, metrics.seed),
    spikeCount: Math.round(mapLinear(highMelRatio, HIGH_MEL_RATIO_RANGE.min, HIGH_MEL_RATIO_RANGE.max, 0, 28)),
    spikeLength: FIXED_SPIKE_LENGTH,
    audioFeatures: { ...audioFeatures, voiceSignature },
    voiceSignature
  };
}
