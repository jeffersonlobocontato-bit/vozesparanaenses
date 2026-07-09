// Vozes Paranaenses — cluster-articles
// Agrupa `raw_articles` não processados sobre o MESMO fato usando embeddings
// (openai/text-embedding-3-small via Lovable AI Gateway) + similaridade
// cosseno na tabela `raw_articles` (pgvector). Gera clusters em
// `article_clusters` + `cluster_articles` e marca raws como `processado=true`.
//
// Body opcional: { regiao_id?: string, limit?: number, threshold?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small";

type Raw = {
  id: string;
  regiao_id: string | null;
  titulo: string | null;
  corpo_limpo: string | null;
  embedding: number[] | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { regiao_id?: string; limit?: number; threshold?: number } = {};
  try { body = await req.json(); } catch { body = {}; }
  const limit = Math.min(body.limit ?? 100, 200);
  const threshold = body.threshold ?? 0.82;

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb
    .from("raw_articles")
    .select("id, regiao_id, titulo, corpo_limpo, embedding")
    .eq("processado", false)
    .order("coletado_em", { ascending: false })
    .limit(limit);
  if (body.regiao_id) q = q.eq("regiao_id", body.regiao_id);
  const { data: raws, error } = await q;
  if (error) return json({ error: "raw_query_failed", detail: error.message }, 500);
  if (!raws?.length) return json({ ok: true, processed: 0, clusters: 0 });

  // 1. Gerar embeddings faltantes
  const items = raws as Raw[];
  const needEmbed = items.filter((r) => !r.embedding);
  for (const r of needEmbed) {
    const text = `${r.titulo ?? ""}\n\n${r.corpo_limpo ?? ""}`.slice(0, 4000);
    if (!text.trim()) continue;
    const embedding = await embed(text, aiKey);
    if (embedding) {
      r.embedding = embedding;
      await sb.from("raw_articles").update({ embedding }).eq("id", r.id);
    }
  }

  // 2. Agrupar por região + similaridade cosseno (O(n²) simples)
  const withEmb = items.filter((r) => r.embedding && r.regiao_id);
  const groups: Raw[][] = [];
  const used = new Set<string>();
  for (const r of withEmb) {
    if (used.has(r.id)) continue;
    const g: Raw[] = [r];
    used.add(r.id);
    for (const o of withEmb) {
      if (used.has(o.id)) continue;
      if (o.regiao_id !== r.regiao_id) continue;
      const sim = cosine(r.embedding!, o.embedding!);
      if (sim >= threshold) {
        g.push(o);
        used.add(o.id);
      }
    }
    groups.push(g);
  }

  // 3. Persistir clusters
  let created = 0;
  for (const g of groups) {
    const regiao_id = g[0].regiao_id!;
    const { data: cluster, error: cErr } = await sb
      .from("article_clusters")
      .insert({ regiao_id, prioridade_score: g.length, status: "novo" })
      .select("id")
      .single();
    if (cErr || !cluster) {
      console.error("cluster insert failed", cErr?.message);
      continue;
    }
    const links = g.map((r) => ({ cluster_id: cluster.id, raw_article_id: r.id }));
    await sb.from("cluster_articles").insert(links);
    await sb.from("raw_articles").update({ processado: true }).in("id", g.map((r) => r.id));
    created++;
  }

  return json({ ok: true, processed: items.length, clusters: created });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      console.error("embed failed", res.status, await res.text());
      return null;
    }
    const j = await res.json();
    return j.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("embed error", (e as Error).message);
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}