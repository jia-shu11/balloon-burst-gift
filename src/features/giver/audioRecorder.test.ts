import { describe, expect, it } from "vitest";
import {
  appendLiveAudioSamples,
  calculateAudioLevel,
  chooseAudioRecorderOptions,
  getAudioRecordingSupportError,
  createLiveRecordingFrame,
  createRecordingSummary,
  getMicrophoneErrorMessage
} from "./audioRecorder";

function sineBytes(frequency: number, sampleRate = 8000, length = 2048) {
  return new Uint8Array(
    Array.from({ length }, (_, index) => {
      const sample = Math.sin((Math.PI * 2 * frequency * index) / sampleRate) * 0.82;
      return Math.round(128 + sample * 127);
    })
  );
}

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

  it("creates a realtime audio feature frame from analyser bytes", () => {
    const frame = createLiveRecordingFrame({
      bytes: new Uint8Array([128, 255, 128, 1, 128, 255, 128, 1]),
      sampleRate: 8000,
      elapsedSec: 1.25
    });

    expect(frame.level).toBeGreaterThan(0);
    expect(frame.audioFeatures.durationSec).toBe(1.25);
    expect(frame.audioFeatures.rmsEnergy).toBeGreaterThan(0);
    expect(frame.audioFeatures.melBands).toHaveLength(8);
  });

  it("keeps a rolling realtime window so rhythm and mel features have enough context", () => {
    const neutral = new Uint8Array(Array(512).fill(128));
    const pulse = new Uint8Array(Array.from({ length: 512 }, (_, index) => (index % 96 < 16 ? 255 : 128)));
    let history: number[] = [];

    for (let index = 0; index < 24; index += 1) {
      history = appendLiveAudioSamples(history, index % 3 === 0 ? pulse : neutral, 8000);
    }

    const frame = createLiveRecordingFrame({
      bytes: pulse,
      sampleRate: 8000,
      elapsedSec: 1.4,
      historySamples: history
    });

    expect(history.length).toBeGreaterThan(8000);
    expect(frame.audioFeatures.speechRate).toBeGreaterThan(0.5);
    expect(frame.audioFeatures.durationSec).toBe(1.4);
  });

  it("uses the latest analyser frame for realtime frequency", () => {
    const lowFrame = sineBytes(220);
    const highFrame = sineBytes(1600);
    let history: number[] = [];

    for (let index = 0; index < 8; index += 1) {
      history = appendLiveAudioSamples(history, lowFrame, 8000);
    }

    const frame = createLiveRecordingFrame({
      bytes: highFrame,
      sampleRate: 8000,
      elapsedSec: 1.2,
      historySamples: history
    });

    expect(frame.audioFeatures.spectralCentroid).toBeGreaterThan(1200);
  });

  it("chooses mp4 when it is the only mobile-compatible recording type", () => {
    const options = chooseAudioRecorderOptions((mimeType) => mimeType === "audio/mp4");

    expect(options).toEqual({
      mimeType: "audio/mp4",
      audioBitsPerSecond: 64_000
    });
  });

  it("explains common mobile microphone failures", () => {
    expect(getMicrophoneErrorMessage(new DOMException("denied", "NotAllowedError"))).toContain("麦克风权限");
    expect(getMicrophoneErrorMessage(new DOMException("missing", "NotFoundError"))).toContain("未检测到麦克风");
  });

  it("explains that mobile recording requires an HTTPS link", () => {
    expect(
      getAudioRecordingSupportError({
        isSecureContext: false,
        hasGetUserMedia: false,
        hasMediaRecorder: true
      })
    ).toContain("HTTPS");
  });
});
