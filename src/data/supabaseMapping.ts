import type { BalloonGift, BalloonParams, GiftRoom, RoomStatus } from "../domain/types";

export interface RoomRow {
  id: string;
  title: string;
  recipient_name: string;
  prompt_text: string;
  invite_token: string;
  manage_token: string;
  recipient_token: string;
  status: RoomStatus;
  created_at: string;
  published_at: string | null;
}

export interface GiftRow {
  id: string;
  room_id: string;
  giver_name: string;
  audio_url: string;
  audio_duration_sec: number;
  average_volume: number;
  peak_volume: number;
  transcript: string;
  edited_transcript: string;
  extra_text: string;
  image_urls: string[];
  image_bytes: number;
  balloon_params: BalloonParams;
  deleted_at: string | null;
  created_at: string;
}

export function mapRoomRow(row: RoomRow): GiftRoom {
  return {
    id: row.id,
    title: row.title,
    recipientName: row.recipient_name,
    promptText: row.prompt_text,
    inviteToken: row.invite_token,
    manageToken: row.manage_token,
    recipientToken: row.recipient_token,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

export function mapGiftRow(row: GiftRow): BalloonGift {
  return {
    id: row.id,
    roomId: row.room_id,
    giverName: row.giver_name,
    audioUrl: row.audio_url,
    audioDurationSec: row.audio_duration_sec,
    averageVolume: row.average_volume,
    peakVolume: row.peak_volume,
    transcript: row.transcript,
    editedTranscript: row.edited_transcript,
    extraText: row.extra_text,
    imageUrls: row.image_urls,
    imageBytes: row.image_bytes,
    balloonParams: row.balloon_params,
    deletedAt: row.deleted_at,
    createdAt: row.created_at
  };
}
