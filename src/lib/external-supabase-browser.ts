import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getExternalPublicConfig } from "./external-config.functions";

let cached: SupabaseClient | null = null;
let pending: Promise<SupabaseClient> | null = null;

/** Cliente Supabase (externo) para uso no browser — persiste sessão em
 *  localStorage sob a chave `vp-admin-auth`. Usado pelo painel /admin. */
export function getExternalBrowser(): Promise<SupabaseClient> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const { url, publishableKey } = await getExternalPublicConfig();
    cached = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "vp-admin-auth",
      },
    });
    return cached;
  })();
  return pending;
}