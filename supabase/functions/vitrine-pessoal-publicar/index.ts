// Vozes Paranaenses — vitrine-pessoal-publicar
// Só publica se o pedido já estiver 'pago' (confirmado manualmente pelo
// admin hoje; por webhook do Mercado Pago no futuro).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = "https://vozesparanaenses.com.br";

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

  const { data: pedido, error: pErr } = await sb
    .from("vitrine_pessoal_pedidos")
    .select("id, status, generated_article_id, imagens, generated_article:generated_article_id(slug, imagem_capa_url, regiao:regioes(slug))")
    .eq("token", body.token)
    .maybeSingle();
  if (pErr || !pedido) return json({ error: "token_invalido" }, 404);
  if (pedido.status !== "pago") {
    return json({ error: "pagamento_nao_confirmado", status_atual: pedido.status }, 409);
  }

  const now = new Date().toISOString();
  const artAtual = Array.isArray(pedido.generated_article) ? pedido.generated_article[0] : pedido.generated_article;
  const imgs = Array.isArray(pedido.imagens) ? pedido.imagens as Array<{ url: string }> : [];
  const capaAtual = artAtual?.imagem_capa_url ?? null;
  const update: Record<string, unknown> = { status: "publicado", publicado_em: now };
  if (!capaAtual && imgs[0]?.url) update.imagem_capa_url = imgs[0].url;
  const { error: aErr } = await sb
    .from("generated_articles")
    .update(update)
    .eq("id", pedido.generated_article_id);
  if (aErr) return json({ error: "publish_failed", detail: aErr.message }, 500);

  await sb.from("vitrine_pessoal_pedidos").update({ status: "publicado", publicado_em: now }).eq("id", pedido.id);

  const art = Array.isArray(pedido.generated_article) ? pedido.generated_article[0] : pedido.generated_article;
  const regiaoSlug = Array.isArray(art?.regiao) ? art?.regiao[0]?.slug : art?.regiao?.slug;
  const link = art?.slug && regiaoSlug ? `${SITE_URL}/${regiaoSlug}/${art.slug}` : null;

  return json({ ok: true, link });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
