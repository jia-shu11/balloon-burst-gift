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
