import { describe, expect, it } from "vitest";
import type { BalloonParams } from "../domain/types";
import { createBalloonPathCommands } from "./drawBalloon";

const params: BalloonParams = {
  radius: 90,
  stretchX: 1.08,
  stretchY: 1.22,
  wobble: 0.5,
  glow: 0.8,
  surfaceWaveDensity: 10,
  floatSpeed: 0.3,
  stringLength: 88,
  fragmentCount: 20,
  burstRadius: 260,
  hue: 332
};

describe("createBalloonPathCommands", () => {
  it("creates a soft-body path with knot and tether anchors", () => {
    const commands = createBalloonPathCommands(params, 200, 180, 1.3);

    expect(commands[0].type).toBe("moveTo");
    expect(commands.some((command) => command.type === "bezierCurveTo")).toBe(true);
    expect(commands.some((command) => command.type === "knot")).toBe(true);
    expect(commands.some((command) => command.type === "string")).toBe(true);
  });
});
