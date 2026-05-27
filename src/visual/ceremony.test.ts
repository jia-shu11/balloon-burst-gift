import { describe, expect, it } from "vitest";
import { createBurstOrder, updateCeremonyCharge } from "./ceremony";

describe("ceremony", () => {
  it("charges only while held", () => {
    expect(updateCeremonyCharge(0, 0.5, true)).toBe(0.5);
    expect(updateCeremonyCharge(0.5, 0.5, false)).toBe(0.25);
    expect(updateCeremonyCharge(0.9, 0.5, true)).toBe(1);
  });

  it("orders balloons by distance from the trigger point", () => {
    const order = createBurstOrder(
      [
        { id: "far", x: 900, y: 100 },
        { id: "near", x: 120, y: 120 },
        { id: "middle", x: 360, y: 240 }
      ],
      { x: 100, y: 100 }
    );

    expect(order.map((item) => item.id)).toEqual(["near", "middle", "far"]);
  });
});
