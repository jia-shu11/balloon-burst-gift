import { afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInMemoryRepositories } from "../../data/inMemoryRepositories";
import { RepositoryProvider } from "../../data/repositoryProvider";
import type { GiftRoom } from "../../domain/types";
import { GiverComposer } from "./GiverComposer";

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

  it("requires audio before submission", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(screen.getByText("请先录制一段语音")).toBeInTheDocument();
  });

  it("submits a gift after an audio blob is provided", async () => {
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
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
          onSubmitted={onSubmitted}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
    await user.type(screen.getByLabelText("转写文字"), "生日快乐");
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].giverName).toBe("Alice");
    expect(storedGifts[0].editedTranscript).toBe("生日快乐");
    expect(onSubmitted).toHaveBeenCalledTimes(1);
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
        <GiverComposer
          room={realRoom}
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
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
        <GiverComposer
          room={realRoom}
          initialRecording={{
            blob: new Blob(["audio-bytes"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
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
        <GiverComposer
          room={realRoom}
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
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
        <GiverComposer
          room={room}
          initialRecording={{
            blob: new Blob(["audio-bytes"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
        />
      </RepositoryProvider>
    );

    const audio = await screen.findByLabelText("试听当前录音");
    expect(audio).toHaveAttribute("src", expect.stringMatching(/^data:audio\/webm;base64,/));

    await user.click(screen.getByRole("button", { name: "重新录音" }));
    expect(screen.getByText("还没有录音")).toBeInTheDocument();
    expect(screen.queryByLabelText("试听当前录音")).not.toBeInTheDocument();
  });

  it("summarizes the gift as fragments before submission", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer
          room={room}
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
    await user.type(screen.getByLabelText("转写文字"), "生日快乐");
    await user.type(screen.getByLabelText("附加文字"), "今晚见");
    await user.upload(screen.getByLabelText("图片"), new File(["image-bytes"], "cake.png", { type: "image/png" }));

    const fragments = screen.getByLabelText("礼物碎片预览");
    expect(fragments).toHaveTextContent("语音碎片");
    expect(fragments).toHaveTextContent("转写文字碎片");
    expect(fragments).toHaveTextContent("附加文字碎片");
    expect(fragments).toHaveTextContent("图片碎片 1");
    expect(fragments).toHaveTextContent("署名碎片");
    expect(screen.getByText("12 秒语音 · 4 字转写 · 1 张图片")).toBeInTheDocument();
  });

  it("stores the selected balloon mood in generated recipient-stage parameters", async () => {
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
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
        />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("radio", { name: "秘密" }));
    await user.type(screen.getByLabelText("署名"), "Alice");
    await user.click(screen.getByRole("button", { name: "提交气球" }));

    expect(await screen.findByText("气球已送出")).toBeInTheDocument();
    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts[0].balloonParams.hue).toBeGreaterThanOrEqual(220);
    expect(storedGifts[0].balloonParams.hue).toBeLessThanOrEqual(270);
  });

  it("opens a local burst preview without creating a submitted gift", async () => {
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
          initialRecording={{
            blob: new Blob(["audio"], { type: "audio/webm" }),
            durationSec: 12,
            averageVolume: 0.4,
            peakVolume: 0.8
          }}
          uploadAudio={async () => "https://cdn.example/audio.webm"}
          uploadImages={async () => ({ urls: [], bytes: 0 })}
        />
      </RepositoryProvider>
    );

    await user.type(screen.getByLabelText("署名"), "Alice");
    await user.type(screen.getByLabelText("转写文字"), "生日快乐");
    await user.upload(screen.getByLabelText("图片"), new File(["image-bytes"], "cake.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "试爆预览" }));

    const preview = screen.getByRole("dialog", { name: "制作端试爆预览" });
    expect(preview).toHaveTextContent("生日快乐");
    expect(preview).toHaveTextContent("语音");
    expect(preview).toHaveTextContent("Alice");
    expect(screen.getByRole("img", { name: "试爆图片碎片" })).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/png;base64,/)
    );

    const storedGifts = await repositories.gifts.listActiveGifts({
      roomId: realRoom.id,
      manageToken: realRoom.manageToken
    });
    expect(storedGifts).toEqual([]);
  });

  it("records audio and applies live transcription", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const stopMeter = vi.fn();
    const stopSpeech = vi.fn();
    const recorder = {
      start: vi.fn(async (onLevel: (level: number) => void) => {
        onLevel(0.7);
        return stopMeter;
      }),
      stop: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" }))
    };
    const startTranscription = vi.fn((onTranscript: (result: { source: "speech-recognition"; text: string }) => void) => {
      onTranscript({ source: "speech-recognition", text: "生日快乐" });
      return stopSpeech;
    });
    let currentTimeMs = 1000;
    const nowMs = vi.fn(() => currentTimeMs);

    render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} recorder={recorder} startTranscription={startTranscription} nowMs={nowMs} />
      </RepositoryProvider>
    );

    await user.click(screen.getByRole("button", { name: "开始录音" }));
    expect(screen.getByText("录音中...")).toBeInTheDocument();
    expect(screen.getByDisplayValue("生日快乐")).toBeInTheDocument();

    currentTimeMs = 4100;
    await user.click(screen.getByRole("button", { name: "结束录音" }));

    expect(await screen.findByText("3 秒语音已就绪")).toBeInTheDocument();
    expect(stopMeter).toHaveBeenCalledTimes(1);
    expect(stopSpeech).toHaveBeenCalledTimes(1);
  });

  it("smoothly grows the live preview by half of its base size each recording second", async () => {
    vi.useFakeTimers();
    const repositories = createInMemoryRepositories();
    let currentTimeMs = 1000;
    const recorder = {
      start: vi.fn(async (onLevel: (level: number) => void) => {
        onLevel(0.45);
        return vi.fn();
      }),
      stop: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" }))
    };
    const nowMs = vi.fn(() => currentTimeMs);

    const { container } = render(
      <RepositoryProvider repositories={repositories}>
        <GiverComposer room={room} recorder={recorder} startTranscription={() => null} nowMs={nowMs} />
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
