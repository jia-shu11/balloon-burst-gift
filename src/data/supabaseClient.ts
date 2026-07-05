import { createClient } from "@supabase/supabase-js";

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const UNAVAILABLE_SUPABASE_URLS = new Set(["https://sfysmhshvtpopwtcheib.supabase.co"]);

function normalizeSupabaseConfig(env: SupabaseEnv) {
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

  if (
    !url ||
    !anonKey ||
    url === "https://your-project.supabase.co" ||
    anonKey === "your-anon-key" ||
    UNAVAILABLE_SUPABASE_URLS.has(url)
  ) {
    return null;
  }

  return { url, anonKey };
}

export function hasUsableSupabaseConfig(env: SupabaseEnv) {
  return normalizeSupabaseConfig(env) !== null;
}

export function resolveSupabaseConfig(env: SupabaseEnv) {
  const config = normalizeSupabaseConfig(env);

  if (!config) {
    throw new Error("Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  }

  return config;
}

export function createSupabaseBrowserClient() {
  const { url, anonKey } = resolveSupabaseConfig(import.meta.env as unknown as SupabaseEnv);
  return createClient(url, anonKey);
}
