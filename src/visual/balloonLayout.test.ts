import { describe, expect, it } from "vitest";
import type { BalloonGift } from "../domain/types";
import { createBalloonLayout } from "./balloonLayout";

function gift(id: string, radius: number): BalloonGift {
  return {
    id,
    roomId: "room",
    giverName: id,
    audioUrl: "audio",
    audioDurationSec: 10,
    averageVolume: 0.4,
    peakVolume: 0.8,
    transcript: "生日快乐",
    editedTranscript: "生日快乐",
    extraText: "",
    imageUrls: [],
    imageBytes: 0,
    deletedAt: null,
    createdAt: "2026-05-27T00:00:00.000Z",
    balloonParams: {
      radius,
      stretchX: 1,
      stretchY: 1.15,
      wobble: 0.4,
      glow: 0.7,
      surfaceWaveDensity: 8,
      floatSpeed: 0.3,
      stringLength: 70,
      fragmentCount: 16,
      burstRadius: 200,
      hue: 330
    }
  };
}

describe("createBalloonLayout", () => {
  it("places balloons inside the stage bounds", () => {
    const layout = createBalloonLayout([gift("a", 80), gift("b", 120), gift("c", 60)], {
      width: 1000,
      height: 700
    });

    for (const item of layout) {
      expect(item.x).toBeGreaterThanOrEqual(item.gift.balloonParams.radius);
      expect(item.x).toBeLessThanOrEqual(1000 - item.gift.balloonParams.radius);
      expect(item.y).toBeGreaterThanOrEqual(item.gift.balloonParams.radius);
      expect(item.y).toBeLessThanOrEqual(700 - item.gift.balloonParams.radius);
    }
  });

  it("is deterministic for the same gifts and stage size", () => {
    const gifts = [gift("a", 80), gift("b", 120), gift("c", 60)];

    expect(createBalloonLayout(gifts, { width: 900, height: 600 })).toEqual(
      createBalloonLayout(gifts, { width: 900, height: 600 })
    );
  });
});
