import type { SupabaseClient } from "@supabase/supabase-js";

export const GIFT_MEDIA_BUCKET = "gift-media";

export function createAudioStorageFileName(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "audio.mp4";
  if (normalized.includes("ogg")) return "audio.ogg";
  if (normalized.includes("wav")) return "audio.wav";
  return "audio.webm";
}

export function createGiftStoragePath(roomId: string, giftId: string, fileName: string) {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${roomId}/${giftId}/${cleanName}`;
}

export async function uploadGiftFile(
  client: SupabaseClient,
  roomId: string,
  giftId: string,
  file: Blob,
  fileName: string
) {
  const path = createGiftStoragePath(roomId, giftId, fileName);
  const { error } = await client.storage.from(GIFT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || undefined,
    upsert: false
  });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(GIFT_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
