// Vozes Paranaenses — vitrine-pessoal-salvar
// Cliente edita o próprio rascunho via token. Trava a edição assim que o
// pedido entra em aprovação/pagamento/publicação.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  token: string; titulo?: string; subtitulo?: string; resumo?: string; corpo?: string;
  finalizar?: boolean;
};

const EDITAVEL = ["aguardando_edicao", "enviado_para_aprovacao"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.token) return json({ error: "missing_token" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: pedido, error: pErr } = await sb
    .from("vitrine_pessoal_pedidos")
    .select("id, status, generated_article_id")
    .eq("token", body.token)
    .maybeSingle();
  if (pErr || !pedido) return json({ error: "token_invalido" }, 404);
  if (!EDITAVEL.includes(pedido.status)) {
    return json({ error: "edicao_bloqueada", status_atual: pedido.status }, 409);
  }

  const updateArticle: Record<string, string> = {};
  if (body.titulo !== undefined) updateArticle.titulo = body.titulo;
  if (body.subtitulo !== undefined) updateArticle.subtitulo = body.subtitulo;
  if (body.resumo !== undefined) updateArticle.resumo = body.resumo;
  if (body.corpo !== undefined) updateArticle.corpo = body.corpo;

  if (Object.keys(updateArticle).length > 0) {
    const { error: uErr } = await sb.from("generated_articles").update(updateArticle).eq("id", pedido.generated_article_id);
    if (uErr) return json({ error: "update_failed", detail: uErr.message }, 500);
  }

  if (body.finalizar) {
    const { error: sErr } = await sb
      .from("vitrine_pessoal_pedidos")
      .update({ status: "enviado_para_aprovacao" })
      .eq("id", pedido.id);
    if (sErr) return json({ error: "status_update_failed", detail: sErr.message }, 500);
  }

  return json({ ok: true, enviado_para_aprovacao: !!body.finalizar });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
