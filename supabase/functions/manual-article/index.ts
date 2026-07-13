// Vozes Paranaenses — manual-article
// Fluxo "Redator manual" da Fila editorial: recebe uma URL de notícia +
// agente/editoria + região escolhidos pelo editor humano, faz o scrape via
// Firecrawl, cria raw_article + cluster de 1 item e encadeia extract-facts
// → generate-article. Pula o pipeline automático (scraping agendado,
// clustering, quota) — serve para quando o editor quer subir uma matéria
// específica na hora, sem esperar o ciclo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  url: string;
  regiao_id: string;
  categoria_id: string;
  observacoes?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const selfUrl = Deno.env.get("SUPABASE_URL");
  const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!extUrl || !extKey) return json({ error: "missing_external_supabase_env" }, 500);
  if (!firecrawlKey) return json({ error: "missing_firecrawl_api_key" }, 500);
  if (!selfUrl || !selfKey) return json({ error: "missing_self_supabase_env" }, 500);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }
  const url = (body.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return json({ error: "invalid_url" }, 400);
  if (!body.regiao_id) return json({ error: "missing_regiao_id" }, 400);
  if (!body.categoria_id) return json({ error: "missing_categoria_id" }, 400);

  const sb = createClient(extUrl, extKey, { auth: { persistSession: false } });

  // 1. Firecrawl → markdown + og:image
  const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!fcRes.ok) {
    const t = await fcRes.text();
    return json({ error: "firecrawl_failed", status: fcRes.status, detail: t.slice(0, 400) }, 502);
  }
  const fcJson = await fcRes.json();
  const data = fcJson?.data ?? fcJson;
  const markdown: string = data?.markdown ?? "";
  const metadata: Record<string, unknown> = data?.metadata ?? {};
  const titulo = String(metadata?.title ?? metadata?.ogTitle ?? "Sem título").slice(0, 250);
  const ogImage = (metadata?.ogImage ?? metadata?.["og:image"] ?? null) as string | null;
  const author = (metadata?.author ?? metadata?.["article:author"] ?? null) as string | null;
  if (!markdown || markdown.length < 200) {
    return json({ error: "empty_content", hint: "Firecrawl não retornou corpo suficiente para redigir." }, 422);
  }

  // 2. Garantir uma "fonte manual" (uma linha por editor humano — reusada)
  const fonteSlug = "manual-editor";
  let fonteId: string | null = null;
  {
    const { data: existing } = await sb.from("fontes").select("id").eq("slug", fonteSlug).maybeSingle();
    if (existing?.id) {
      fonteId = existing.id as string;
    } else {
      const { data: created, error: fErr } = await sb.from("fontes").insert({
        slug: fonteSlug,
        nome: "Redator manual",
        url_base: "manual://editor",
        regiao_id: body.regiao_id,
        ativa: false,
      }).select("id").single();
      if (fErr) {
        // Tenta sem "ativa" (coluna pode não existir em ambientes antigos)
        const { data: created2, error: fErr2 } = await sb.from("fontes").insert({
          slug: fonteSlug,
          nome: "Redator manual",
          url_base: "manual://editor",
          regiao_id: body.regiao_id,
        }).select("id").single();
        if (fErr2) return json({ error: "fonte_manual_failed", detail: fErr2.message }, 500);
        fonteId = created2!.id as string;
      } else {
        fonteId = created!.id as string;
      }
    }
  }

  // 3. Inserir raw_article (dedup por hash — se o editor colar a mesma URL 2x, retorna erro amigável)
  const hash = await sha256(url + "|" + titulo);
  const rawInsert = await sb.from("raw_articles").insert({
    fonte_id: fonteId,
    regiao_id: body.regiao_id,
    url,
    titulo,
    corpo_limpo: markdown.slice(0, 30000),
    hash_conteudo: hash,
    data_publicacao_original: new Date().toISOString(),
    imagem_original_url: ogImage,
    imagem_credito: author ? `Foto: ${author}` : null,
    processado: false,
  }).select("id").single();
  if (rawInsert.error) {
    if (rawInsert.error.code === "23505") {
      return json({ error: "url_duplicada", hint: "Essa URL já foi processada antes." }, 409);
    }
    return json({ error: "raw_insert_failed", detail: rawInsert.error.message }, 500);
  }
  const rawId = rawInsert.data!.id as string;

  // 4. Criar cluster de 1 item já com regiao_id + categoria_id definidos pelo editor
  const clusterInsert = await sb.from("article_clusters").insert({
    regiao_id: body.regiao_id,
    categoria_id: body.categoria_id,
    prioridade_score: 1,
    interesse_score: 3.5, // alto o suficiente para o gerador; publicação continua manual
    status: "novo",
  }).select("id").single();
  if (clusterInsert.error) return json({ error: "cluster_insert_failed", detail: clusterInsert.error.message }, 500);
  const clusterId = clusterInsert.data!.id as string;

  const linkInsert = await sb.from("cluster_articles").insert({ cluster_id: clusterId, raw_article_id: rawId });
  if (linkInsert.error) return json({ error: "cluster_link_failed", detail: linkInsert.error.message }, 500);

  // 5. Chamar extract-facts
  const ef = await fetch(`${selfUrl}/functions/v1/extract-facts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
    body: JSON.stringify({ cluster_id: clusterId }),
  });
  if (!ef.ok) {
    const t = await ef.text();
    return json({ error: "extract_facts_failed", status: ef.status, detail: t.slice(0, 400), cluster_id: clusterId }, 502);
  }

  // 6. Chamar generate-article (com observações opcionais do editor)
  const ga = await fetch(`${selfUrl}/functions/v1/generate-article`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
    body: JSON.stringify({
      cluster_id: clusterId,
      extra_instructions: (body.observacoes ?? "").trim() || undefined,
    }),
  });
  if (!ga.ok) {
    const t = await ga.text();
    return json({ error: "generate_article_failed", status: ga.status, detail: t.slice(0, 400), cluster_id: clusterId }, 502);
  }
  const gaJson = await ga.json();

  return json({
    ok: true,
    cluster_id: clusterId,
    raw_article_id: rawId,
    article: gaJson?.article ?? null,
    titulo: gaJson?.titulo ?? titulo,
  });
});

async function sha256(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}