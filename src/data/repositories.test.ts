import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { BalloonParams } from "../domain/types";
import { createSupabaseGiftRepository } from "./giftRepository";
import { createSupabaseRoomRepository } from "./roomRepository";
import { mapGiftRow, mapRoomRow } from "./supabaseMapping";

const balloonParams: BalloonParams = {
  radius: 88,
  stretchX: 1,
  stretchY: 1.1,
  wobble: 0.5,
  glow: 0.7,
  surfaceWaveDensity: 9,
  floatSpeed: 0.3,
  stringLength: 72,
  fragmentCount: 18,
  burstRadius: 220,
  hue: 330
};

const roomRow = {
  id: "room-1",
  title: "气球礼物",
  recipient_name: "小林",
  prompt_text: "说一句祝福",
  invite_token: "invite_abc",
  manage_token: "manage_abc",
  recipient_token: "recipient_abc",
  status: "draft" as const,
  created_at: "2026-05-27T00:00:00.000Z",
  published_at: null
};

const giftRow = {
  id: "gift-1",
  room_id: "room-1",
  giver_name: "Alice",
  audio_url: "https://cdn/audio.webm",
  audio_duration_sec: 22,
  average_volume: 0.5,
  peak_volume: 0.9,
  transcript: "生日快乐",
  edited_transcript: "生日快乐！",
  extra_text: "天天开心",
  image_urls: ["https://cdn/img.png"],
  image_bytes: 1000,
  balloon_params: balloonParams,
  deleted_at: null,
  created_at: "2026-05-27T00:00:00.000Z"
};

function fakeRpcClient(
  handler: (name: string, args?: Record<string, unknown>) => { data: unknown; error: null | { message: string } }
) {
  return {
    rpc: vi.fn(handler)
  } as unknown as SupabaseClient;
}

describe("supabase mapping", () => {
  it("maps room rows to app room objects", () => {
    expect(mapRoomRow(roomRow)).toMatchObject({
      id: "room-1",
      recipientName: "小林",
      inviteToken: "invite_abc",
      status: "draft"
    });
  });

  it("maps gift rows to app gift objects", () => {
    const gift = mapGiftRow(giftRow);

    expect(gift.roomId).toBe("room-1");
    expect(gift.giverName).toBe("Alice");
    expect(gift.balloonParams.radius).toBe(88);
  });
});

describe("Supabase repositories", () => {
  it("creates rooms through a token-scoped RPC boundary", async () => {
    const client = fakeRpcClient((name, args) => {
      expect(name).toBe("create_gift_room");
      expect(args).toEqual({
        p_title: "气球礼物",
        p_recipient_name: "小林",
        p_prompt_text: "说一句祝福"
      });
      return { data: roomRow, error: null };
    });

    const repository = createSupabaseRoomRepository(client);
    const room = await repository.createRoom({
      title: "气球礼物",
      recipientName: "小林",
      promptText: "说一句祝福"
    });

    expect(room.id).toBe("room-1");
  });

  it("creates gifts through invite-token RPC instead of direct table inserts", async () => {
    const client = fakeRpcClient((name, args) => {
      expect(name).toBe("create_balloon_gift");
      expect(args).toMatchObject({
        p_room_id: "room-1",
        p_invite_token: "invite_abc",
        p_giver_name: "Alice",
        p_audio_url: "https://cdn/audio.webm"
      });
      expect(args?.p_balloon_params).toMatchObject({ radius: expect.any(Number) });
      return { data: giftRow, error: null };
    });

    const repository = createSupabaseGiftRepository(client);
    const gift = await repository.createGift({
      roomId: "room-1",
      inviteToken: "invite_abc",
      giverName: "Alice",
      audioUrl: "https://cdn/audio.webm",
      audioDurationSec: 22,
      averageVolume: 0.5,
      peakVolume: 0.9,
      transcript: "生日快乐",
      editedTranscript: "生日快乐！",
      extraText: "天天开心",
      imageUrls: ["https://cdn/img.png"],
      imageBytes: 1000
    });

    expect(gift.id).toBe("gift-1");
  });

  it("lists gifts through manage or recipient token RPCs", async () => {
    const calls: string[] = [];
    const client = fakeRpcClient((name) => {
      calls.push(name);
      return { data: [giftRow], error: null };
    });

    const repository = createSupabaseGiftRepository(client);
    await repository.listActiveGifts({ roomId: "room-1", manageToken: "manage_abc" });
    await repository.listActiveGifts({ roomId: "room-1", recipientToken: "recipient_abc" });

    expect(calls).toEqual(["list_gifts_for_manage_token", "list_published_gifts_for_recipient_token"]);
  });
});
