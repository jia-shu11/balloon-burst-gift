import { type CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRepositories } from "../../data/repositoryProvider";
import { uploadGiftFile } from "../../data/storage";
import { createSupabaseBrowserClient } from "../../data/supabaseClient";
import { BALLOON_MOOD_OPTIONS } from "../../domain/balloonMood";
import { generateBalloonParams } from "../../domain/balloonParams";
import type { BalloonGift, BalloonMood, GiftRoom } from "../../domain/types";
import { createBurstFragments } from "../../visual/fragments";
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

interface ImageDraft {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
}

interface AudioRecorderController {
  start(onData: (level: number) => void): Promise<() => void>;
  stop(): Promise<Blob>;
}

type StartTranscription = (onTranscript: (result: TranscriptResult) => void) => (() => void) | null;

function createMediaId() {
  return crypto.randomUUID();
}

function getPerformanceNowMs() {
  return performance.now();
}

function shouldUseSupabaseStorage() {
  return import.meta.env.VITE_REPOSITORY_MODE === "supabase";
}

function readBlobAsDataUrl(blob: Blob, failureMessage: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error(failureMessage));
      }
    };
    reader.onerror = () => reject(new Error(failureMessage));
    reader.readAsDataURL(blob);
  });
}

async function defaultUploadAudio(blob: Blob, context: UploadContext) {
  if (shouldUseSupabaseStorage()) {
    return uploadGiftFile(createSupabaseBrowserClient(), context.roomId, context.mediaId, blob, "audio.webm");
  }
  return readBlobAsDataUrl(blob, "语音读取失败");
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

  const urls = await Promise.all(files.map((file) => readBlobAsDataUrl(file, "图片读取失败")));
  return {
    urls,
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
  nowMs = getPerformanceNowMs,
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
  const [balloonMood, setBalloonMood] = useState<BalloonMood>("gentle");
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [selectedImageDraft, setSelectedImageDraft] = useState<ImageDraft | null>(null);
  const [burstPreviewOpen, setBurstPreviewOpen] = useState(false);
  const [recording, setRecording] = useState<RecordingDraft | null>(initialRecording);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");
  const [level, setLevel] = useState(initialRecording?.averageVolume ?? 0.2);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(initialRecording?.durationSec ?? 0);
  const [stopMeter, setStopMeter] = useState<(() => void) | null>(null);
  const [stopTranscription, setStopTranscription] = useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const samplesRef = useRef<number[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);

  const imageBytes = imageDrafts.reduce((total, draft) => total + draft.file.size, 0);
  const previewAudioDurationSec = recording?.durationSec ?? (recordingActive ? recordingElapsedSec : 0);
  const submitSummary = `${recording ? `${recording.durationSec} 秒语音` : "未录音"} · ${transcript.length} 字转写 · ${imageDrafts.length} 张图片`;
  const hasPreviewContent =
    Boolean(recording) || Boolean(transcript.trim()) || Boolean(extraText.trim()) || imageDrafts.length > 0 || Boolean(giverName.trim());

  useEffect(() => {
    if (!recordingActive) return undefined;

    const updateElapsed = () => {
      const startedAtMs = recordingStartedAtRef.current;
      if (startedAtMs === null) return;
      const elapsedSec = Math.max(0, (nowMs() - startedAtMs) / 1000);
      setRecordingElapsedSec(Number(elapsedSec.toFixed(2)));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 80);
    return () => window.clearInterval(intervalId);
  }, [nowMs, recordingActive]);

  useEffect(() => {
    let cancelled = false;

    if (!recording) {
      setRecordingPreviewUrl("");
      return undefined;
    }

    readBlobAsDataUrl(recording.blob, "语音读取失败")
      .then((url) => {
        if (!cancelled) setRecordingPreviewUrl(url);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "语音读取失败");
      });

    return () => {
      cancelled = true;
    };
  }, [recording]);

  const previewParams = useMemo(
    () =>
      generateBalloonParams({
        seed: `${room.id}:${giverName || "preview"}:${balloonMood}`,
        mood: balloonMood,
        audioDurationSec: previewAudioDurationSec,
        averageVolume: recording?.averageVolume ?? level,
        peakVolume: recording?.peakVolume ?? level,
        transcriptChars: transcript.length,
        extraTextChars: extraText.length,
        imageCount: imageDrafts.length,
        imageBytes
      }),
    [
      extraText.length,
      giverName,
      balloonMood,
      imageBytes,
      imageDrafts.length,
      level,
      previewAudioDurationSec,
      recording,
      room.id,
      transcript.length
    ]
  );

  async function startRecording() {
    if (recordingActive) return;

    setError("");
    setMessage("");
    setRecording(null);
    setRecordingPreviewUrl("");
    setRecordingElapsedSec(0);
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
      setRecordingElapsedSec(0);
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
      setRecordingElapsedSec(summary.durationSec);
      setLevel(summary.averageVolume || level);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法结束录音");
    }
  }

  function clearRecording() {
    if (recordingActive) return;
    setRecording(null);
    setRecordingPreviewUrl("");
    setRecordingElapsedSec(0);
    setLevel(0.2);
    samplesRef.current = [];
    recordingStartedAtRef.current = null;
  }

  async function handleImageFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    setError("");
    try {
      const drafts = await Promise.all(
        selectedFiles.map(async (file) => ({
          id: createMediaId(),
          file,
          name: file.name || "未命名图片",
          previewUrl: await readBlobAsDataUrl(file, "图片读取失败")
        }))
      );
      setImageDrafts((current) => [...current, ...drafts]);
      setBurstPreviewOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片读取失败");
    }
  }

  function removeImageDraft(id: string) {
    setImageDrafts((current) => current.filter((draft) => draft.id !== id));
    setSelectedImageDraft((current) => (current?.id === id ? null : current));
    setBurstPreviewOpen(false);
  }

  function createPreviewGift(): BalloonGift {
    return {
      id: "preview-gift",
      roomId: room.id,
      giverName: giverName.trim() || "署名",
      audioUrl: recordingPreviewUrl || "preview-audio",
      audioDurationSec: previewAudioDurationSec,
      averageVolume: recording?.averageVolume ?? level,
      peakVolume: recording?.peakVolume ?? level,
      transcript,
      editedTranscript: transcript,
      extraText,
      imageUrls: imageDrafts.map((draft) => draft.previewUrl),
      imageBytes,
      balloonParams: previewParams,
      deletedAt: null,
      createdAt: new Date(0).toISOString()
    };
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
      const imageUpload = await uploadImages(
        imageDrafts.map((draft) => draft.file),
        uploadContext
      );
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
        imageBytes: imageUpload.bytes,
        balloonMood
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
          {recording ? (
            <button type="button" className="secondary-button" onClick={clearRecording}>
              重新录音
            </button>
          ) : null}
          <span>{recordingActive ? "录音中..." : recording ? `${recording.durationSec} 秒语音已就绪` : "还没有录音"}</span>
        </div>

        {recordingPreviewUrl ? (
          <div className="recording-preview">
            <audio aria-label="试听当前录音" controls src={recordingPreviewUrl} />
          </div>
        ) : null}

        <fieldset className="mood-selector">
          <legend>气球气质</legend>
          <div className="mood-options">
            {BALLOON_MOOD_OPTIONS.map((option) => (
              <label className={`mood-option${balloonMood === option.value ? " is-selected" : ""}`} key={option.value}>
                <input
                  type="radio"
                  name="balloon-mood"
                  value={option.value}
                  aria-label={option.label}
                  checked={balloonMood === option.value}
                  onChange={() => {
                    setBalloonMood(option.value);
                    setBurstPreviewOpen(false);
                  }}
                />
                <span
                  className="mood-swatch"
                  style={{ "--mood-hue": option.hue } as CSSProperties}
                  aria-hidden="true"
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
            onChange={(event) => {
              void handleImageFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>

        {imageDrafts.length > 0 ? (
          <div className="image-draft-grid" aria-label="图片预览">
            {imageDrafts.map((draft) => (
              <div className="image-draft-card" key={draft.id}>
                <button type="button" className="image-draft-thumb" onClick={() => setSelectedImageDraft(draft)}>
                  <img src={draft.previewUrl} alt={`预览图片 ${draft.name}`} />
                </button>
                <div className="image-draft-meta">
                  <span>{draft.name}</span>
                  <button
                    type="button"
                    className="small-quiet-button"
                    aria-label={`移除图片 ${draft.name}`}
                    onClick={() => removeImageDraft(draft.id)}
                  >
                    移除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <section className="gift-fragment-preview" aria-label="礼物碎片预览">
          <div className="fragment-preview-heading">
            <h3>礼物碎片</h3>
            <span>实时预览</span>
          </div>
          <div className="fragment-preview-list">
            {recording ? <span>语音碎片</span> : null}
            {transcript.trim() ? <span>转写文字碎片</span> : null}
            {extraText.trim() ? <span>附加文字碎片</span> : null}
            {imageDrafts.map((draft, index) => (
              <span key={draft.id}>图片碎片 {index + 1}</span>
            ))}
            {giverName.trim() ? <span>署名碎片</span> : null}
            {!recording && !transcript.trim() && !extraText.trim() && imageDrafts.length === 0 && !giverName.trim() ? (
              <span>还没有碎片</span>
            ) : null}
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        <p className="submit-summary">{submitSummary}</p>
        <div className="composer-actions">
          <button type="button" className="secondary-button" disabled={!hasPreviewContent} onClick={() => setBurstPreviewOpen(true)}>
            试爆预览
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? "正在送出" : "提交气球"}
          </button>
        </div>
      </form>
      {burstPreviewOpen ? (
        <div
          className="composer-burst-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="制作端试爆预览"
          onClick={() => setBurstPreviewOpen(false)}
        >
          <div className="composer-burst-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="composer-burst-heading">
              <h3>试爆预览</h3>
              <button type="button" className="small-quiet-button" onClick={() => setBurstPreviewOpen(false)}>
                关闭
              </button>
            </div>
            <div className="composer-burst-stage">
              {createBurstFragments(createPreviewGift(), { x: 0, y: 0 }, false)
                .slice(0, 18)
                .map((fragment, index) => (
                  <span
                    key={fragment.id}
                    className={`composer-preview-fragment composer-preview-fragment-${fragment.kind}`}
                    style={
                      {
                        "--preview-x": `${Math.round(fragment.vx * 0.38)}px`,
                        "--preview-y": `${Math.round(fragment.vy * 0.38)}px`,
                        "--preview-r": `${fragment.rotation}deg`,
                        "--preview-delay": `${index * 18}ms`
                      } as CSSProperties
                    }
                    aria-hidden={fragment.kind === "particle"}
                  >
                    {fragment.kind === "particle" ? null : fragment.kind === "waveform" ? (
                      "语音"
                    ) : fragment.kind === "image" ? (
                      <img src={fragment.content} alt="试爆图片碎片" />
                    ) : (
                      fragment.content
                    )}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : null}
      {selectedImageDraft ? (
        <div
          className="image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`查看图片 ${selectedImageDraft.name}`}
          onClick={() => setSelectedImageDraft(null)}
        >
          <div className="image-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <img src={selectedImageDraft.previewUrl} alt={`放大预览 ${selectedImageDraft.name}`} />
            <button
              type="button"
              className="image-preview-close"
              aria-label="关闭图片预览"
              onClick={() => setSelectedImageDraft(null)}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
