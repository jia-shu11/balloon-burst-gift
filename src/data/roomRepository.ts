import type { SupabaseClient } from "@supabase/supabase-js";
import type { GiftRoom } from "../domain/types";
import type { CreateRoomInput, RoomRepository } from "./contracts";
import { mapRoomRow, type RoomRow } from "./supabaseMapping";

type RpcError = { message: string };
type RpcResponse<T> = { data: T | T[] | null; error: RpcError | null };

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function callRoomRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: true
): Promise<GiftRoom>;
async function callRoomRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: false
): Promise<GiftRoom | null>;
async function callRoomRpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  required: boolean
): Promise<GiftRoom | null> {
  const { data, error } = (await client.rpc(name, args)) as RpcResponse<RoomRow>;
  if (error) {
    if (!required) return null;
    throw new Error(error.message);
  }
  const row = firstRow(data);
  if (!row) {
    if (!required) return null;
    throw new Error("房间不存在");
  }
  return mapRoomRow(row);
}

export function createSupabaseRoomRepository(client: SupabaseClient): RoomRepository {
  return {
    async createRoom(input: CreateRoomInput) {
      const room = await callRoomRpc(
        client,
        "create_gift_room",
        {
          p_title: input.title,
          p_recipient_name: input.recipientName,
          p_prompt_text: input.promptText
        },
        true
      );
      return room;
    },
    async getRoomByInviteToken(inviteToken: string) {
      return callRoomRpc(client, "get_room_by_invite_token", { p_invite_token: inviteToken }, false);
    },
    async getRoomByManageToken(manageToken: string) {
      return callRoomRpc(client, "get_room_by_manage_token", { p_manage_token: manageToken }, false);
    },
    async getPublishedRoomByRecipientToken(recipientToken: string) {
      return callRoomRpc(
        client,
        "get_published_room_by_recipient_token",
        { p_recipient_token: recipientToken },
        false
      );
    },
    async publishRoom(manageToken: string) {
      const room = await callRoomRpc(client, "publish_gift_room", { p_manage_token: manageToken }, true);
      return room;
    }
  };
}
