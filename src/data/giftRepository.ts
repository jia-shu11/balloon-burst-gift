import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBalloonParams } from "../domain/balloonParams";
import type { BalloonGift } from "../domain/types";
import type { CreateGiftInput, GiftRepository } from "./contracts";
import { mapGiftRow, type GiftRow } from "./supabaseMapping";

type RpcError = { message: string };
type RpcResponse<T> = { data: T | T[] | null; error: RpcError | null };

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function callGiftRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: true
): Promise<BalloonGift>;
async function callGiftRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: false
): Promise<BalloonGift | null>;
async function callGiftRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: boolean
): Promise<BalloonGift | null> {
  const { data, error } = (await client.rpc(name, args)) as RpcResponse<GiftRow>;
  if (error) {
    if (!required) return null;
    throw new Error(error.message);
  }
  const row = firstRow(data);
  if (!row) {
    if (!required) return null;
    throw new Error("气球礼物不存在");
  }
  return mapGiftRow(row);
}

async function callGiftListRpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = (await client.rpc(name, args)) as RpcResponse<GiftRow>;
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map(mapGiftRow);
}

export function createSupabaseGiftRepository(client: SupabaseClient): GiftRepository {
  return {
    async createGift(input: CreateGiftInput): Promise<BalloonGift> {
      const seed = `${input.roomId}:${input.giverName}:${input.audioUrl}`;
      const balloonParams = generateBalloonParams({
        seed: input.balloonMood ? `${seed}:${input.balloonMood}` : seed,
        mood: input.balloonMood,
        audioDurationSec: input.audioDurationSec,
        averageVolume: input.averageVolume,
        peakVolume: input.peakVolume,
        transcriptChars: input.editedTranscript.length || input.transcript.length,
        extraTextChars: input.extraText.length,
        imageCount: input.imageUrls.length,
        imageBytes: input.imageBytes
      });

      const gift = await callGiftRpc(
        client,
        "create_balloon_gift",
        {
          p_room_id: input.roomId,
          p_invite_token: input.inviteToken,
          p_giver_name: input.giverName,
          p_audio_url: input.audioUrl,
          p_audio_duration_sec: input.audioDurationSec,
          p_average_volume: input.averageVolume,
          p_peak_volume: input.peakVolume,
          p_transcript: input.transcript,
          p_edited_transcript: input.editedTranscript,
          p_extra_text: input.extraText,
          p_image_urls: input.imageUrls,
          p_image_bytes: input.imageBytes,
          p_balloon_params: balloonParams
        },
        true
      );
      return gift;
    },
    async listActiveGifts(input: { roomId: string; manageToken?: string; recipientToken?: string }) {
      if (input.manageToken) {
        return callGiftListRpc(client, "list_gifts_for_manage_token", {
          p_room_id: input.roomId,
          p_manage_token: input.manageToken
        });
      }
      if (input.recipientToken) {
        return callGiftListRpc(client, "list_published_gifts_for_recipient_token", {
          p_room_id: input.roomId,
          p_recipient_token: input.recipientToken
        });
      }
      throw new Error("链接无效或房间尚未发布");
    },
    async deleteGift(input: { giftId: string; manageToken: string }) {
      const { error } = (await client.rpc("delete_balloon_gift", {
        p_gift_id: input.giftId,
        p_manage_token: input.manageToken
      })) as { error: RpcError | null };

      if (error) throw new Error(error.message);
    }
  };
}
