import type { AudioFeatureSummary } from "../../domain/types";
import { extractAudioFeaturesFromSamples } from "./audioFeatures";

const AUDIO_BITS_PER_SECOND = 64_000;
const AUDIO_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus"
];

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

export function chooseAudioRecorderOptions(isTypeSupported: (mimeType: string) => boolean): MediaRecorderOptions {
  const mimeType = AUDIO_MIME_TYPE_CANDIDATES.find(isTypeSupported);
  return mimeType ? { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND } : { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };
}

export function getMicrophoneErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "麦克风权限被拒绝，请在浏览器设置中允许麦克风后重试";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "未检测到麦克风，请连接或启用麦克风后重试";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "麦克风正被其他应用占用，请关闭占用后重试";
    }
  }
  return error instanceof Error ? error.message : "无法开始录音";
}

export function getAudioRecordingSupportError(input: {
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
}) {
  if (!input.isSecureContext) {
    return "手机录音需要 HTTPS 安全链接，请使用线上链接打开";
  }
  if (!input.hasGetUserMedia || !input.hasMediaRecorder) {
    return "当前浏览器不支持麦克风录音，请使用最新版 Safari、Chrome 或 Edge 打开";
  }
  return null;
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
  private stoppedPromise: Promise<Blob> | null = null;

  async start(onData: (frame: LiveRecordingFrame) => void) {
    const supportError = getAudioRecordingSupportError({
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      hasMediaRecorder: typeof MediaRecorder !== "undefined"
    });
    if (supportError) throw new Error(supportError);

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      context = AudioContextConstructor ? new AudioContextConstructor() : null;
      if (context?.state === "suspended") void context.resume().catch(() => undefined);

      const analyser = context?.createAnalyser() ?? null;
      if (context && analyser) {
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
      }

      const recorderOptions = chooseAudioRecorderOptions((mimeType) => MediaRecorder.isTypeSupported?.(mimeType) ?? false);
      const recorder = new MediaRecorder(stream, recorderOptions);
      const bytes = analyser ? new Uint8Array(analyser.fftSize) : null;
      let active = true;
      let latestFrame: LiveRecordingFrame | null = null;
      let lastFeatureAtMs = 0;
      let historySamples: number[] = [];
      const startedAtMs = performance.now();

      const tick = () => {
        if (!active || !analyser || !bytes || !context) return;
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
      this.mediaRecorder = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      });
      this.stoppedPromise = new Promise<Blob>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
          },
          { once: true }
        );
      });
      recorder.start();
      tick();

      let released = false;
      return () => {
        if (released) return;
        released = true;
        active = false;
        stream?.getTracks().forEach((track) => track.stop());
        if (context) void context.close();
      };
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close();
      this.mediaRecorder = null;
      this.stoppedPromise = null;
      this.chunks = [];
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }

  async stop() {
    if (!this.mediaRecorder) throw new Error("录音尚未开始");

    const recorder = this.mediaRecorder;
    const stopped = this.stoppedPromise;
    if (!stopped) throw new Error("录音数据尚未准备好");
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await stopped;
    this.mediaRecorder = null;
    this.stoppedPromise = null;
    return blob;
  }
}
