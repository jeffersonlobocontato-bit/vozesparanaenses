import { createServerFn } from "@tanstack/react-start";

/** Retorna URL + publishable key do Supabase externo para uso no browser
 *  (necessário para auth do painel admin — a chave publishable é segura). */
export const getExternalPublicConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ url: string; publishableKey: string }> => {
    const url = process.env.EXTERNAL_SUPABASE_URL;
    const publishableKey = process.env.EXTERNAL_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !publishableKey) {
      throw new Error("EXTERNAL_SUPABASE_URL/PUBLISHABLE_KEY ausentes");
    }
    return { url, publishableKey };
  },
);