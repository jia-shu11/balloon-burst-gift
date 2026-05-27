import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createManualTranscript,
  getSpeechRecognitionConstructor,
  normalizeTranscript,
  startSpeechTranscription
} from "./transcription";

describe("transcription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes recognition transcript text", () => {
    expect(normalizeTranscript("  happy birthday\nstay bright  ")).toBe("happy birthday stay bright");
  });

  it("creates a manual fallback transcript", () => {
    expect(createManualTranscript("  always happy  ")).toEqual({
      source: "manual",
      text: "always happy"
    });
  });

  it("detects prefixed browser SpeechRecognition", () => {
    const SpeechRecognitionMock = vi.fn();
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: SpeechRecognitionMock
    });

    expect(getSpeechRecognitionConstructor()).toBe(SpeechRecognitionMock);
  });

  it("returns null when speech recognition is unavailable", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined
    });

    expect(startSpeechTranscription(vi.fn())).toBeNull();
  });
});
