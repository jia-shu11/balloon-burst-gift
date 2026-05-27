import { FormEvent, useMemo, useRef, useState } from "react";
import { useRepositories } from "../../data/repositoryProvider";
import { uploadGiftFile } from "../../data/storage";
import { createSupabaseBrowserClient } from "../../data/supabaseClient";
import { generateBalloonParams } from "../../domain/balloonParams";
import type { GiftRoom } from "../../domain/types";
import { BrowserAudioRecorder, createRecordingSummary } from "./audioRecorder";
import { LiveBalloonPreview } from "./LiveBalloonPreview";
import {
  startSpeechTranscription as startBrowserSpeechTranscription,
  type TranscriptResult
} from "./transcription";

export interface RecordingDraft {
  blob: Blob;
  durationSec: number;
  averageVolume: number;
  peakVolume: number;
}

interface ImageUploadResult {
  urls: string[];
  bytes: number;
}

interface UploadContext {
  roomId: string;
  mediaId: string;
}

interface AudioRecorderController {
  start(onData: (level: number) => void): Promise<() => void>;
  stop(): Promise<Blob>;
}

type StartTranscription = (onTranscript: (result: TranscriptResult) => void) => (() => void) | null;

function createMediaId() {
  return crypto.randomUUID();
}

function shouldUseSupabaseStorage() {
  return import.meta.env.VITE_REPOSITORY_MODE === "supabase";
}

async function defaultUploadAudio(blob: Blob, context: UploadContext) {
  if (shouldUseSupabaseStorage()) {
    return uploadGiftFile(createSupabaseBrowserClient(), context.roomId, context.mediaId, blob, "audio.webm");
  }
  return URL.createObjectURL(blob);
}

async function defaultUploadImages(files: File[], context: UploadContext): Promise<ImageUploadResult> {
  if (shouldUseSupabaseStorage()) {
    const client = createSupabaseBrowserClient();
    const urls = await Promise.all(
      files.map((file, index) => uploadGiftFile(client, context.roomId, context.mediaId, file, file.name || `image-${index}.png`))
    );
    return {
      urls,
      bytes: files.reduce((total, file) => total + file.size, 0)
    };
  }

  return {
    urls: files.map((file) => URL.createObjectURL(file)),
    bytes: files.reduce((total, file) => total + file.size, 0)
  };
}

