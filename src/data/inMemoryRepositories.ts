import { generateBalloonParams } from "../domain/balloonParams";
import type { BalloonGift, GiftRoom } from "../domain/types";
import type { CreateGiftInput, CreateRoomInput, GiftRepository, RoomRepository } from "./contracts";

function makeToken(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function createInMemoryRepositories(): { rooms: RoomRepository; gifts: GiftRepository } {
  const roomsById = new Map<string, GiftRoom>();
  const giftsById = new Map<string, BalloonGift>();

  const rooms: RoomRepository = {
    async createRoom(input: CreateRoomInput) {
      const room: GiftRoom = {
        id: crypto.randomUUID(),
        title: input.title,
        recipientName: input.recipientName,
        promptText: input.promptText,
        inviteToken: makeToken("invite"),
        manageToken: makeToken("manage"),
        recipientToken: makeToken("recipient"),
        status: "draft",
        createdAt: nowIso(),
        publishedAt: null
      };
      roomsById.set(room.id, room);
      return room;
    },
    async getRoomByInviteToken(inviteToken: string) {
      return [...roomsById.values()].find((room) => room.inviteToken === inviteToken) ?? null;
    },
    async getRoomByManageToken(manageToken: string) {
      return [...roomsById.values()].find((room) => room.manageToken === manageToken) ?? null;
    },
    async getPublishedRoomByRecipientToken(recipientToken: string) {
      return (
        [...roomsById.values()].find(
          (room) => room.recipientToken === recipientToken && room.status === "published"
        ) ?? null
      );
    },
    async publishRoom(manageToken: string) {
      const room = [...roomsById.values()].find((candidate) => candidate.manageToken === manageToken);
      if (!room) throw new Error("管理链接无效");
      const published: GiftRoom = { ...room, status: "published", publishedAt: nowIso() };
      roomsById.set(published.id, published);
      return published;
    }
  };

  const gifts: GiftRepository = {
    async createGift(input: CreateGiftInput) {
      const gift: BalloonGift = {
        id: crypto.randomUUID(),
        ...input,
        balloonParams: generateBalloonParams({
          seed: `${input.roomId}:${input.giverName}:${input.audioUrl}`,
          audioDurationSec: input.audioDurationSec,
          averageVolume: input.averageVolume,
          peakVolume: input.peakVolume,
          transcriptChars: input.editedTranscript.length || input.transcript.length,
          extraTextChars: input.extraText.length,
          imageCount: input.imageUrls.length,
          imageBytes: input.imageBytes
        }),
        deletedAt: null,
        createdAt: nowIso()
      };
      giftsById.set(gift.id, gift);
      return gift;
    },
    async listActiveGifts(roomId: string) {
      return [...giftsById.values()].filter((gift) => gift.roomId === roomId && gift.deletedAt === null);
    },
    async deleteGift(giftId: string) {
      const gift = giftsById.get(giftId);
      if (gift) giftsById.set(giftId, { ...gift, deletedAt: nowIso() });
    }
  };

  return { rooms, gifts };
}
