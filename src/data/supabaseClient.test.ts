import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "./supabaseClient";

describe("resolveSupabaseConfig", () => {
  it("requires explicit deployment variables", () => {
    expect(() => resolveSupabaseConfig({})).toThrow("Supabase config missing");
    expect(() => resolveSupabaseConfig({ VITE_SUPABASE_ANON_KEY: "example-key" })).toThrow(
      "Supabase config missing"
    );
  });

  it("rejects placeholder deployment variables", () => {
    expect(() =>
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://your-project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "your-anon-key"
      })
    ).toThrow("Supabase config missing");
  });

  it("rejects known unavailable deployment variables", () => {
    expect(() =>
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://sfysmhshvtpopwtcheib.supabase.co",
        VITE_SUPABASE_ANON_KEY: "example-key"
      })
    ).toThrow("Supabase config missing");
  });

  it("keeps explicit deployment variables first", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "example-key"
      })
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "example-key"
    });
  });
});
