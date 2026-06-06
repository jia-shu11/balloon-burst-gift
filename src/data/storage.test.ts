import { describe, expect, it } from "vitest";
import { createAudioStorageFileName, createGiftStoragePath } from "./storage";

describe("createGiftStoragePath", () => {
  it("creates stable room-scoped paths for audio and images", () => {
    expect(createGiftStoragePath("room-1", "gift-1", "audio.webm")).toBe("room-1/gift-1/audio.webm");
    expect(createGiftStoragePath("room-1", "gift-1", "photo.png")).toBe("room-1/gift-1/photo.png");
  });

  it("sanitizes unsafe file names", () => {
    expect(createGiftStoragePath("room-1", "gift-1", "my photo(1).png")).toBe("room-1/gift-1/my_photo_1_.png");
  });

  it("uses a storage file extension that matches the recorded mobile audio format", () => {
    expect(createAudioStorageFileName("audio/mp4")).toBe("audio.mp4");
    expect(createAudioStorageFileName("audio/webm;codecs=opus")).toBe("audio.webm");
    expect(createAudioStorageFileName("audio/ogg;codecs=opus")).toBe("audio.ogg");
  });
});
