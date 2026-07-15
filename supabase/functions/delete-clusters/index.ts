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

  let q = sb.from("article_clusters").delete({ count: "exact" });
  if (body.ids?.length) {
    q = q.in("id", body.ids);
  } else {
    const statuses = body.statuses?.length
      ? body.statuses
      : ["novo", "selecionado_cota", "fatos_extraidos", "descartado"];
    q = q.in("status", statuses);
  }
  const { error, count } = await q.select("id");
  if (error) return json({ error: "delete_failed", detail: error.message }, 500);
  return json({ ok: true, deleted: count ?? 0 });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}