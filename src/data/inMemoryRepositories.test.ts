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

    const list = await gifts.listActiveGifts(room.id);
    expect(list).toHaveLength(1);
    expect(list[0].giverName).toBe("Alice");
  });

  it("publishes a room and filters deleted gifts", async () => {
    const { rooms, gifts } = createInMemoryRepositories();
    const room = await rooms.createRoom({ title: "Room", recipientName: "R", promptText: "" });
    const gift = await gifts.createGift({
      roomId: room.id,
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

    await gifts.deleteGift(gift.id);
    const published = await rooms.publishRoom(room.manageToken);
    const active = await gifts.listActiveGifts(room.id);

    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
    expect(active).toHaveLength(0);
  });
});
