import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BalloonParams } from "../../domain/types";
import { LiveBalloonPreview } from "./LiveBalloonPreview";

const params: BalloonParams = {
  radius: 80,
  stretchX: 1,
  stretchY: 1.18,
  wobble: 0.4,
  glow: 0.6,
  surfaceWaveDensity: 6,
  floatSpeed: 0.3,
  stringLength: 72,
  fragmentCount: 18,
  burstRadius: 220,
  hue: 142
};

afterEach(() => {
  cleanup();
});

describe("LiveBalloonPreview", () => {
  it("keeps the balloon body, knot, and string inside one assembly", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");
    const assembly = preview.querySelector(".live-balloon-assembly");

    expect(assembly).toBeTruthy();
    expect(preview.children).toHaveLength(1);
    expect(assembly?.querySelector(".live-balloon")).toBeTruthy();
    expect(assembly?.querySelector(".live-balloon-knot")).toBeTruthy();
    expect(assembly?.querySelector(".live-balloon-string")).toBeTruthy();
  });

  it("scales oversized previews down so they fit beside the form", () => {
    render(
      <LiveBalloonPreview
        params={{
          ...params,
          radius: 260,
          stretchX: 1.14,
          stretchY: 1.28,
          stringLength: 110
        }}
        level={0.3}
      />
    );

    const assembly = screen.getByLabelText("实时鼓胀气球预览").querySelector<HTMLElement>(".live-balloon-assembly");

    expect(assembly?.style.transform).toMatch(/^scale\(0\.\d+\)$/);
  });

  it("does not render visible rim or ring decorations around the preview balloon", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");

    expect(preview.querySelector(".live-balloon-rim")).toBeNull();
    expect(preview.querySelector(".live-balloon-wave")).toBeNull();
  });

  it("lets the giver tap the preview balloon for a soft rebound", () => {
    render(<LiveBalloonPreview params={params} level={0.3} />);

    const preview = screen.getByLabelText("实时鼓胀气球预览");
    fireEvent.click(screen.getByRole("button", { name: "轻触气球预览" }));

    expect(preview).toHaveClass("is-poked");
  });
});
