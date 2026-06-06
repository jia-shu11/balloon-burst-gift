import { describe, expect, it } from "vitest";
import { createLocalStorageRepositories, type StorageLike } from "./localStorageRepositories";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  failWrites = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("createLocalStorageRepositories", () => {
  it("keeps demo rooms and gifts available after the repository is recreated", async () => {
    const storage = new MemoryStorage();
    const firstRepositories = createLocalStorageRepositories(storage);
    const room = await firstRepositories.rooms.createRoom({
      title: "生日气球场",
      recipientName: "小林",
      promptText: "录一句祝福"
    });
    await firstRepositories.gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Alice",
      audioUrl: "data:audio/webm;base64,YXVkaW8=",
      audioDurationSec: 12,
      averageVolume: 0.45,
      peakVolume: 0.85,
      transcript: "生日快乐",
      editedTranscript: "生日快乐",
      extraText: "永远开心",
      imageUrls: [],
      imageBytes: 0
    });
    await firstRepositories.rooms.publishRoom(room.manageToken);

    const restoredRepositories = createLocalStorageRepositories(storage);

    expect(await restoredRepositories.rooms.getRoomByInviteToken(room.inviteToken)).toMatchObject({
      id: room.id,
      title: "生日气球场"
    });
    expect(await restoredRepositories.rooms.getRoomByManageToken(room.manageToken)).toMatchObject({ id: room.id });
    expect(await restoredRepositories.rooms.getPublishedRoomByRecipientToken(room.recipientToken)).toMatchObject({
      id: room.id,
      status: "published"
    });
    await expect(
      restoredRepositories.gifts.listActiveGifts({ roomId: room.id, recipientToken: room.recipientToken })
    ).resolves.toMatchObject([
      {
        giverName: "Alice",
        transcript: "生日快乐",
        audioUrl: "data:audio/webm;base64,YXVkaW8="
      }
    ]);
  });

  it("reports local storage quota failures instead of silently losing recorded audio", async () => {
    const storage = new MemoryStorage();
    const repositories = createLocalStorageRepositories(storage);
    storage.failWrites = true;

    await expect(
      repositories.rooms.createRoom({
        title: "生日气球场",
        recipientName: "小林",
        promptText: "录一句祝福"
      })
    ).rejects.toThrow("本地存储空间不足");
  });

  it("does not leave a phantom gift in memory when recorded audio cannot be persisted", async () => {
    const storage = new MemoryStorage();
    const repositories = createLocalStorageRepositories(storage);
    const room = await repositories.rooms.createRoom({
      title: "生日气球场",
      recipientName: "小林",
      promptText: "录一句祝福"
    });
    storage.failWrites = true;

    await expect(
      repositories.gifts.createGift({
        roomId: room.id,
        inviteToken: room.inviteToken,
        giverName: "Alice",
        audioUrl: "data:audio/webm;base64,YXVkaW8=",
        audioDurationSec: 12,
        averageVolume: 0.45,
        peakVolume: 0.85,
        transcript: "",
        editedTranscript: "",
        extraText: "",
        imageUrls: [],
        imageBytes: 0
      })
    ).rejects.toThrow("本地存储空间不足");

    storage.failWrites = false;
    await expect(repositories.gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken })).resolves.toEqual([]);
  });
});
