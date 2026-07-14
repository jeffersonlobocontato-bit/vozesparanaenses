// Vozes Paranaenses — vitrine-pessoal-obter
// Busca o pedido + rascunho da matéria a partir do token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// TODO: trocar pela chave Pix real da conta que vai receber.
const PIX_CHAVE = "financeiro@vozesparanaenses.com.br";
const PIX_TITULAR = "Vozes Paranaenses (titular a confirmar)";

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

  const { data: pedido, error } = await sb
    .from("vitrine_pessoal_pedidos")
    .select(
      "id, status, nome_cliente, profissao, valor, metodo_pagamento, motivo_recusa, imagens, " +
      "generated_article:generated_article_id(id, slug, titulo, subtitulo, resumo, corpo, regiao:regioes(slug))",
    )
    .eq("token", body.token)
    .maybeSingle();

  if (error) return json({ error: "query_failed", detail: error.message }, 500);
  if (!pedido) return json({ error: "token_invalido" }, 404);

  return json({
    ok: true,
    pedido,
    pix: pedido.status === "aprovado" ? { chave: PIX_CHAVE, titular: PIX_TITULAR } : null,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
