import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "./inMemoryRepositories";

describe("in-memory repositories", () => {
  it("creates a room with separate invite, manage, and recipient tokens", async () => {
    const { rooms } = createInMemoryRepositories();
    const room = await rooms.createRoom({
      title: "生日气球爆破场",
      recipientName: "小林",
      promptText: "说一句你最想说的话"
    });

    expect(room.status).toBe("draft");
    expect(room.inviteToken).not.toEqual(room.manageToken);
    expect(room.inviteToken).not.toEqual(room.recipientToken);
    expect(room.recipientToken).not.toEqual(room.manageToken);
  });

  it("stores gifts as anonymous room entries until loaded by recipient", async () => {
    const { rooms, gifts } = createInMemoryRepositories();
    const room = await rooms.createRoom({
      title: "Test Room",
      recipientName: "Recipient",
      promptText: ""
    });

    await gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Alice",
      audioUrl: "https://cdn.example/audio.webm",
      audioDurationSec: 20,
      averageVolume: 0.5,
      peakVolume: 0.8,
      transcript: "生日快乐",
      editedTranscript: "生日快乐",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    await expect(gifts.listActiveGifts({ roomId: room.id, recipientToken: room.recipientToken })).rejects.toThrow(
      "链接无效或房间尚未发布"
    );

    const list = await gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken });
    expect(list).toHaveLength(1);
    expect(list[0].giverName).toBe("Alice");
  });

  it("publishes a room and filters deleted gifts", async () => {
    const { rooms, gifts } = createInMemoryRepositories();
    const room = await rooms.createRoom({ title: "Room", recipientName: "R", promptText: "" });
    const gift = await gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Bob",
      audioUrl: "https://cdn.example/bob.webm",
      audioDurationSec: 15,
      averageVolume: 0.3,
      peakVolume: 0.6,
      transcript: "祝你开心",
      editedTranscript: "祝你开心",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    await gifts.deleteGift({ giftId: gift.id, manageToken: room.manageToken });
    const published = await rooms.publishRoom(room.manageToken);
    const active = await gifts.listActiveGifts({ roomId: room.id, recipientToken: room.recipientToken });

    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
    expect(active).toHaveLength(0);
  });

  it("rejects gift deletion without the room manage token", async () => {
    const { rooms, gifts } = createInMemoryRepositories();
    const room = await rooms.createRoom({ title: "Room", recipientName: "R", promptText: "" });
    const gift = await gifts.createGift({
      roomId: room.id,
      inviteToken: room.inviteToken,
      giverName: "Bob",
      audioUrl: "https://cdn.example/bob.webm",
      audioDurationSec: 15,
      averageVolume: 0.3,
      peakVolume: 0.6,
      transcript: "祝你开心",
      editedTranscript: "祝你开心",
      extraText: "",
      imageUrls: [],
      imageBytes: 0
    });

    await expect(gifts.deleteGift({ giftId: gift.id, manageToken: "wrong-token" })).rejects.toThrow("管理链接无效");
    await expect(gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken })).resolves.toHaveLength(1);
  });

  it("rejects gift creation without the room invite token", async () => {
    const { rooms, gifts } = createInMemoryRepositories();
    const room = await rooms.createRoom({ title: "Room", recipientName: "R", promptText: "" });

    await expect(
      gifts.createGift({
        roomId: room.id,
        inviteToken: "wrong-token",
        giverName: "Alice",
        audioUrl: "https://cdn.example/audio.webm",
        audioDurationSec: 20,
        averageVolume: 0.5,
        peakVolume: 0.8,
        transcript: "生日快乐",
        editedTranscript: "生日快乐",
        extraText: "",
        imageUrls: [],
        imageBytes: 0
      })
    ).rejects.toThrow("邀请链接无效");
  });

  it("rejects gift creation for a missing room", async () => {
    const { gifts } = createInMemoryRepositories();

    await expect(
      gifts.createGift({
        roomId: "missing-room",
        inviteToken: "invite_missing",
        giverName: "Alice",
        audioUrl: "https://cdn.example/audio.webm",
        audioDurationSec: 20,
        averageVolume: 0.5,
        peakVolume: 0.8,
        transcript: "生日快乐",
        editedTranscript: "生日快乐",
        extraText: "",
        imageUrls: [],
        imageBytes: 0
      })
    ).rejects.toThrow("房间不存在");
  });
});
