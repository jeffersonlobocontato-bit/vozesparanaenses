// Vozes Paranaenses — generate-article
// Recebe { cluster_id } (ou { raw_article_ids }) e gera uma matéria via
// Lovable AI Gateway (google/gemini-2.5-pro) seguindo o Método DEL + 5W1H.
// Grava em extracted_facts e generated_articles (status='rascunho') no
// Supabase externo, para revisão no dashboard editorial.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT = `Você é editor-chefe do portal regional "Vozes Paranaenses".
Sua tarefa: a partir de matérias-fonte sobre o MESMO fato, produzir UMA reportagem
original em português brasileiro, seguindo o Método DEL (Denso, Editorial, Local).

REGRAS INEGOCIÁVEIS:
1. NUNCA copie frases das fontes. Reescreva integralmente.
2. NUNCA invente fatos, nomes, números, datas, cargos, citações.
3. Só afirme o que estiver nas fontes. Em caso de conflito, registre a divergência.
4. Extraia rigorosamente os 5W1H: quem, o_que, quando, onde, por_que, como.
5. Cite fontes ao final do corpo (nome do veículo + link).
6. Tom editorial: informativo, direto, sem opinião, foco no impacto local.
7. Título: até 90 caracteres, sem clickbait, com o fato central.
8. Subtítulo: contexto complementar, até 160 caracteres.
9. Resumo: 2-3 frases, autocontido (para redes sociais e SEO).
10. Corpo: 4-8 parágrafos curtos, lead na primeira frase.

Retorne APENAS JSON válido, sem markdown, no schema fornecido.`;

type Payload = { cluster_id?: string; raw_article_ids?: string[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Resolver artigos-fonte
  let rawIds: string[] = [];
  let clusterId = body.cluster_id ?? null;
  let regiaoId: string | null = null;
  let categoriaId: string | null = null;

  if (clusterId) {
    const { data: cluster, error: cErr } = await sb
      .from("article_clusters")
      .select("id, regiao_id, categoria_id")
      .eq("id", clusterId)
      .maybeSingle();
    if (cErr || !cluster) return json({ error: "cluster_not_found", detail: cErr?.message }, 404);
    regiaoId = cluster.regiao_id;
    categoriaId = cluster.categoria_id;
    const { data: ca } = await sb
      .from("cluster_articles")
      .select("raw_article_id")
      .eq("cluster_id", clusterId);
    rawIds = (ca ?? []).map((r) => r.raw_article_id);
  } else if (body.raw_article_ids?.length) {
    rawIds = body.raw_article_ids;
  } else {
    return json({ error: "missing_cluster_id_or_raw_article_ids" }, 400);
  }

  if (!rawIds.length) return json({ error: "no_raw_articles" }, 400);

  const { data: raws, error: rErr } = await sb
    .from("raw_articles")
    .select("id, url, titulo, corpo_limpo, regiao_id, fontes:fonte_id(id, nome, dominio)")
    .in("id", rawIds);
  if (rErr || !raws?.length) return json({ error: "raws_fetch_failed", detail: rErr?.message }, 500);

  regiaoId = regiaoId ?? raws[0].regiao_id;
  if (!regiaoId) return json({ error: "missing_regiao" }, 400);

  // 2. Chamar Lovable AI Gateway
  const userPrompt = buildUserPrompt(raws);
  const aiRes = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
  if (!aiRes.ok) {
    const t = await aiRes.text();
    return json({ error: "ai_gateway_error", status: aiRes.status, detail: t.slice(0, 500) }, 502);
  }

  const aiJson = await aiRes.json();
  const content = aiJson?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "ai_empty_response" }, 502);

  let parsed: GeneratedPayload;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  const slug = slugify(parsed.titulo);

  // 3. Persistir extracted_facts (se houver cluster)
  if (clusterId && parsed.fatos) {
    await sb.from("extracted_facts").insert({
      cluster_id: clusterId,
      quem: parsed.fatos.quem ?? null,
      o_que: parsed.fatos.o_que ?? null,
      quando: parsed.fatos.quando ?? null,
      onde: parsed.fatos.onde ?? null,
      por_que: parsed.fatos.por_que ?? null,
      dados: parsed.fatos.dados ?? {},
      citacoes: parsed.fatos.citacoes ?? [],
      fontes: raws.map((r) => ({ url: r.url, veiculo: r.fontes?.nome ?? r.fontes?.dominio })),
    });
  }

  // 4. Persistir generated_articles (rascunho)
  const { data: inserted, error: insErr } = await sb
    .from("generated_articles")
    .insert({
      cluster_id: clusterId,
      regiao_id: regiaoId,
      categoria_id: categoriaId,
      slug,
      titulo: parsed.titulo,
      subtitulo: parsed.subtitulo ?? null,
      resumo: parsed.resumo ?? null,
      corpo: parsed.corpo,
      seo_title: parsed.seo_title ?? parsed.titulo,
      seo_description: parsed.seo_description ?? parsed.resumo ?? null,
      cidade_principal: parsed.cidade_principal ?? null,
      cidades_mencionadas: parsed.cidades_mencionadas ?? [],
      status: "rascunho",
    })
    .select("id, slug")
    .single();

  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  // 5. Marcar raws como processados
  await sb.from("raw_articles").update({ processado: true }).in("id", rawIds);

  return json({ ok: true, article: inserted, model: MODEL });
});

type GeneratedPayload = {
  titulo: string;
  subtitulo?: string;
  resumo?: string;
  corpo: string;
  seo_title?: string;
  seo_description?: string;
  cidade_principal?: string | null;
  cidades_mencionadas?: string[];
  fatos?: {
    quem?: string;
    o_que?: string;
    quando?: string;
    onde?: string;
    por_que?: string;
    como?: string;
    dados?: Record<string, unknown>;
    citacoes?: Array<{ autor?: string; texto?: string }>;
  };
};

function buildUserPrompt(raws: Array<{ url: string; titulo: string | null; corpo_limpo: string | null; fontes?: { nome?: string; dominio?: string } | null }>) {
  const sources = raws
    .map((r, i) => {
      const veiculo = r.fontes?.nome ?? r.fontes?.dominio ?? "fonte";
      return `--- FONTE ${i + 1} (${veiculo}) ---\nURL: ${r.url}\nTítulo: ${r.titulo ?? ""}\n\n${(r.corpo_limpo ?? "").slice(0, 8000)}`;
    })
    .join("\n\n");

  return `Abaixo estão ${raws.length} matéria(s) fonte sobre o mesmo fato. Produza a reportagem única no schema JSON:

{
  "titulo": "string até 90 chars",
  "subtitulo": "string até 160 chars",
  "resumo": "2-3 frases autocontidas",
  "corpo": "texto em markdown, 4-8 parágrafos curtos, com seção final ### Fontes listando os veículos",
  "seo_title": "string até 60 chars",
  "seo_description": "string até 155 chars",
  "cidade_principal": "nome da cidade paranaense onde o fato ocorreu (string) ou null se não aplicável",
  "cidades_mencionadas": ["cidades adicionais citadas nas fontes"],
  "fatos": {
    "quem": "string",
    "o_que": "string",
    "quando": "string ISO ou descritivo",
    "onde": "string com cidade/região",
    "por_que": "string",
    "como": "string",
    "dados": { "chave": "valor numérico ou textual" },
    "citacoes": [{ "autor": "Nome (cargo)", "texto": "citação literal entre aspas" }]
  }
}

FONTES:
${sources}`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}