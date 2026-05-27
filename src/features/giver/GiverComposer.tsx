import { FormEvent, useMemo, useState } from "react";
import { useRepositories } from "../../data/repositoryProvider";
import { generateBalloonParams } from "../../domain/balloonParams";
import type { GiftRoom } from "../../domain/types";
import { LiveBalloonPreview } from "./LiveBalloonPreview";

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

export function GiverComposer({
  room,
  initialRecording = null,
  uploadAudio = async (blob) => URL.createObjectURL(blob),
  uploadImages = async (files) => ({
    urls: files.map((file) => URL.createObjectURL(file)),
    bytes: files.reduce((total, file) => total + file.size, 0)
  }),
  onSubmitted
}: {
  room: GiftRoom;
  initialRecording?: RecordingDraft | null;
  uploadAudio?: (blob: Blob) => Promise<string>;
  uploadImages?: (files: File[]) => Promise<ImageUploadResult>;
  onSubmitted?: () => void;
}) {
  const { gifts } = useRepositories();
  const [giverName, setGiverName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [extraText, setExtraText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [recording] = useState<RecordingDraft | null>(initialRecording);
  const [level] = useState(0.2);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const imageBytes = imageFiles.reduce((total, file) => total + file.size, 0);
  const previewParams = useMemo(
    () =>
      generateBalloonParams({
        seed: `${room.id}:${giverName || "preview"}`,
        audioDurationSec: recording?.durationSec ?? 8,
        averageVolume: recording?.averageVolume ?? level,
        peakVolume: recording?.peakVolume ?? level,
        transcriptChars: transcript.length,
        extraTextChars: extraText.length,
        imageCount: imageFiles.length,
        imageBytes
      }),
    [extraText.length, giverName, imageBytes, imageFiles.length, level, recording, room.id, transcript.length]
  );

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
      const audioUrl = await uploadAudio(recording.blob);
      const imageUpload = await uploadImages(imageFiles);
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
          <button type="button">开始录音</button>
          <span>{recording ? `${recording.durationSec} 秒语音已就绪` : "还没有录音"}</span>
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
