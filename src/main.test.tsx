import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function futureFlagWarnings(warn: ReturnType<typeof vi.spyOn>) {
  return warn.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes("React Router Future Flag Warning"));
}

describe("main entrypoint", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("boots the browser router without React Router future flag warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await act(async () => {
      await import("./main");
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(futureFlagWarnings(warn)).toEqual([]);
  });
});
