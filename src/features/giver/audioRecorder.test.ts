import { describe, expect, it } from "vitest";
import { calculateAudioLevel, createRecordingSummary } from "./audioRecorder";

describe("audioRecorder metrics", () => {
  it("converts analyser bytes to normalized volume", () => {
    expect(calculateAudioLevel(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(calculateAudioLevel(new Uint8Array([128, 255, 1]))).toBeGreaterThan(0.55);
  });

  it("creates duration, average, and peak summary", () => {
    const summary = createRecordingSummary({
      startedAtMs: 1000,
      endedAtMs: 11_000,
      samples: [0.1, 0.4, 0.9]
    });

    expect(summary.durationSec).toBe(10);
    expect(summary.averageVolume).toBeCloseTo(0.467, 2);
    expect(summary.peakVolume).toBe(0.9);
  });
});
