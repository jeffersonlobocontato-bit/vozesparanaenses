// One-shot: limpa conteúdo editorial no Supabase externo.
// Requer header x-admin-token = ADMIN_RESET_TOKEN (secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "missing env" }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
  const sb = createClient(url, key);

  const tables = [
    "ad_impressions",
    "extracted_facts",
    "cluster_articles",
    "generated_articles",
    "article_clusters",
    "raw_articles",
  ];

  const results: Record<string, unknown> = {};
  for (const t of tables) {
    const filterCol = t === "cluster_articles" ? "cluster_id" : "id";
    const { error, count } = await sb.from(t).delete({ count: "exact" }).not(filterCol, "is", null);
    results[t] = error ? { error: error.message } : { deleted: count };
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
