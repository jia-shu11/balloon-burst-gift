import { afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "../../data/inMemoryRepositories";
import { RepositoryProvider } from "../../data/repositoryProvider";
import type { AudioFeatureSummary, GiftRoom, VoiceGiftSignature } from "../../domain/types";
import { createFallbackAudioFeatures } from "./audioFeatures";
import { GiverComposer, shouldUseSupabaseStorage, type RecordingDraft } from "./GiverComposer";

const room: GiftRoom = {
  id: "room-1",
  title: "小林的气球祝福场",
  recipientName: "小林",
  promptText: "说一句你想留下的祝福",
  inviteToken: "invite_abc",
  manageToken: "manage_abc",
  recipientToken: "recipient_abc",
  status: "draft",
  createdAt: "2026-05-27T00:00:00.000Z",
  publishedAt: null
};

const audioFeatures: AudioFeatureSummary = {
  durationSec: 12,
  spectralCentroid: 1800,
  rmsEnergy: 0.32,
  peakEnergy: 0.8,
  speechRate: 2.4,
  melBands: [0.1, 0.14, 0.18, 0.22, 0.3, 0.38, 0.42, 0.5]
};

const voiceSignature: VoiceGiftSignature = {
  durationSec: 12,
  energyEnvelope: Array.from({ length: 32 }, (_, index) => Number((index / 31).toFixed(3))),
  waveformContour: Array.from({ length: 48 }, (_, index) => Number(Math.sin(index / 3).toFixed(3))),
  melTexture: [0.1, 0.14, 0.18, 0.22, 0.3, 0.38, 0.42, 0.5],
  pausePattern: [{ position: 0.5, strength: 0.6 }],
  rhythmDensity: 3.2,
  pitchAccent: 1800,
  dynamicRange: 0.52
};

const initialRecording: RecordingDraft = {
  blob: new Blob(["audio"], { type: "audio/webm" }),
  durationSec: audioFeatures.durationSec,
  averageVolume: audioFeatures.rmsEnergy,
  peakVolume: audioFeatures.peakEnergy,
  audioFeatures: { ...audioFeatures, voiceSignature }
};

describe("shouldUseSupabaseStorage", () => {
  it("uses cloud media storage when production defaults to Supabase", () => {
    expect(shouldUseSupabaseStorage({ PROD: true })).toBe(true);
    expect(shouldUseSupabaseStorage({ PROD: false })).toBe(false);
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GiverComposer", () => {
  function getPreviewBalloon(container: HTMLElement) {
    const balloon = container.querySelector<HTMLElement>(".live-balloon");
    if (!balloon) throw new Error("Live balloon preview was not rendered");
    return balloon;
  }

  it("starts with zero lightness before any audio frame is available", () => {
    const repositories = createInMemoryRepositories();

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} />
      </RepositoryProvider>
    );

    expect(getPreviewBalloon(container)).toHaveStyle({ "--balloon-lightness": "0%" });
  });

  it("keeps the composer focused on recording, hue, and image upload", () => {
    const repositories = createInMemoryRepositories();

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} />
      </RepositoryProvider>
    );

    expect(screen.queryByText(room.title)).not.toBeInTheDocument();
    expect(screen.queryByText(/voice/i)).not.toBeInTheDocument();
    expect(container.querySelector(".poster-word")).toBeNull();
    expect(container.querySelector(".poster-year")).toBeNull();
    expect(container.querySelector(".poster-number")).toBeNull();
    expect(container.querySelector(".poster-geometry-dot")).toBeTruthy();
    expect(container.querySelector(".poster-geometry-stripes")).toBeTruthy();
    expect(container.querySelector(".composer-preview-scene")).toBeTruthy();
    expect(container.querySelector(".composer-page-art")).toBeNull();
    expect(container.querySelector(".live-balloon-wrap")?.closest(".composer-preview-scene")).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始录音" })).toBeInTheDocument();
    expect(screen.getByLabelText("气球颜色")).toBeInTheDocument();
    expect(screen.getByLabelText("图片")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "匿名送出" })).toBeChecked();
    expect(screen.getByLabelText("你的名字")).toBeDisabled();
    expect(screen.queryByText("气球气质")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("转写文字")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("附加文字")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("礼物碎片预览")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "试爆预览" })).not.toBeInTheDocument();
  });

  it("requires audio before submission", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(screen.getByText("请先录制一段语音")).toBeInTheDocument();
  });

  it("requires a name when anonymous delivery is turned off", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} initialRecording={initialRecording} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("checkbox", { name: "匿名送出" }));
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(screen.getByText("请填写你的名字")).toBeInTheDocument();
  });

  it("submits the entered giver name when anonymous delivery is turned off", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer
          room={realRoom}
          initialRecording={initialRecording}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
        />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("checkbox", { name: "匿名送出" }));
    await user.type(screen.getByLabelText("你的名字"), "小周");
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].giverName).toBe("小周");
  });

  it("submits an anonymous audio gift with the selected hue and extracted audio features", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });
    const onSubmitted = vi.fn();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer
          room={realRoom}
          initialRecording={initialRecording}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
          onSubmitted={onSubmitted}
        />
      </RepositoryProvider>
    );

    fireEvent.change(screen.getByLabelText("气球颜色"), { target: { value: "210" } });
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].giverName).toBe("匿名");
    expect(storedGifts[0].editedTranscript).toBe("");
    expect(storedGifts[0].extraText).toBe("");
    expect(storedGifts[0].balloonParams.hue).toBe(210);
    expect(storedGifts[0].balloonParams.audioFeatures.spectralCentroid).toBe(1800);
    expect(storedGifts[0].balloonParams.voiceSignature.waveformContour).toEqual(voiceSignature.waveformContour);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("changes hue without regenerating the preview balloon geometry", () => {
    const repositories = createInMemoryRepositories();

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} initialRecording={initialRecording} />
      </RepositoryProvider>
    );

    const balloon = getPreviewBalloon(container);
    const initialWidth = balloon.style.width;
    const initialHeight = balloon.style.height;
    const initialStringHeight = container.querySelector<HTMLElement>(".live-balloon-string")?.style.height;

    fireEvent.change(screen.getByLabelText("气球颜色"), { target: { value: "280" } });

    expect(balloon.style.width).toBe(initialWidth);
    expect(balloon.style.height).toBe(initialHeight);
    expect(container.querySelector<HTMLElement>(".live-balloon-string")?.style.height).toBe(initialStringHeight);
    expect(balloon.style.filter).toContain("hsl(280");
  });

  it("stores local uploaded images as persistent data urls", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={realRoom} initialRecording={initialRecording} uploadAudio={async () => "https://cdn.example/audio.webm"} />
      </RepositoryProvider>
    );

    await user.upload(screen.getByLabelText("图片"), new File(["image-bytes"], "photo.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].imageUrls).toEqual([expect.stringMatching(/^data:image\/png;base64,/)]);
  });

  it("stores local recorded audio as a persistent data url", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={realRoom} initialRecording={initialRecording} uploadImages={async () => ({ urls: [], bytes: 0 })} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].audioUrl).toEqual(expect.stringMatching(/^data:audio\/webm;base64,/));
  });

  it("shows uploaded image thumbnails that can be previewed and removed before submitting", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={realRoom} initialRecording={initialRecording} uploadAudio={async () => "https://cdn.example/audio.webm"} />
      </RepositoryProvider>
    );

    await user.upload(screen.getByLabelText("图片"), new File(["image-bytes"], "photo.png", { type: "image/png" }));

    const thumbnail = await screen.findByRole("img", { name: "预览图片 photo.png" });
    expect(thumbnail).toHaveAttribute("src", expect.stringMatching(/^data:image\/png;base64,/));

    await user.click(thumbnail);
    expect(screen.getByRole("dialog", { name: "查看图片 photo.png" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭图片预览" }));

    await user.click(screen.getByRole("button", { name: "移除图片 photo.png" }));
    expect(screen.queryByRole("img", { name: "预览图片 photo.png" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交气球" }));
    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].imageUrls).toEqual([]);
  });

  it("lets the giver preview and discard the current recording", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} initialRecording={initialRecording} />
      </RepositoryProvider>
    );

    const audio = await screen.findByLabelText("试听当前录音");
    expect(audio).toHaveAttribute("src", expect.stringMatching(/^data:audio\/webm;base64,/));

    await user.click(screen.getByRole("button", { name: "重新录音" }));
    expect(screen.getByText("还没有录音")).toBeInTheDocument();
    expect(screen.queryByLabelText("试听当前录音")).not.toBeInTheDocument();
  });

  it("records audio and analyzes the stopped blob for visual mapping", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const stopOrder: string[] = [];
    const stopMeter = vi.fn(() => stopOrder.push("release microphone"));
    const recorder = {
      start: vi.fn(async (onFrame: (frame: { level: number }) => void) => {
        onFrame({ level: 0.7 });
        return stopMeter;
      }),
      stop: vi.fn(async () => {
        stopOrder.push("finish media recorder");
        return new Blob(["audio"], { type: "audio/webm" });
      })
    };
    const analyzeAudio = vi.fn(async () => ({ ...audioFeatures, durationSec: 3 }));
    let currentTimeMs = 1000;
    const nowMs = vi.fn(() => currentTimeMs);

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} recorder={recorder} analyzeAudio={analyzeAudio} nowMs={nowMs} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "开始录音" }));
    expect(screen.getByText("录音中...")).toBeInTheDocument();

    currentTimeMs = 4100;
    await user.click(screen.getByRole("button", { name: "结束录音" }));

    expect(await screen.findByText("3 秒语音已就绪")).toBeInTheDocument();
    expect(stopMeter).toHaveBeenCalledTimes(1);
    expect(stopOrder).toEqual(["finish media recorder", "release microphone"]);
    expect(analyzeAudio).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ durationSec: 3 }));
  });

  it("keeps realtime audio features when the stopped blob falls back to default analysis", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const realRoom = await repositories.rooms.createRoom({
      title: room.title,
      recipientName: room.recipientName,
      promptText: room.promptText
    });
    const liveFeatures: AudioFeatureSummary = {
      durationSec: 1.2,
      spectralCentroid: 3300,
      rmsEnergy: 0.2,
      peakEnergy: 0.9,
      speechRate: 4.8,
      melBands: [0.1, 0.1, 0.1, 0.1, 1, 1, 1, 1]
    };
    const stopMeter = vi.fn();
    const recorder = {
      start: vi.fn(async (onFrame: (frame: { level: number; audioFeatures: AudioFeatureSummary }) => void) => {
        onFrame({ level: 0.8, audioFeatures: liveFeatures });
        return stopMeter;
      }),
      stop: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" }))
    };
    const analyzeAudio = vi.fn(async () =>
      createFallbackAudioFeatures({
        durationSec: 3,
        averageVolume: 0.4,
        peakVolume: 0.8
      })
    );
    let currentTimeMs = 1000;
    const nowMs = vi.fn(() => currentTimeMs);

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer
          room={realRoom}
          recorder={recorder}
          analyzeAudio={analyzeAudio}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
          nowMs={nowMs}
        />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "开始录音" }));
    currentTimeMs = 4000;
    await user.click(screen.getByRole("button", { name: "结束录音" }));
    await user.click(await screen.findByRole("button", { name: "提交气球" }));

    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].balloonParams.audioFeatures.spectralCentroid).toBe(3300);
    expect(storedGifts[0].balloonParams.audioFeatures.melBands).toEqual(liveFeatures.melBands);
    expect(storedGifts[0].balloonParams.lightness).toBe(82);
    expect(storedGifts[0].balloonParams.spikeCount).toBeGreaterThan(20);
  });

  it("uses realtime audio features to drive the preview while recording", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const liveFeatures: AudioFeatureSummary = {
      durationSec: 0.08,
      spectralCentroid: 4080,
      rmsEnergy: 0.35,
      peakEnergy: 0.9,
      speechRate: 6,
      melBands: [0.1, 0.1, 0.1, 0.1, 1, 1, 1, 1]
    };
    const recorder = {
      start: vi.fn(async (onFrame: (frame: { level: number; audioFeatures?: AudioFeatureSummary }) => void) => {
        onFrame({ level: 0.8, audioFeatures: liveFeatures });
        return vi.fn();
      }),
      stop: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" }))
    };

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} recorder={recorder} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "开始录音" }));

    const balloon = getPreviewBalloon(container);
    expect(balloon).toHaveStyle({ "--balloon-lightness": "82%" });
    expect(balloon.style.filter).toContain("82%");
    expect(balloon.style.clipPath).toBe("");
    expect(balloon.querySelector(".live-balloon-body")?.getAttribute("d")).toContain(" C ");
  });

  it("smoothly grows the live preview by half of its base size each recording second", async () => {
    vi.useFakeTimers();
    const repositories = createInMemoryRepositories();
    let currentTimeMs = 1000;
    const recorder = {
      start: vi.fn(async (onFrame: (frame: { level: number }) => void) => {
        onFrame({ level: 0.45 });
        return vi.fn();
      }),
      stop: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" }))
    };
    const nowMs = vi.fn(() => currentTimeMs);

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} recorder={recorder} nowMs={nowMs} />
      </RepositoryProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始录音" }));
    });
    expect(screen.getByText("录音中...")).toBeInTheDocument();
    const initialWidth = Number.parseFloat(getPreviewBalloon(container).style.width);

    currentTimeMs += 1000;
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const oneSecondWidth = Number.parseFloat(getPreviewBalloon(container).style.width);

    currentTimeMs += 1000;
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const grownWidth = Number.parseFloat(getPreviewBalloon(container).style.width);
    expect(oneSecondWidth).toBeGreaterThan(initialWidth * 1.45);
    expect(oneSecondWidth).toBeLessThan(initialWidth * 1.55);
    expect(grownWidth).toBeGreaterThan(initialWidth);
  });
});
