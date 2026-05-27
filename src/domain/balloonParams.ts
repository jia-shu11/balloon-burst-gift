import type { BalloonParams, GiftInputMetrics } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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

export function generateBalloonParams(metrics: GiftInputMetrics): BalloonParams {
  const audioDurationSec = finiteNonNegative(metrics.audioDurationSec);
  const averageVolume = finiteNonNegative(metrics.averageVolume);
  const peakVolume = finiteNonNegative(metrics.peakVolume);
  const transcriptChars = finiteNonNegative(metrics.transcriptChars);
  const extraTextChars = finiteNonNegative(metrics.extraTextChars);
  const imageCount = finiteNonNegative(metrics.imageCount);
  const imageBytes = finiteNonNegative(metrics.imageBytes);

  const durationScore = clamp(audioDurationSec / 75, 0, 1);
  const transcriptScore = clamp(transcriptChars / 800, 0, 1);
  const textScore = clamp(extraTextChars / 500, 0, 1);
  const imageCountScore = clamp(imageCount / 5, 0, 1);
  const imageBytesScore = clamp(imageBytes / 4_000_000, 0, 1);
  const imageScore = clamp(imageCountScore + imageBytesScore, 0, 1);
  const dataScore = clamp(durationScore * 0.62 + transcriptScore * 0.14 + textScore * 0.1 + imageScore * 0.14, 0, 1);
  const volumeScore = clamp(averageVolume * 0.65 + peakVolume * 0.35, 0, 1);
  const variance = (seededUnit(metrics.seed, 1) - 0.5) * 10;

  return {
    radius: Math.round(clamp(48 + dataScore * 78 + variance, 42, 132)),
    stretchX: Number((0.88 + seededUnit(metrics.seed, 2) * 0.26).toFixed(3)),
    stretchY: Number((1.02 + seededUnit(metrics.seed, 3) * 0.28 + dataScore * 0.12).toFixed(3)),
    wobble: Number(clamp(0.1 + volumeScore * 0.8, 0.1, 1).toFixed(3)),
    glow: Number(clamp(0.25 + dataScore * 0.5 + volumeScore * 0.25, 0.25, 1).toFixed(3)),
    surfaceWaveDensity: Math.round(clamp(3 + durationScore * 8 + transcriptScore * 5 + imageScore * 4, 3, 20)),
    floatSpeed: Number((0.18 + seededUnit(metrics.seed, 4) * 0.42).toFixed(3)),
    stringLength: Math.round(42 + seededUnit(metrics.seed, 5) * 72),
    fragmentCount: Math.round(clamp(8 + dataScore * 22 + imageScore * 6, 8, 36)),
    burstRadius: Math.round(clamp(120 + dataScore * 220, 120, 340)),
    hue: Math.round((320 + seededUnit(metrics.seed, 6) * 190) % 360)
  };
}
