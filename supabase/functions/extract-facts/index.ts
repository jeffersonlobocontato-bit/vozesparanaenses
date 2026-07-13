// Vozes Paranaenses — extract-facts
// Etapa 1 de 2 do pipeline editorial (separada de generate-article em
// 2026-07): recebe { cluster_id } (ou { raw_article_ids }), extrai
// RIGOROSAMENTE os fatos (5W1H) das fontes via IA — sem redigir nada —
// e grava em `extracted_facts`. Marca o cluster como 'fatos_extraidos'.
//
// Por quê separado de generate-article: permite auditar/validar os fatos
// extraídos antes de gastar uma segunda chamada de IA redigindo a matéria,
// e permite reaproveitar o mesmo fato-base para gerar variações (ex.:
// versão curta para WhatsApp) sem reextrair.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Você é um apurador de fatos do portal regional "Vozes Paranaenses".
Sua ÚNICA tarefa: ler matérias-fonte sobre o MESMO fato e extrair os fatos
estruturados — você NÃO redige manchete, NÃO escreve corpo de matéria,
NÃO produz FAQ. Apenas extração factual.

REGRAS INEGOCIÁVEIS:
1. NUNCA invente fatos, nomes, números, datas, cargos ou citações.
2. Só afirme o que estiver explicitamente nas fontes.
3. Se as fontes divergirem entre si num ponto, registre a divergência em vez
   de escolher uma versão arbitrariamente (ex.: "quem": "Prefeitura afirma X;
   moradores afirmam Y").
4. Se um campo não puder ser determinado com segurança pelas fontes, retorne
   null nesse campo — não tente adivinhar.
5. Citações devem ser cópia literal do texto-fonte, nunca paráfrase.

Retorne APENAS JSON válido, sem markdown, no schema fornecido.`;

type Payload = { cluster_id?: string; raw_article_ids?: string[] };

type FactsPayload = {
  quem?: string | null;
  o_que?: string | null;
  quando?: string | null;
  onde?: string | null;
  por_que?: string | null;
  como?: string | null;
  cidade_principal?: string | null;
  cidades_mencionadas?: string[];
  dados?: Record<string, unknown>;
  citacoes?: Array<{ autor?: string; texto?: string }>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  // 1. Resolver artigos-fonte (mesma lógica do generate-article original)
  let rawIds: string[] = [];
  const clusterId = body.cluster_id ?? null;
  let regiaoId: string | null = null;
  let categoriaId: string | null = null;

  if (clusterId) {
    const { data: cluster, error: cErr } = await sb
      .from("article_clusters")
      .select("id, regiao_id, categoria_id, status")
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
    .select("id, url, titulo, corpo_limpo, regiao_id, fontes:fonte_id(id, nome, url_base)")
    .in("id", rawIds);
  if (rErr || !raws?.length) return json({ error: "raws_fetch_failed", detail: rErr?.message }, 500);

  regiaoId = regiaoId ?? raws[0].regiao_id;
  if (!regiaoId) return json({ error: "missing_regiao" }, 400);

  // 2. Chamar IA — só para extração de fatos
  const userPrompt = buildUserPrompt(raws);
  const aiRes = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 1200,
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
  const choiceError = aiJson?.choices?.[0]?.error;
  if (choiceError) {
    return json({ error: "ai_choice_error", detail: choiceError?.message ?? "Modelo encerrou sem JSON." }, 502);
  }
  const content = aiJson?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "ai_empty_response" }, 502);

  let parsed: FactsPayload;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  // 3. Persistir extracted_facts
  const fontesResumo = raws.map((r) => ({ url: r.url, veiculo: r.fontes?.nome ?? r.fontes?.url_base }));
  const { data: inserted, error: insErr } = await sb
    .from("extracted_facts")
    .insert({
      cluster_id: clusterId,
      quem: parsed.quem ?? null,
      o_que: parsed.o_que ?? null,
      quando: parsed.quando ?? null,
      onde: parsed.onde ?? null,
      por_que: parsed.por_que ?? null,
      dados: { ...(parsed.dados ?? {}), como: parsed.como ?? null, cidade_principal: parsed.cidade_principal ?? null, cidades_mencionadas: parsed.cidades_mencionadas ?? [] },
      citacoes: parsed.citacoes ?? [],
      fontes: fontesResumo,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: "insert_facts_failed", detail: insErr.message }, 500);

  // 4. Marcar cluster como fatos_extraidos, com timestamp para o Painel de Pauta
  if (clusterId) {
    await sb
      .from("article_clusters")
      .update({ status: "fatos_extraidos", fatos_extraidos_em: new Date().toISOString() })
      .eq("id", clusterId);
  }

  return json({
    ok: true,
    extracted_facts_id: inserted?.id,
    cluster_id: clusterId,
    regiao_id: regiaoId,
    categoria_id: categoriaId,
    fatos: parsed,
    model: MODEL,
  });
});

function buildUserPrompt(raws: Array<{ url: string; titulo: string | null; corpo_limpo: string | null; fontes?: { nome?: string; url_base?: string } | null }>) {
  const sources = raws
    .map((r, i) => {
      const veiculo = r.fontes?.nome ?? r.fontes?.url_base ?? "fonte";
      return `--- FONTE ${i + 1} (${veiculo}) ---\nURL: ${r.url}\nTítulo: ${r.titulo ?? ""}\n\n${(r.corpo_limpo ?? "").slice(0, 4500)}`;
    })
    .join("\n\n");

  return `Abaixo estão ${raws.length} matéria(s) fonte sobre o mesmo fato. Extraia APENAS os fatos, no schema JSON:

{
  "quem": "string ou null",
  "o_que": "string ou null",
  "quando": "string ISO ou descritivo, ou null",
  "onde": "string com cidade/região, ou null",
  "por_que": "string ou null",
  "como": "string ou null",
  "cidade_principal": "nome da cidade paranaense onde o fato ocorreu, ou null",
  "cidades_mencionadas": ["cidades adicionais citadas nas fontes"],
  "dados": { "chave": "valor numérico ou textual relevante" },
  "citacoes": [{ "autor": "Nome (cargo)", "texto": "citação LITERAL entre aspas, copiada da fonte" }]
}

FONTES:
${sources}`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
