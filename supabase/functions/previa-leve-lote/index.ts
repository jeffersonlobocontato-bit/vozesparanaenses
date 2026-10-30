// Vozes Paranaenses — previa-leve-lote
// Refaz a prévia leve (og:image ≤ ~280 KB, ver _shared/previa-leve.ts) das
// matérias publicadas que ainda apontam a prévia para a capa original.
// Interna (cron/serviço/equipe). Body opcional: { dias = 30, limite = 25 }.
// Rode várias vezes até "restantes" chegar a 0.

import { exigirInterno } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { garantirPreviaLeve } from "../_shared/previa-leve.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirInterno(req);
    if (negado) return negado;
  }
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let body: { dias?: number; limite?: number } = {};
  try { body = await req.json(); } catch { /* sem body */ }
  const dias = Math.min(Math.max(Number(body.dias ?? 30), 1), 365);
  const limite = Math.min(Math.max(Number(body.limite ?? 25), 1), 60);

  // Só capas do nosso storage (as fotos de arquivo do site já são leves).
  const base = () => sb
    .from("generated_articles")
    .select("id, og_image_url", { count: "exact" })
    .eq("status", "publicado")
    .gte("publicado_em", new Date(Date.now() - dias * 86_400_000).toISOString())
    .like("og_image_url", "%/storage/v1/object/public/%")
    .not("og_image_url", "like", "%/previa.jpg%")
    .not("og_image_url", "like", "%/leve-ok%");
  const { data, count, error } = await base().order("publicado_em", { ascending: false }).limit(limite);
  if (error) return json({ error: error.message }, 500);

  let reduzidas = 0;
  let jaLeves = 0;
  for (const m of (data ?? []) as Array<{ id: string; og_image_url: string }>) {
    const nova = await garantirPreviaLeve(sb, m.id, m.og_image_url);
    if (nova) reduzidas++;
    else {
      // Já era leve (ou não deu para ler): marca com um fragmento para não
      // voltar a baixar no próximo lote. O fragmento (#) não muda a imagem.
      jaLeves++;
      await sb.from("generated_articles").update({ og_image_url: `${m.og_image_url}#leve-ok` }).eq("id", m.id);
    }
  }
  return json({ ok: true, processadas: (data ?? []).length, reduzidas, ja_leves: jaLeves, restantes: Math.max(0, (count ?? 0) - (data ?? []).length) });
});
