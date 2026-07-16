// Apaga pautas (article_clusters) por status ou por ids, usando service
// role no Supabase externo. Necessário porque a tabela article_clusters
// não tem política de DELETE para o usuário autenticado — via cliente
// browser a exclusão retorna 0 linhas silenciosamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  ids?: string[];
  statuses?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_env" }, 500);

  let body: Body = {};
  try { body = await req.json(); } catch { /* body vazio = todas as pendentes */ }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Descobrir quais clusters serão apagados (precisamos dos ids pra
  //    também resetar processado=false nas raw_articles vinculadas —
  //    sem isso, uma nova rodada de pipeline ignora o backlog inteiro
  //    porque as raws já estão marcadas processado=true).
  let sel = sb.from("article_clusters").select("id");
  if (body.ids?.length) {
    sel = sel.in("id", body.ids);
  } else {
    const statuses = body.statuses?.length
      ? body.statuses
      : ["novo", "selecionado_cota", "fatos_extraidos", "descartado"];
    sel = sel.in("status", statuses);
  }
  const { data: alvos, error: selErr } = await sel;
  if (selErr) return json({ error: "select_failed", detail: selErr.message }, 500);
  const clusterIds = (alvos ?? []).map((r: { id: string }) => r.id);
  if (!clusterIds.length) return json({ ok: true, deleted: 0, raws_reset: 0 });

  // 2. Raws vinculados → reset processado=false pra voltarem à fila
  const { data: links } = await sb.from("cluster_articles").select("raw_article_id").in("cluster_id", clusterIds);
  const rawIds = Array.from(new Set((links ?? []).map((l: { raw_article_id: string }) => l.raw_article_id)));
  let rawsReset = 0;
  if (rawIds.length) {
    const CHUNK = 500;
    for (let i = 0; i < rawIds.length; i += CHUNK) {
      const slice = rawIds.slice(i, i + CHUNK);
      const { error: upErr } = await sb.from("raw_articles").update({ processado: false }).in("id", slice);
      if (upErr) console.error("[delete-clusters] reset processado falhou", upErr.message);
      else rawsReset += slice.length;
    }
  }

  // 3. Apaga os clusters (cascade em cluster_articles)
  const { error, count } = await sb.from("article_clusters").delete({ count: "exact" }).in("id", clusterIds).select("id");
  if (error) return json({ error: "delete_failed", detail: error.message }, 500);
  return json({ ok: true, deleted: count ?? 0, raws_reset: rawsReset });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}