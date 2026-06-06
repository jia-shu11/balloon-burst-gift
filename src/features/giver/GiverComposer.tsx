import { type CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { resolveRepositoryMode, useRepositories } from "../../data/repositoryProvider";
import { createAudioStorageFileName, uploadGiftFile } from "../../data/storage";
import { createSupabaseBrowserClient } from "../../data/supabaseClient";
import { generateBalloonParams } from "../../domain/balloonParams";
import type { AudioFeatureSummary, GiftRoom } from "../../domain/types";
import { BrowserAudioRecorder, createRecordingSummary, type LiveRecordingFrame } from "./audioRecorder";
import { analyzeAudioBlob, createFallbackAudioFeatures, resolveFinalAudioFeatures, type RecordingFeatureFallback } from "./audioFeatures";
import { LiveBalloonPreview } from "./LiveBalloonPreview";

const DEFAULT_HUE = 155;

export interface RecordingDraft {
  blob: Blob;
  durationSec: number;
  averageVolume: number;
  peakVolume: number;
  audioFeatures?: AudioFeatureSummary;
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
  start(onData: (frame: LiveRecordingFrame) => void): Promise<() => void>;
  stop(): Promise<Blob>;
}

function createMediaId() {
  return crypto.randomUUID();
}

function getPerformanceNowMs() {
  return performance.now();
}

export function shouldUseSupabaseStorage(
  env: Parameters<typeof resolveRepositoryMode>[0] = import.meta.env
) {
  return resolveRepositoryMode(env) === "supabase";
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
    return uploadGiftFile(
      createSupabaseBrowserClient(),
      context.roomId,
      context.mediaId,
      blob,
      createAudioStorageFileName(blob.type)
    );
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

function getRecordingFeatures(recording: RecordingDraft | null, fallback: RecordingFeatureFallback) {
  return recording?.audioFeatures ?? createFallbackAudioFeatures(fallback);
}

export function GiverComposer({
  room,
  initialRecording = null,
  uploadAudio = defaultUploadAudio,
  uploadImages = defaultUploadImages,
  recorder: providedRecorder,
  analyzeAudio = analyzeAudioBlob,
  nowMs = getPerformanceNowMs,
  onSubmitted
}: {
  room: GiftRoom;
  initialRecording?: RecordingDraft | null;
  uploadAudio?: (blob: Blob, context: UploadContext) => Promise<string>;
  uploadImages?: (files: File[], context: UploadContext) => Promise<ImageUploadResult>;
  recorder?: AudioRecorderController;
  analyzeAudio?: (blob: Blob, fallback: RecordingFeatureFallback) => Promise<AudioFeatureSummary>;
  nowMs?: () => number;
  onSubmitted?: () => void;
}) {
  const { gifts } = useRepositories();
  const recorderRef = useRef<AudioRecorderController | null>(null);
  if (!recorderRef.current) recorderRef.current = providedRecorder ?? new BrowserAudioRecorder();

  const [selectedHue, setSelectedHue] = useState(DEFAULT_HUE);
  const [anonymous, setAnonymous] = useState(true);
  const [giverName, setGiverName] = useState("");
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [selectedImageDraft, setSelectedImageDraft] = useState<ImageDraft | null>(null);
  const [recording, setRecording] = useState<RecordingDraft | null>(initialRecording);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");
  const [level, setLevel] = useState(initialRecording?.averageVolume ?? 0.2);
  const [liveAudioFeatures, setLiveAudioFeatures] = useState<AudioFeatureSummary | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(initialRecording?.durationSec ?? 0);
  const [stopMeter, setStopMeter] = useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const samplesRef = useRef<number[]>([]);
  const liveAudioFeaturesRef = useRef<AudioFeatureSummary | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const imageBytes = imageDrafts.reduce((total, draft) => total + draft.file.size, 0);
  const previewAudioDurationSec = recording?.durationSec ?? (recordingActive ? recordingElapsedSec : 0);
  const fallbackFeatures = useMemo(
    () =>
      createFallbackAudioFeatures({
        durationSec: previewAudioDurationSec,
        averageVolume: recording?.averageVolume ?? level,
        peakVolume: recording?.peakVolume ?? level
      }),
    [level, previewAudioDurationSec, recording]
  );
  const previewAudioFeatures = recording?.audioFeatures
    ? { ...recording.audioFeatures, durationSec: previewAudioDurationSec }
    : liveAudioFeatures
      ? { ...liveAudioFeatures, durationSec: previewAudioDurationSec }
      : fallbackFeatures;
  const submitSummary = `${recording ? `${recording.durationSec} 秒语音` : "未录音"} · ${imageDrafts.length} 张图片`;

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

  const hasAudioInputForPreview = Boolean(recording || liveAudioFeatures);
  const previewParams = useMemo(() => {
    const params = generateBalloonParams({
        seed: `${room.id}:preview`,
        audioDurationSec: previewAudioDurationSec,
        averageVolume: previewAudioFeatures.rmsEnergy,
        peakVolume: previewAudioFeatures.peakEnergy,
        transcriptChars: 0,
        extraTextChars: 0,
        imageCount: imageDrafts.length,
        imageBytes,
        selectedHue,
        audioFeatures: previewAudioFeatures
      });
    return hasAudioInputForPreview ? params : { ...params, lightness: 0 };
  }, [hasAudioInputForPreview, imageBytes, imageDrafts.length, previewAudioDurationSec, previewAudioFeatures, room.id, selectedHue]);

  async function startRecording() {
    if (recordingActive) return;

    setError("");
    setMessage("");
    setRecording(null);
    setRecordingPreviewUrl("");
    setLiveAudioFeatures(null);
    liveAudioFeaturesRef.current = null;
    setRecordingElapsedSec(0);
    samplesRef.current = [];
    recordingStartedAtRef.current = nowMs();

    try {
      const stop = await recorderRef.current!.start((frame) => {
        const normalizedLevel = Number(Math.min(1, Math.max(0, frame.level)).toFixed(3));
        setLevel(normalizedLevel);
        if (frame.audioFeatures) {
          liveAudioFeaturesRef.current = frame.audioFeatures;
          setLiveAudioFeatures(frame.audioFeatures);
        }
        samplesRef.current = [...samplesRef.current.slice(-400), normalizedLevel];
      });
      setStopMeter(() => stop);
      setRecordingActive(true);
    } catch (caught) {
      recordingStartedAtRef.current = null;
      setRecordingElapsedSec(0);
      setError(caught instanceof Error ? caught.message : "无法开始录音");
    }
  }

  async function stopRecording() {
    setError("");
    const releaseMicrophone = stopMeter;
    setStopMeter(null);
    setRecordingActive(false);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      releaseMicrophone?.();
    };

    try {
      const blob = await recorderRef.current!.stop();
      release();
      const endedAtMs = nowMs();
      const summary = createRecordingSummary({
        startedAtMs: recordingStartedAtRef.current ?? endedAtMs,
        endedAtMs,
        samples: samplesRef.current
      });
      const decodedFeatures = await analyzeAudio(blob, summary);
      const audioFeatures = resolveFinalAudioFeatures(decodedFeatures, liveAudioFeaturesRef.current, summary);
      const durationSec = audioFeatures.durationSec || summary.durationSec;
      setRecording({
        blob,
        durationSec,
        averageVolume: audioFeatures.rmsEnergy,
        peakVolume: audioFeatures.peakEnergy,
        audioFeatures: { ...audioFeatures, durationSec }
      });
      setRecordingElapsedSec(durationSec);
      setLiveAudioFeatures(null);
      liveAudioFeaturesRef.current = null;
      setLevel(audioFeatures.rmsEnergy || summary.averageVolume || level);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法结束录音");
    } finally {
      release();
      recordingStartedAtRef.current = null;
    }
  }

  function clearRecording() {
    if (recordingActive) return;
    setRecording(null);
    setRecordingPreviewUrl("");
    setLiveAudioFeatures(null);
    liveAudioFeaturesRef.current = null;
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "图片读取失败");
    }
  }

  function removeImageDraft(id: string) {
    setImageDrafts((current) => current.filter((draft) => draft.id !== id));
    setSelectedImageDraft((current) => (current?.id === id ? null : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!recording) {
      setError("请先录制一段语音");
      return;
    }

    const submittedGiverName = giverName.trim();
    if (!anonymous && !submittedGiverName) {
      setError("请填写你的名字");
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
      const audioFeatures = getRecordingFeatures(recording, {
        durationSec: recording.durationSec,
        averageVolume: recording.averageVolume,
        peakVolume: recording.peakVolume
      });

      await gifts.createGift({
        roomId: room.id,
        inviteToken: room.inviteToken,
        giverName: anonymous ? "匿名" : submittedGiverName,
        audioUrl,
        audioDurationSec: audioFeatures.durationSec,
        averageVolume: audioFeatures.rmsEnergy,
        peakVolume: audioFeatures.peakEnergy,
        transcript: "",
        editedTranscript: "",
        extraText: "",
        imageUrls: imageUpload.urls,
        imageBytes: imageUpload.bytes,
        selectedHue,
        audioFeatures
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
      <div className="composer-preview-scene">
        <div className="composer-poster-art" aria-hidden="true">
          <span className="poster-geometry poster-geometry-dot" />
          <span className="poster-geometry poster-geometry-stripes" />
          <span className="poster-star poster-star-rose" />
          <span className="poster-star poster-star-blue" />
          <span className="poster-gift" />
          <span className="poster-hat" />
          <span className="poster-cake" />
        </div>
        <LiveBalloonPreview params={previewParams} level={level} />
      </div>
      <form className="panel form-grid" onSubmit={handleSubmit}>
        <div className="composer-heading">
          <span className="composer-kicker">BALLOON GIFT STUDIO</span>
          <p>{room.promptText || `给 ${room.recipientName} 录一段祝福`}</p>
        </div>

        <section className="composer-note composer-note-audio">
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
        </section>

        <section className="composer-note composer-note-signature">
          <span className="note-label">name</span>
          <label className="anonymous-toggle">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            <span>匿名送出</span>
          </label>
          <label className="giver-name-control">
            <span>你的名字</span>
            <input
              type="text"
              value={giverName}
              maxLength={20}
              disabled={anonymous}
              placeholder={anonymous ? "当前将显示为匿名" : "写下你的名字"}
              onChange={(event) => setGiverName(event.target.value)}
            />
          </label>
        </section>

        <section className="composer-note composer-note-color">
          <span className="note-label">color</span>
          <label className="hue-control">
            <span>气球颜色</span>
            <input
              type="range"
              min="0"
              max="359"
              value={selectedHue}
              onChange={(event) => setSelectedHue(Number(event.target.value))}
              style={{ "--selected-hue": selectedHue } as CSSProperties}
            />
          </label>
        </section>

        <section className="composer-note composer-note-image">
          <span className="note-label">photo</span>
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
        </section>

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

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        <p className="submit-summary">{submitSummary}</p>
        <div className="composer-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "正在送出" : "提交气球"}
          </button>
        </div>
      </form>
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
