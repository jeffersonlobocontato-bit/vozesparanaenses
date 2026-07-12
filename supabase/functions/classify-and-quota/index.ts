// Vozes Paranaenses — classify-and-quota
// Para cada cluster novo:
//  1. Classifica a categoria editorial via LLM barato (google/gemini-2.5-flash-lite).
//  2. Aplica quota_rules por região × categoria: define quantos clusters
//     entram em `selecionado_cota` respeitando piso/teto (janela últimos 7d).
//  3. Marca demais como `descartado`.
//
// Body opcional: { regiao_id?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { regiao_id?: string; sync?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: cats } = await sb.from("editorial_categories").select("id, slug, nome, peso_engajamento");
  const categorias = (cats ?? []) as { id: string; slug: string; nome: string; peso_engajamento: number }[];
  if (!categorias.length) return json({ error: "no_categories_defined" }, 400);

  let cq = sb
    .from("article_clusters")
    .select("id, regiao_id, categoria_id, prioridade_score, criado_em")
    .eq("status", "novo")
    .is("categoria_id", null)
    .order("prioridade_score", { ascending: false })
    .limit(50);
  if (body.regiao_id) cq = cq.eq("regiao_id", body.regiao_id);
  const { data: clusters, error } = await cq;
  if (error) return json({ error: "cluster_query_failed", detail: error.message }, 500);
  if (!clusters?.length) return json({ ok: true, classified: 0, selected: 0 });

  // A classificação de 50 clusters + escrita automática leva minutos (LLM
  // por cluster). O fetch do cliente (browser / curl) estoura antes de
  // terminar. Roda tudo em background via EdgeRuntime.waitUntil e responde
  // imediatamente — a fila editorial vai sendo populada aos poucos.
  const runPipeline = async () => {
    await processClusters({ clusters, categorias, sb, aiKey, url, key });
  };
  if (body.sync) {
    const result = await processClusters({ clusters, categorias, sb, aiKey, url, key });
    return json({ ok: true, ...result });
  }
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  const task = runPipeline().catch((e) => console.error("[classify-and-quota] background error", (e as Error).message));
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  return json({ ok: true, mode: "background", clusters: clusters.length });
});

