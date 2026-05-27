import { describe, expect, it } from "vitest";
import { hitTestBalloon } from "./useCanvasBalloons";

describe("hitTestBalloon", () => {
  it("finds the topmost balloon under a point", () => {
    const hit = hitTestBalloon(
      [
        { id: "a", x: 100, y: 100, radius: 40 },
        { id: "b", x: 130, y: 100, radius: 50 }
      ],
      { x: 130, y: 100 }
    );

    expect(hit).toBe("b");
  });

  it("returns null when the point misses every balloon", () => {
    expect(hitTestBalloon([{ id: "a", x: 100, y: 100, radius: 40 }], { x: 300, y: 300 })).toBeNull();
  });
});
