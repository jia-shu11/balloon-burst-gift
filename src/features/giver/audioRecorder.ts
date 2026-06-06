import type { AudioFeatureSummary } from "../../domain/types";
import { extractAudioFeaturesFromSamples } from "./audioFeatures";

export interface RecordingSummary {
  durationSec: number;
  averageVolume: number;
  peakVolume: number;
}

export interface RecordingSummaryInput {
  startedAtMs: number;
  endedAtMs: number;
  samples: number[];
}

export interface LiveRecordingFrame {
  level: number;
  audioFeatures: AudioFeatureSummary;
}

export interface LiveRecordingFrameInput {
  bytes: Uint8Array;
  sampleRate: number;
  elapsedSec: number;
  historySamples?: number[];
}

export function calculateAudioLevel(bytes: Uint8Array) {
  if (bytes.length === 0) return 0;
  const total = bytes.reduce((sum, value) => sum + Math.abs(value - 128) / 128, 0);
  return Number(Math.min(1, total / bytes.length).toFixed(3));
}

function bytesToSamples(bytes: Uint8Array) {
  return Float32Array.from(bytes, (value) => (value - 128) / 128);
}

export function appendLiveAudioSamples(historySamples: number[], bytes: Uint8Array, sampleRate: number) {
  const nextSamples = Array.from(bytesToSamples(bytes));
  const maxSamples = Math.max(bytes.length, Math.round(sampleRate * 1.6));
  return [...historySamples, ...nextSamples].slice(-maxSamples);
}

export function createLiveRecordingFrame(input: LiveRecordingFrameInput): LiveRecordingFrame {
  const sourceSamples = input.historySamples?.length ? input.historySamples : Array.from(bytesToSamples(input.bytes));
  const audioFeatures = extractAudioFeaturesFromSamples(sourceSamples, input.sampleRate);
  const latestFrameFeatures = extractAudioFeaturesFromSamples(bytesToSamples(input.bytes), input.sampleRate);

  return {
    level: calculateAudioLevel(input.bytes),
    audioFeatures: {
      ...audioFeatures,
      spectralCentroid: latestFrameFeatures.spectralCentroid,
      durationSec: Number(Math.max(0, input.elapsedSec).toFixed(2))
    }
  };
}

export function createRecordingSummary(input: RecordingSummaryInput): RecordingSummary {
  const durationSec = Math.max(0, Math.round((input.endedAtMs - input.startedAtMs) / 1000));
  const averageVolume =
    input.samples.length === 0 ? 0 : input.samples.reduce((sum, sample) => sum + sample, 0) / input.samples.length;
  const peakVolume = input.samples.length === 0 ? 0 : Math.max(...input.samples);

  return {
    durationSec,
    averageVolume: Number(averageVolume.toFixed(3)),
    peakVolume: Number(peakVolume.toFixed(3))
  };
}

export class BrowserAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];

  async start(onData: (frame: LiveRecordingFrame) => void) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const bytes = new Uint8Array(analyser.fftSize);
    let active = true;
    let latestFrame: LiveRecordingFrame | null = null;
    let lastFeatureAtMs = 0;
    let historySamples: number[] = [];
    const startedAtMs = performance.now();

    const tick = () => {
      if (!active) return;
      const nowMs = performance.now();
      const elapsedSec = (nowMs - startedAtMs) / 1000;
      analyser.getByteTimeDomainData(bytes);
      historySamples = appendLiveAudioSamples(historySamples, bytes, context.sampleRate);
      if (!latestFrame || nowMs - lastFeatureAtMs >= 160) {
        latestFrame = createLiveRecordingFrame({
          bytes,
          sampleRate: context.sampleRate,
          elapsedSec,
          historySamples
        });
        lastFeatureAtMs = nowMs;
      } else {
        latestFrame = {
          level: calculateAudioLevel(bytes),
          audioFeatures: {
            ...latestFrame.audioFeatures,
            durationSec: Number(Math.max(0, elapsedSec).toFixed(2))
          }
        };
      }
      onData(latestFrame);
      requestAnimationFrame(tick);
    };

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.mediaRecorder.start();
    tick();

    return () => {
      active = false;
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    };
  }

  async stop() {
    if (!this.mediaRecorder) throw new Error("录音尚未开始");

    const recorder = this.mediaRecorder;
    const stopped = new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
        },
        { once: true }
      );
    });

    recorder.stop();
    this.mediaRecorder = null;
    return stopped;
  }
}
