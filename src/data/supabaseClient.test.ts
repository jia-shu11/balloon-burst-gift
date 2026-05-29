import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "./supabaseClient";

describe("resolveSupabaseConfig", () => {
  it("uses the public course project defaults when Vercel build variables are missing", () => {
    expect(resolveSupabaseConfig({})).toEqual({
      url: "https://sfysmhshvtpopwtcheib.supabase.co",
      anonKey: "sb_publishable__eEtg1ziWoJgckeufOzDVA_34QNT9Uo"
    });
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
