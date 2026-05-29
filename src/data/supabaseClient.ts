import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sfysmhshvtpopwtcheib.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable__eEtg1ziWoJgckeufOzDVA_34QNT9Uo";

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function resolveSupabaseConfig(env: SupabaseEnv) {
  const url = env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = resolveSupabaseConfig(import.meta.env as unknown as SupabaseEnv);
  return createClient(url, anonKey);
}
