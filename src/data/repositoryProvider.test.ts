import { describe, expect, it } from "vitest";
import { resolveRepositoryMode } from "./repositoryProvider";

describe("resolveRepositoryMode", () => {
  it("uses local browser storage for local demos by explicit mode", () => {
    expect(resolveRepositoryMode({ PROD: true, VITE_REPOSITORY_MODE: "memory" })).toBe("local");
    expect(resolveRepositoryMode({ PROD: true, VITE_REPOSITORY_MODE: "local" })).toBe("local");
  });

  it("uses Supabase for deployed builds unless a local demo mode is explicitly requested", () => {
    expect(resolveRepositoryMode({ PROD: true })).toBe("supabase");
    expect(resolveRepositoryMode({ PROD: false })).toBe("local");
    expect(resolveRepositoryMode({ PROD: false, VITE_REPOSITORY_MODE: "supabase" })).toBe("supabase");
  });
});
