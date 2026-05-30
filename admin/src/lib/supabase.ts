import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Prefer build-time env vars (set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in Vercel
// project settings). Falls back to the placeholders so isSupabaseConfigured()
// still reports false when neither is set — e.g. the customer portal then
// degrades to the app-redirect landing instead of erroring.
const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "REPLACE_WITH_SUPABASE_URL";
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "REPLACE_WITH_SUPABASE_ANON_KEY";

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL !== "REPLACE_WITH_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "REPLACE_WITH_SUPABASE_ANON_KEY" &&
    SUPABASE_URL.startsWith("https://")
  );
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured()) return null;

  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return _client;
}
