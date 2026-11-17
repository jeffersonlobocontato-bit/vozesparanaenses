import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public read-only client for the external Supabase (projeto Paraná Total).
 * Uses the publishable key — RLS applies as anon. Server-only.
 */
export function getExternalSupabase(): SupabaseClient {
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const key = process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_PUBLISHABLE_KEY não configurados",
    );
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client for the external Supabase. BYPASSES RLS. Server-only.
 * Usado por operações privilegiadas do ad server (checar caps, inserir
 * impressão/click) sem exigir sessão do usuário.
 */
export function getExternalServiceRole(): SupabaseClient {
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const key = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurados",
    );
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}