import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../../data/inMemoryRepositories";
import { RepositoryProvider } from "../../data/repositoryProvider";
import { ManageRoom } from "./ManageRoom";

afterEach(() => {
  cleanup();
});

describe("ManageRoom", () => {
  it("disables publishing until at least one active balloon exists", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const room = await repositories.rooms.createRoom({ title: "生日气球", recipientName: "小林", promptText: "" });

    render(
      <RepositoryProvider repositories={repositories}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ManageRoom room={room} />
        </MemoryRouter>
      </RepositoryProvider>
    );

    expect(await screen.findByText("当前没有有效气球")).toBeInTheDocument();
    expect(screen.getByText("至少收到一个气球后再发布收礼链接。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布收礼链接" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "发布收礼链接" }));
    expect(screen.queryByText(/\/r\/recipient_/)).not.toBeInTheDocument();
  });

  it("lists submitted gifts and blocks publishing again after deleting the last balloon", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const room = await repositories.rooms.createRoom({ title: "生日气球", recipientName: "小林", promptText: "" });
    await repositories.gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Alice",
      audioUrl: "https://cdn.example/audio.webm",
      audioDurationSec: 10,
      averageVolume: 0.4,
      peakVolume: 0.8,
      transcript: "生日快乐",
      editedTranscript: "生日快乐",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ManageRoom room={room} />
        </MemoryRouter>
      </RepositoryProvider>
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除 Alice 的气球" }));
    expect(await screen.findByText("当前没有有效气球")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布收礼链接" })).toBeDisabled();
  });

  it("shows extracted audio data and visual mapping data for each balloon", async () => {
    const repositories = createInMemoryRepositories();
    const room = await repositories.rooms.createRoom({ title: "声音映射房间", recipientName: "小林", promptText: "" });
    await repositories.gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "匿名",
      audioUrl: "https://cdn.example/audio.webm",
      audioDurationSec: 6,
      averageVolume: 0.32,
      peakVolume: 0.9,
      transcript: "",
      editedTranscript: "",
      extraText: "",
      imageUrls: [],
      imageBytes: 0,
      selectedHue: 210,
      audioFeatures: {
        durationSec: 6,
        spectralCentroid: 1800,
        rmsEnergy: 0.32,
        peakEnergy: 0.9,
        speechRate: 3.2,
        melBands: [0.1, 0.1, 0.2, 0.2, 0.8, 0.9, 1, 1],
        voiceSignature: {
          durationSec: 6,
          energyEnvelope: Array.from({ length: 32 }, (_, index) => index / 31),
          waveformContour: Array.from({ length: 48 }, (_, index) => Math.sin(index / 4) * 0.7),
          melTexture: [0.1, 0.1, 0.2, 0.2, 0.8, 0.9, 1, 1],
          pausePattern: [
            { position: 0.25, strength: 0.8 },
            { position: 0.68, strength: 0.5 }
          ],
          rhythmDensity: 3.2,
          pitchAccent: 1800,
          dynamicRange: 0.58
        }
      }
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ManageRoom room={room} />
        </MemoryRouter>
      </RepositoryProvider>
    );

    const table = await screen.findByRole("table", { name: "匿名 的声频数据分析" });
    expect(table).toHaveTextContent("频率中心");
    expect(table).toHaveTextContent("1800 Hz");
    expect(table).toHaveTextContent("明度 82.0%");
    expect(table).toHaveTextContent("能量");
    expect(table).toHaveTextContent("发光 1.00");
    expect(table).toHaveTextContent("Mel 高频占比");
    expect(table).toHaveTextContent("尖角");
    expect(table).toHaveTextContent("声纹轮廓");
    expect(table).toHaveTextContent("48 点");
    expect(table).toHaveTextContent("能量包络");
    expect(table).toHaveTextContent("32 帧");
    expect(table).toHaveTextContent("节奏密度");
    expect(table).toHaveTextContent("3.20 峰/秒");
    expect(table).toHaveTextContent("停顿模式");
    expect(table).toHaveTextContent("2 段");
    expect(table).toHaveTextContent("动态范围");
    expect(table).toHaveTextContent("0.58");
    expect(table).toHaveTextContent("色相");
    expect(table).toHaveTextContent("210°");
  });

  it("publishes the recipient link when the room has active balloons", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();
    const room = await repositories.rooms.createRoom({ title: "生日气球", recipientName: "小林", promptText: "" });
    await repositories.gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Alice",
      audioUrl: "https://cdn.example/audio.webm",
      audioDurationSec: 10,
      averageVolume: 0.4,
      peakVolume: 0.8,
      transcript: "生日快乐",
      editedTranscript: "生日快乐",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    render(
      <RepositoryProvider repositories={repositories}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ManageRoom room={room} />
        </MemoryRouter>
      </RepositoryProvider>
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发布收礼链接" }));
    expect(await screen.findByText(/\/r\/recipient_/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/r\/recipient_/ })).toBeInTheDocument();
  });
});
