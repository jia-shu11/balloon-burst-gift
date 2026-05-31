import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import { createBalloonRenderExclusionIds, RecipientStage } from "./RecipientStage";

const room: GiftRoom = {
  id: "room",
  title: "生日气球场",
  recipientName: "小林",
  promptText: "",
  inviteToken: "invite",
  manageToken: "manage",
  recipientToken: "recipient",
  status: "published",
  createdAt: "2026-05-27T00:00:00.000Z",
  publishedAt: "2026-05-27T00:00:00.000Z"
};

const gift: BalloonGift = {
  id: "gift",
  roomId: "room",
  giverName: "Alice",
  audioUrl: "audio.webm",
  audioDurationSec: 10,
  averageVolume: 0.4,
  peakVolume: 0.8,
  transcript: "生日快乐",
  editedTranscript: "生日快乐",
  extraText: "",
  imageUrls: [],
  imageBytes: 0,
  deletedAt: null,
  createdAt: "2026-05-27T00:00:00.000Z",
  balloonParams: {
    radius: 80,
    stretchX: 1,
    stretchY: 1.1,
    wobble: 0.4,
    glow: 0.7,
    surfaceWaveDensity: 8,
    floatSpeed: 0.3,
    stringLength: 70,
    fragmentCount: 14,
    burstRadius: 200,
    hue: 330
  }
};

const imageGift: BalloonGift = {
  ...gift,
  id: "image-gift",
  imageUrls: ["https://storage.example/gift/photo.jpg"],
  imageBytes: 1200
};

const expiredImageGift: BalloonGift = {
  ...gift,
  id: "expired-image-gift",
  imageUrls: ["blob:http://localhost/expired-photo"],
  imageBytes: 1200
};

const expiredAudioGift: BalloonGift = {
  ...gift,
  id: "expired-audio-gift",
  audioUrl: "blob:http://localhost/expired-audio"
};

const stretchedGift: BalloonGift = {
  ...gift,
  id: "stretched-gift",
  balloonParams: {
    ...gift.balloonParams,
    radius: 100,
    stretchX: 0.82,
    stretchY: 1.32
  }
};

function createFakeCanvasContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fill: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createFakeCanvasContext());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderStage(gifts: BalloonGift[], playAudio = vi.fn()) {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <RecipientStage room={room} gifts={gifts} playAudio={playAudio} />
    </MemoryRouter>
  );
}

function advanceBeforeGiftFragments() {
  act(() => {
    vi.advanceTimersByTime(280);
  });
}

function revealBurstFragments() {
  act(() => {
    vi.advanceTimersByTime(100);
  });
}

function advanceToGiftFragments() {
  advanceBeforeGiftFragments();
  revealBurstFragments();
}

