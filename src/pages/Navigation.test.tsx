import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { createInMemoryRepositories } from "../data/inMemoryRepositories";
import { RepositoryProvider } from "../data/repositoryProvider";
import { createFakeCanvasContext } from "../test/fakeCanvasContext";

function renderAppAt(path: string, repositories = createInMemoryRepositories()) {
  render(
    <RepositoryProvider repositories={repositories}>
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[path]}
      >
        <App />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createFakeCanvasContext());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("page navigation", () => {
  it("keeps giver and recipient links isolated while organizer management can return home", async () => {
    const repositories = createInMemoryRepositories();
    const room = await repositories.rooms.createRoom({ title: "生日气球", recipientName: "小林", promptText: "" });

    renderAppAt(`/gift/${room.inviteToken}`, repositories);
    expect(await screen.findByRole("button", { name: "开始录音" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "制作气球礼物" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "返回首页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /管理/ })).not.toBeInTheDocument();

    cleanup();
    renderAppAt(`/manage/${room.manageToken}`, repositories);
    expect(await screen.findByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");

    const published = await repositories.rooms.publishRoom(room.manageToken);
    await repositories.gifts.createGift({
      roomId: published.id,
      inviteToken: published.inviteToken,
      giverName: "Alice",
      audioUrl: "audio.webm",
      audioDurationSec: 2,
      averageVolume: 0.4,
      peakVolume: 0.8,
      transcript: "生日快乐",
      editedTranscript: "生日快乐",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    cleanup();
    renderAppAt(`/r/${published.recipientToken}`, repositories);
    expect(await screen.findByLabelText("生日气球 收礼现场")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "退出现场" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "返回首页" })).not.toBeInTheDocument();
  });
});
