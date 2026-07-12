// Vozes Paranaenses — expire-drafts
// Roda periodicamente (ver 003_pipeline_cron.sql). Duas fases:
//   1. Rascunho com mais de 12h sem decisão vira 'expirado' — some da fila
//      ativa, sem exigir clique humano (ver 022_publicacao_automatica.sql).
//   2. Expirado com mais de 7 dias é apagado de vez — o intervalo entre as
//      duas fases é a rede de segurança contra dias sem revisar o painel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HORAS_ATE_EXPIRAR = 12;
const DIAS_ATE_APAGAR = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Fase 1: rascunho → expirado (mais de 12h sem decisão)
  const limiteExpirar = new Date(Date.now() - HORAS_ATE_EXPIRAR * 3600 * 1000).toISOString();
  const { data: expirados, error: e1 } = await sb
    .from("generated_articles")
    .update({ status: "expirado", expirado_em: new Date().toISOString() })
    .eq("status", "rascunho")
    .lt("gerado_em", limiteExpirar)
    .select("id");
  if (e1) return json({ error: "expire_step_failed", detail: e1.message }, 500);

  // Fase 2: expirado → apagado de vez (mais de 7 dias expirado)
  const limiteApagar = new Date(Date.now() - DIAS_ATE_APAGAR * 86400 * 1000).toISOString();
  const { data: apagados, error: e2 } = await sb
    .from("generated_articles")
    .delete()
    .eq("status", "expirado")
    .lt("expirado_em", limiteApagar)
    .select("id");
  if (e2) return json({ error: "purge_step_failed", detail: e2.message }, 500);

  return json({
    ok: true,
    expirados_agora: expirados?.length ?? 0,
    apagados_definitivamente: apagados?.length ?? 0,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
