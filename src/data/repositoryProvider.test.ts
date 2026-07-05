import { describe, expect, it } from "vitest";
import { resolveRepositoryMode } from "./repositoryProvider";

describe("resolveRepositoryMode", () => {
  it("uses local browser storage for local demos by explicit mode", () => {
    expect(resolveRepositoryMode({ PROD: true, VITE_REPOSITORY_MODE: "memory" })).toBe("local");
    expect(resolveRepositoryMode({ PROD: true, VITE_REPOSITORY_MODE: "local" })).toBe("local");
  });

  it("uses local browser storage when deployed Supabase config is incomplete", () => {
    expect(resolveRepositoryMode({ PROD: true })).toBe("local");
    expect(
      resolveRepositoryMode({
        PROD: true,
        VITE_REPOSITORY_MODE: "supabase",
        VITE_SUPABASE_ANON_KEY: "example-key"
      })
    ).toBe("local");
    expect(resolveRepositoryMode({ PROD: false })).toBe("local");
  });

  it("uses Supabase only when a usable URL and anon key are configured", () => {
    expect(
      resolveRepositoryMode({
        PROD: true,
        VITE_REPOSITORY_MODE: "supabase",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "example-key"
      })
    ).toBe("supabase");
  });
});
