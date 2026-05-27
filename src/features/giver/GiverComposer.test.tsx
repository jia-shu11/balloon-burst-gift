import { afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
});

describe("GiverComposer", () => {
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
});