export function GiverComposer({
  room,
  initialRecording = null,
  uploadAudio = defaultUploadAudio,
  uploadImages = defaultUploadImages,
  recorder: providedRecorder,
  startTranscription = startBrowserSpeechTranscription,
  nowMs = () => performance.now(),
  onSubmitted
}: {
  room: GiftRoom;
  initialRecording?: RecordingDraft | null;
  uploadAudio?: (blob: Blob, context: UploadContext) => Promise<string>;
  uploadImages?: (files: File[], context: UploadContext) => Promise<ImageUploadResult>;
  recorder?: AudioRecorderController;
  startTranscription?: StartTranscription;
  nowMs?: () => number;
  onSubmitted?: () => void;
}) {
  const { gifts } = useRepositories();
  const recorderRef = useRef<AudioRecorderController | null>(null);
  if (!recorderRef.current) recorderRef.current = providedRecorder ?? new BrowserAudioRecorder();

  const [giverName, setGiverName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [extraText, setExtraText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState<RecordingDraft | null>(initialRecording);
  const [level, setLevel] = useState(initialRecording?.averageVolume ?? 0.2);
  const [recordingActive, setRecordingActive] = useState(false);
  const [stopMeter, setStopMeter] = useState<(() => void) | null>(null);
  const [stopTranscription, setStopTranscription] = useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const samplesRef = useRef<number[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);

  const imageBytes = imageFiles.reduce((total, file) => total + file.size, 0);
  const previewParams = useMemo(
    () =>
      generateBalloonParams({
        seed: `${room.id}:${giverName || "preview"}`,
        audioDurationSec: recording?.durationSec ?? (recordingActive ? 18 : 8),
        averageVolume: recording?.averageVolume ?? level,
        peakVolume: recording?.peakVolume ?? level,
        transcriptChars: transcript.length,
        extraTextChars: extraText.length,
        imageCount: imageFiles.length,
        imageBytes
      }),
    [extraText.length, giverName, imageBytes, imageFiles.length, level, recording, recordingActive, room.id, transcript.length]
  );

  async function startRecording() {
    if (recordingActive) return;

    setError("");
    setMessage("");
    setRecording(null);
    samplesRef.current = [];
    recordingStartedAtRef.current = nowMs();

    try {
      const stop = await recorderRef.current!.start((nextLevel) => {
        const normalizedLevel = Number(Math.min(1, Math.max(0, nextLevel)).toFixed(3));
        setLevel(normalizedLevel);
        samplesRef.current = [...samplesRef.current.slice(-400), normalizedLevel];
      });
      const stopSpeech = startTranscription((result) => {
        if (result.text) setTranscript(result.text);
      });
      setStopMeter(() => stop);
      setStopTranscription(() => stopSpeech);
      setRecordingActive(true);
    } catch (caught) {
      recordingStartedAtRef.current = null;
      setError(caught instanceof Error ? caught.message : "无法开始录音");
    }
  }

  async function stopRecording() {
    setError("");
    stopMeter?.();
    stopTranscription?.();
    setStopMeter(null);
    setStopTranscription(null);
    setRecordingActive(false);

    try {
      const blob = await recorderRef.current!.stop();
      const endedAtMs = nowMs();
      const summary = createRecordingSummary({
        startedAtMs: recordingStartedAtRef.current ?? endedAtMs,
        endedAtMs,
        samples: samplesRef.current
      });
      setRecording({
        blob,
        durationSec: summary.durationSec,
        averageVolume: summary.averageVolume,
        peakVolume: summary.peakVolume
      });
      setLevel(summary.averageVolume || level);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法结束录音");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!giverName.trim()) {
      setError("请填写署名");
      return;
    }
    if (!recording) {
      setError("请先录制一段语音");
      return;
    }

    setSubmitting(true);
    try {
      const mediaId = createMediaId();
      const uploadContext = { roomId: room.id, mediaId };
      const audioUrl = await uploadAudio(recording.blob, uploadContext);
      const imageUpload = await uploadImages(imageFiles, uploadContext);
      await gifts.createGift({
        roomId: room.id,
        inviteToken: room.inviteToken,
        giverName: giverName.trim(),
        audioUrl,
        audioDurationSec: recording.durationSec,
        averageVolume: recording.averageVolume,
        peakVolume: recording.peakVolume,
        transcript,
        editedTranscript: transcript,
        extraText,
        imageUrls: imageUpload.urls,
        imageBytes: imageUpload.bytes
      });

      setMessage("气球已送出");
      onSubmitted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "气球发送失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="giver-composer">
      <LiveBalloonPreview params={previewParams} level={level} />
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <div className="composer-heading">
          <h2>{room.title}</h2>
          <p>{room.promptText || `给 ${room.recipientName} 录一段祝福`}</p>
        </div>

        <label>
          署名
          <input value={giverName} onChange={(event) => setGiverName(event.target.value)} />
        </label>

        <div className="recording-status">
          <button type="button" onClick={startRecording} disabled={recordingActive}>
            开始录音
          </button>
          <button type="button" onClick={stopRecording} disabled={!recordingActive}>
            结束录音
          </button>
          <span>{recordingActive ? "录音中..." : recording ? `${recording.durationSec} 秒语音已就绪` : "还没有录音"}</span>
        </div>

        <label>
          转写文字
          <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} />
        </label>

        <label>
          附加文字
          <textarea value={extraText} onChange={(event) => setExtraText(event.target.value)} rows={3} />
        </label>

        <label>
          图片
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "正在送出" : "提交气球"}
        </button>
      </form>
    </section>
  );
}
