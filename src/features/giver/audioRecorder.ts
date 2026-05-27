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

export function calculateAudioLevel(bytes: Uint8Array) {
  if (bytes.length === 0) return 0;
  const total = bytes.reduce((sum, value) => sum + Math.abs(value - 128) / 128, 0);
  return Number(Math.min(1, total / bytes.length).toFixed(3));
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

  async start(onData: (level: number) => void) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bytes = new Uint8Array(analyser.frequencyBinCount);
    let active = true;

    const tick = () => {
      if (!active) return;
      analyser.getByteTimeDomainData(bytes);
      onData(calculateAudioLevel(bytes));
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