async function processClusters(
  { clusters, categorias, sb, aiKey, url, key }: {
    clusters: Array<{ id: string; regiao_id: string; prioridade_score: number; criado_em: string }>;
    categorias: { id: string; slug: string; nome: string; peso_engajamento: number }[];
    // deno-lint-ignore no-explicit-any
    sb: any;
    aiKey: string;
    url: string;
    key: string;
  },
): Promise<{ classified: number; selected: number; discarded: number; fila: number }> {
  const _serve = null; // placeholder para manter escopo

  // 1. Classificar cada cluster (usa título do primeiro artigo do cluster)
  const classified: { id: string; regiao_id: string; categoria_id: string; score: number }[] = [];
  for (const c of clusters) {
    const { data: ca } = await sb
      .from("cluster_articles")
      .select("raw_article_id")
      .eq("cluster_id", c.id)
      .limit(3);
    const ids = (ca ?? []).map((r) => r.raw_article_id);
    const { data: raws } = await sb
      .from("raw_articles")
      .select("titulo, corpo_limpo")
      .in("id", ids);
    const excerpt = (raws ?? [])
      .map((r) => `${r.titulo ?? ""}\n${(r.corpo_limpo ?? "").slice(0, 400)}`)
      .join("\n\n---\n\n")
      .slice(0, 3000);
    const catSlug = await classify(excerpt, categorias, aiKey);
    const cat = categorias.find((k) => k.slug === catSlug) ?? categorias[0];

    // Bônus por cobertura estadual: se este cluster está vinculado (mesma
    // notícia detectada em outra região — ver cluster-articles), soma um
    // reforço proporcional a quantas regiões distintas já cobriram o fato.
    let bonusEstadual = 0;
    const { data: grupoRow } = await sb.from("article_clusters").select("grupo_estadual_id").eq("id", c.id).maybeSingle();
    const grupoEstadualId = grupoRow?.grupo_estadual_id ?? null;
    if (grupoEstadualId) {
      const { data: irmaos } = await sb
        .from("article_clusters")
        .select("regiao_id")
        .eq("grupo_estadual_id", grupoEstadualId);
      const regioesDistintas = new Set((irmaos ?? []).map((i) => i.regiao_id)).size;
      bonusEstadual = Math.max(0, regioesDistintas - 1) * 0.5;
    }

    // Interesse de leitura = nº de fontes (prova social) × peso da categoria
    // (comportamento histórico de consumo) × fator de recência (decai em 48h)
    // + bônus por cobertura em múltiplas regiões.
    const horasDesdeCriacao = (Date.now() - new Date(c.criado_em).getTime()) / 3_600_000;
    const fatorRecencia = Math.max(0.3, 1 - horasDesdeCriacao / 48);
    const interesseScore = Number((c.prioridade_score * cat.peso_engajamento * fatorRecencia + bonusEstadual).toFixed(2));

    await sb.from("article_clusters").update({ categoria_id: cat.id, interesse_score: interesseScore }).eq("id", c.id);
    classified.push({ id: c.id, regiao_id: c.regiao_id, categoria_id: cat.id, score: c.prioridade_score });
  }

  // 2. Aplicar quotas — janela 7 dias, agrupando por região × categoria
  const { data: quotas } = await sb.from("quota_rules").select("regiao_id, categoria_id, piso_pct, teto_pct");
  const quotaMap = new Map<string, { piso: number; teto: number }>();
  for (const q of (quotas ?? []) as { regiao_id: string; categoria_id: string; piso_pct: number; teto_pct: number }[]) {
    quotaMap.set(`${q.regiao_id}:${q.categoria_id}`, { piso: q.piso_pct, teto: q.teto_pct });
  }

  // Contagem atual por região dos últimos 7d de publicados
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { data: recentPub } = await sb
    .from("generated_articles")
    .select("regiao_id, categoria_id")
    .gte("publicado_em", since)
    .eq("status", "publicado");
  const currentCounts = new Map<string, number>();
  const regionTotals = new Map<string, number>();
  for (const row of (recentPub ?? []) as { regiao_id: string; categoria_id: string | null }[]) {
    if (!row.categoria_id) continue;
    const k = `${row.regiao_id}:${row.categoria_id}`;
    currentCounts.set(k, (currentCounts.get(k) ?? 0) + 1);
    regionTotals.set(row.regiao_id, (regionTotals.get(row.regiao_id) ?? 0) + 1);
  }

  let selected = 0;
  let discarded = 0;
  const selecionados: string[] = [];
  for (const c of classified.sort((a, b) => b.score - a.score)) {
    const rule = quotaMap.get(`${c.regiao_id}:${c.categoria_id}`);
    const total = Math.max(regionTotals.get(c.regiao_id) ?? 0, 10);
    const currentPct = ((currentCounts.get(`${c.regiao_id}:${c.categoria_id}`) ?? 0) / total) * 100;
    const teto = rule?.teto ?? 100;
    if (currentPct >= teto) {
      await sb.from("article_clusters").update({ status: "descartado" }).eq("id", c.id);
      discarded++;
    } else {
      await sb.from("article_clusters").update({ status: "selecionado_cota" }).eq("id", c.id);
      currentCounts.set(`${c.regiao_id}:${c.categoria_id}`, (currentCounts.get(`${c.regiao_id}:${c.categoria_id}`) ?? 0) + 1);
      regionTotals.set(c.regiao_id, (regionTotals.get(c.regiao_id) ?? 0) + 1);
      selected++;
      selecionados.push(c.id);
    }
  }

  // 3. Redação automática: sem curadoria manual do que escrever — extrai os
  // fatos e redige a matéria pra cada cluster selecionado pela cota, sem
  // esperar clique de ninguém. A decisão humana fica só em publicar ou não
  // (ver generate-article: quando não há foto real e o interesse é alto o
  // bastante, a matéria já sai publicada sozinha; senão vai pra fila).
  // Auto-write inline (já estamos em background aqui).
  const CHAIN_CONCURRENCY = 3;
  const fila = [...selecionados];
  const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
  const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;
  const workers = Array.from({ length: Math.min(CHAIN_CONCURRENCY, fila.length) }, async () => {
    while (fila.length) {
      const clusterId = fila.shift();
      if (!clusterId) return;
      try {
        const ef = await fetch(`${selfUrl}/functions/v1/extract-facts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
          body: JSON.stringify({ cluster_id: clusterId }),
        });
        if (!ef.ok) { console.error(`[auto-write] extract-facts falhou p/ ${clusterId}`, await ef.text()); continue; }
        const ga = await fetch(`${selfUrl}/functions/v1/generate-article`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
          body: JSON.stringify({ cluster_id: clusterId }),
        });
        if (!ga.ok) { console.error(`[auto-write] generate-article falhou p/ ${clusterId}`, await ga.text()); continue; }
      } catch (e) {
        console.error(`[auto-write] erro no cluster ${clusterId}`, (e as Error).message);
      }
    }
  });
  await Promise.all(workers);
  console.log(`[classify-and-quota] concluído: classified=${classified.length} selected=${selected} discarded=${discarded} fila=${selecionados.length}`);
  return { classified: classified.length, selected, discarded, fila: selecionados.length };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function classify(
  excerpt: string,
  categorias: { slug: string; nome: string }[],
  apiKey: string,
): Promise<string> {
  const slugs = categorias.map((c) => c.slug).join(", ");
  const sys = `Você é um editor de um portal do Paraná (Brasil). Classifique o excerto em UMA categoria dentre: ${slugs}.

Regras de escopo geográfico (aplicar ANTES de escolher a editoria temática):
- Se o fato NÃO menciona o Paraná nem cidade/pessoa/instituição do Paraná, e ocorre em outro estado brasileiro ou tem escopo nacional (Brasil, governo federal, Congresso, STF, seleção brasileira, etc.), responda "nacional".
- Se o fato ocorre fora do Brasil (outro país, órgãos internacionais, esportes/política/economia estrangeiros) e não tem ligação direta com o Paraná, responda "internacional".
- Caso contrário (fato paranaense OU com impacto direto no Paraná), escolha a editoria temática apropriada (politica, economia, agro, seguranca, educacao, esportes, cultura, saude, cidades, meio-ambiente).

Responda APENAS com o slug, sem aspas, sem texto extra.`;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: excerpt }],
        max_tokens: 20,
        temperature: 0,
      }),
    });
    if (!res.ok) return categorias[0].slug;
    const j = await res.json();
    const raw = String(j.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
    // Prioriza slugs mais longos primeiro (ex.: "internacional" antes de
    // "nacional") para não confundir substrings.
    const ordered = [...categorias].sort((a, b) => b.slug.length - a.slug.length);
    const found = ordered.find((c) => raw.includes(c.slug));
    return found?.slug ?? categorias[0].slug;
  } catch {
    return categorias[0].slug;
  }
}