// Vozes Paranaenses — publieditorial-obter
// Busca a "casca" do briefing (campanha, região) a partir do token, pra
// página pública de entrevista carregar contexto (nome da campanha etc.)
// sem precisar de login.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: { token?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.token) return json({ error: "missing_token" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: briefing, error } = await sb
    .from("publieditorial_briefings")
    .select(
      "id, status, nome_anunciante, o_que_faz, contexto_mercado, diferenciais, evidencias, impacto_leitor, cta_texto, link_destino, " +
      "campaign:campaign_id(nome), generated_article:generated_article_id(slug, regiao:regioes(slug))",
    )
    .eq("token", body.token)
    .maybeSingle();

  if (error) return json({ error: "query_failed", detail: error.message }, 500);
  if (!briefing) return json({ error: "token_invalido" }, 404);

  const { data: chat } = await sb
    .from("publieditorial_chat_messages")
    .select("role, content, criado_em")
    .eq("briefing_id", briefing.id)
    .order("criado_em", { ascending: true });

  return json({ ok: true, briefing, chat: chat ?? [] });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
