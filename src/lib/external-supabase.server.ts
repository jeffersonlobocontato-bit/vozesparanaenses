import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Public read-only client for the external Supabase (projeto Paraná Total).
 * Uses the publishable key — RLS applies as anon. Server-only.
 */
export function getExternalSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const key = process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_PUBLISHABLE_KEY não configurados",
    );
  }
  cached = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return cached;
}