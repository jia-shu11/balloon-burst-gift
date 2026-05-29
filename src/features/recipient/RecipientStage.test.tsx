import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import { RecipientStage } from "./RecipientStage";

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
});

function renderStage(gifts: BalloonGift[], playAudio = vi.fn()) {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <RecipientStage room={room} gifts={gifts} playAudio={playAudio} />
    </MemoryRouter>
  );
}

describe("RecipientStage", () => {
  it("renders anonymous balloon count and exposes burst all control", () => {
    renderStage([gift]);

    expect(screen.getByText("1 个匿名气球")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "长按蓄能，全场爆炸" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "退出现场" })).not.toBeInTheDocument();
  });

  it("bursts a balloon and reveals signature fragments", () => {
    const playAudio = vi.fn();
    renderStage([gift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(playAudio).toHaveBeenCalledWith("audio.webm");
  });

  it("bursts immediately with a restrained latex rupture effect", () => {
    vi.useFakeTimers();
    const playAudio = vi.fn();
    const { container } = renderStage([gift], playAudio);

    fireEvent.click(screen.getByLabelText("爆破匿名气球 1"));

    expect(screen.getByRole("img", { name: "Alice 的气球破裂动画" })).toBeInTheDocument();
    expect(screen.queryByLabelText("爆破匿名气球 1")).not.toBeInTheDocument();
    expect(container.querySelector(".burst-spark")).not.toBeInTheDocument();
    expect(container.querySelector(".rupture-shard")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(screen.queryByRole("img", { name: "Alice 的气球破裂动画" })).not.toBeInTheDocument();
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

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(playAudio).not.toHaveBeenCalled();
  });
});
