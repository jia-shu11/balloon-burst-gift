import type { BalloonGift, GiftRoom } from "../domain/types";

export interface CreateRoomInput {
  title: string;
  recipientName: string;
  promptText: string;
}

export interface CreateGiftInput {
  roomId: string;
  inviteToken: string;
  giverName: string;
  audioUrl: string;
  audioDurationSec: number;
  averageVolume: number;
  peakVolume: number;
  transcript: string;
  editedTranscript: string;
  extraText: string;
  imageUrls: string[];
  imageBytes: number;
}

export interface RoomRepository {
  createRoom(input: CreateRoomInput): Promise<GiftRoom>;
  getRoomByInviteToken(inviteToken: string): Promise<GiftRoom | null>;
  getRoomByManageToken(manageToken: string): Promise<GiftRoom | null>;
  getPublishedRoomByRecipientToken(recipientToken: string): Promise<GiftRoom | null>;
  publishRoom(manageToken: string): Promise<GiftRoom>;
}

export interface GiftRepository {
  createGift(input: CreateGiftInput): Promise<BalloonGift>;
  listActiveGifts(input: { roomId: string; manageToken?: string; recipientToken?: string }): Promise<BalloonGift[]>;
  deleteGift(input: { giftId: string; manageToken: string }): Promise<void>;
}
