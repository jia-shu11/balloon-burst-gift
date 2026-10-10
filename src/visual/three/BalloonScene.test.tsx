import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BalloonScene } from "./BalloonScene";
import { showcaseBalloons } from "./demoData";

const engine = vi.hoisted(() => ({ update: vi.fn(), dispose: vi.fn(), create: vi.fn() }));
vi.mock("./createBalloonScene", () => ({ createBalloonScene: engine.create }));

beforeEach(() => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  engine.update.mockClear();
  engine.dispose.mockClear();
  engine.create.mockReset().mockReturnValue({ update: engine.update, dispose: engine.dispose });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BalloonScene lifecycle", () => {
  it("updates voice data without replacing the renderer and releases it on unmount", async () => {
    const view = render(<BalloonScene variant="preview" balloons={showcaseBalloons.slice(0, 1)} level={0} />);
    await waitFor(() => expect(view.container.querySelector("[data-renderer=ready]")).toBeTruthy());
    view.rerender(<BalloonScene variant="preview" balloons={showcaseBalloons.slice(0, 1)} level={0.8} />);
    expect(engine.create).toHaveBeenCalledTimes(1);
    expect(engine.update.mock.lastCall?.[0].level).toBe(0.8);
    view.unmount();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });

  it("replaces a lost WebGL canvas with a separate compatible canvas", async () => {
    const onStatus = vi.fn();
    const view = render(<BalloonScene onStatus={onStatus} />);
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    const original = view.container.querySelector("canvas")!;
    fireEvent(original, new Event("webglcontextlost", { cancelable: true }));
    expect(view.container.querySelector("[data-renderer=fallback]")).toBeTruthy();
    expect(view.container.querySelector("canvas")).not.toBe(original);
    expect(onStatus).toHaveBeenLastCalledWith("fallback");
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });

  it("uses the compatible view when WebGL2 is unavailable without starting the engine", async () => {
    vi.stubGlobal("WebGL2RenderingContext", undefined);
    const view = render(<BalloonScene />);
    await waitFor(() => expect(view.container.querySelector("[data-renderer=fallback]")).toBeTruthy());
    expect(engine.create).not.toHaveBeenCalled();
  });
});