describe("RecipientStage", () => {
  it("excludes bursting balloons from canvas rendering before gift fragments appear", () => {
    const hiddenIds = createBalloonRenderExclusionIds(new Set(["finished"]), new Set(["bursting"]));

    expect(hiddenIds).toEqual(new Set(["finished", "bursting"]));
  });

  it("matches the canvas logical stage to a portrait phone viewport", () => {
    const observerCallbacks: ResizeObserverCallback[] = [];

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          observerCallbacks.push(callback);
        }

        observe() {}

        disconnect() {}
      }
    );

    const { container } = renderStage([gift]);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    act(() => {
      observerCallbacks[0]?.(
        [
          {
            contentRect: { width: 390, height: 780 }
          } as ResizeObserverEntry
        ],
        {} as ResizeObserver
      );
    });

    expect(canvas!.width).toBe(1200);
    expect(canvas!.height).toBe(2400);
  });

  it("renders anonymous balloon count and exposes burst all control", () => {
    renderStage([gift]);

    expect(screen.getByText("1 个匿名气球")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "长按蓄能，全场爆炸" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "退出现场" })).not.toBeInTheDocument();
  });

  it("bursts a balloon and reveals signature fragments after the latex rupture", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    renderStage([gift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    advanceToGiftFragments();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(playAudio).toHaveBeenCalledWith("audio.webm");
  });

  it("renders uploaded image fragments as images instead of URL text", () => {
    vi.useFakeTimers();
    renderStage([imageGift]);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));
    advanceToGiftFragments();

    const image = screen.getByRole("img", { name: "上传的图片" });
    expect(image).toHaveAttribute("src", "https://storage.example/gift/photo.jpg");
    expect(screen.queryByText("https://storage.example/gift/photo.jpg")).not.toBeInTheDocument();
  });

  it("opens uploaded image fragments in a preview instead of playing audio", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    renderStage([imageGift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));
    advanceToGiftFragments();
    fireEvent.click(screen.getByRole("img", { name: "上传的图片" }));

    expect(screen.getByRole("dialog", { name: "查看上传图片" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "放大的上传图片" })).toHaveAttribute(
      "src",
      "https://storage.example/gift/photo.jpg"
    );
    expect(playAudio).toHaveBeenCalledTimes(1);
  });

  it("only plays audio from waveform fragments and lets text fragments pop instead", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    renderStage([gift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));
    expect(playAudio).toHaveBeenCalledTimes(1);
    advanceToGiftFragments();

    const textFragment = screen.getByRole("button", { name: "生日快乐" });
    fireEvent.click(textFragment);

    expect(playAudio).toHaveBeenCalledTimes(1);
    expect(textFragment.style.transform).toContain("scale(1.26)");

    fireEvent.click(screen.getByRole("button", { name: "语音" }));
    expect(playAudio).toHaveBeenCalledTimes(2);
  });

  it("marks expired local blob image fragments instead of rendering a broken image", () => {
    vi.useFakeTimers();
    renderStage([expiredImageGift]);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));
    advanceToGiftFragments();

    expect(screen.getByText("图片已失效，请重新提交")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "上传的图片" })).not.toBeInTheDocument();
  });

  it("marks expired local blob audio fragments instead of pretending they can play", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    renderStage([expiredAudioGift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    expect(playAudio).not.toHaveBeenCalled();
    advanceToGiftFragments();
    expect(screen.getByText("语音已失效，请重新提交")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "语音已失效，请重新提交" }));
    expect(playAudio).not.toHaveBeenCalled();
  });

  it("keeps a visible latex rupture shell before revealing gift fragments", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    const { container } = renderStage([gift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    expect(screen.getByRole("img", { name: "Alice 的气球破裂动画" })).toBeInTheDocument();
    expect(container.querySelector(".rupture-shell")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("爆破匿名气球 1")).not.toBeInTheDocument();
    expect(container.querySelector(".burst-spark")).not.toBeInTheDocument();
    expect(container.querySelector(".rupture-shard")).toBeInTheDocument();

    advanceBeforeGiftFragments();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();

    revealBurstFragments();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Alice 的气球破裂动画" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(280);
    });

    expect(screen.queryByRole("img", { name: "Alice 的气球破裂动画" })).not.toBeInTheDocument();
  });

  it("sizes the rupture shell from the original balloon stretch", () => {
    vi.useFakeTimers();
    renderStage([stretchedGift]);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    const rupture = screen.getByRole("img", { name: "Alice 的气球破裂动画" });
    expect(rupture.style.getPropertyValue("--rupture-stretch-x")).toBe("0.82");
    expect(rupture.style.getPropertyValue("--rupture-stretch-y")).toBe("1.32");
  });

  it("shows a prepared empty state instead of a blank burst scene", () => {
    renderStage([]);

    expect(screen.getByText("礼物还在准备中")).toBeInTheDocument();
    expect(screen.getByText("0 个匿名气球")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "长按蓄能，全场爆炸" })).not.toBeInTheDocument();
  });

  it("requires a long press before bursting every balloon and does not play audio", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    renderStage([gift], playAudio);

    const burstAllButton = screen.getByRole("button", { name: "长按蓄能，全场爆炸" });

    fireEvent.pointerDown(burstAllButton);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(burstAllButton);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();

    fireEvent.pointerDown(burstAllButton);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    advanceToGiftFragments();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(playAudio).not.toHaveBeenCalled();
  });
});
