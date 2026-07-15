// Vozes Paranaenses — generate-publieditorial
// Gera uma matéria de publieditorial a partir de um BRIEFING de anunciante
// (não de fonte raspada). Sempre cai em 'rascunho' — publieditorial nunca
// publica sozinho, é sempre revisão humana, por ser conteúdo comercial.
//
// Prompt = núcleo comum de conteúdo pago (nucleo_conteudo_pago) + o
// diferencial específico deste agente (agente_publieditorial).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

type Payload = { briefing_id: string };

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
  if (!body.briefing_id) return json({ error: "missing_briefing_id" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: briefing, error: bErr } = await sb
    .from("publieditorial_briefings")
    .select("id, campaign_id, regiao_id, categoria_id, status, nome_anunciante, o_que_faz, contexto_mercado, diferenciais, evidencias, impacto_leitor, cta_texto, link_destino")
    .eq("id", body.briefing_id)
    .maybeSingle();
  if (bErr || !briefing) return json({ error: "briefing_not_found", detail: bErr?.message }, 404);
  if (briefing.status === "gerado") return json({ error: "briefing_ja_gerado" }, 409);

  const { data: campaign } = await sb
    .from("ad_campaigns")
    .select("id, nome, advertiser:advertiser_id(nome)")
    .eq("id", briefing.campaign_id)
    .maybeSingle();
  const advertiserNome = Array.isArray(campaign?.advertiser)
    ? campaign?.advertiser[0]?.nome
    : campaign?.advertiser?.nome;

  // Núcleo comum de conteúdo pago + diferencial específico deste agente
  const [{ data: nucleo }, { data: agente }] = await Promise.all([
    sb.from("nucleo_conteudo_pago").select("instrucoes").eq("ativo", true).limit(1).maybeSingle(),
    sb.from("agente_publieditorial").select("instrucoes_base").eq("ativo", true).limit(1).maybeSingle(),
  ]);
  const systemPrompt = [nucleo?.instrucoes, agente?.instrucoes_base]
    .filter((s) => s?.trim())
    .join("\n\n---\n\n") ||
    "Você é o redator de Publieditorial do Vozes Paranaenses. Use somente o briefing fornecido, tom jornalístico, sem apelo comercial exagerado. Retorne APENAS JSON.";

  const userPrompt = `Anunciante: ${briefing.nome_anunciante ?? advertiserNome ?? "não informado"}
Campanha: ${campaign?.nome ?? "não informada"}

Entrevista estruturada respondida pelo anunciante (use SOMENTE isto — não invente nada além):

1. TESE — o que faz / quem é:
"""${briefing.o_que_faz ?? "não informado"}"""

2. CONTEXTO — mercado/cenário em que atua:
"""${briefing.contexto_mercado ?? "não informado"}"""

3. EXPANSÃO — diferenciais:
"""${briefing.diferenciais ?? "não informado"}"""

4. EVIDÊNCIAS — dados, prêmios, cases (só o que for comprovável):
"""${briefing.evidencias ?? "não informado"}"""

5. IMPACTO — benefício prático pro leitor:
"""${briefing.impacto_leitor ?? "não informado"}"""

6. FECHAMENTO — chamada para ação e link/contato:
"""${briefing.cta_texto ?? "não informado"}${briefing.link_destino ? ` — ${briefing.link_destino}` : ""}"""

Redija o publieditorial seguindo essa mesma progressão (Tese → Contexto → Expansão → Evidências → Impacto → Fechamento), no schema JSON:
{
  "titulo": "string até 90 chars, sem soar como propaganda óbvia",
  "subtitulo": "string até 160 chars",
  "resumo": "2-3 frases autocontidas",
  "corpo": "texto em markdown — mais completo (6-9 parágrafos) se as respostas forem ricas em detalhes; só o essencial se as respostas forem breves — nunca invente pra alcançar um número de parágrafos",
  "seo_title": "string até 60 chars",
  "seo_description": "string até 155 chars"
}`;

  const aiRes = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
  if (!aiRes.ok) {
    const t = await aiRes.text();
    await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: t.slice(0, 500) }).eq("id", briefing.id);
    return json({ error: "ai_gateway_error", status: aiRes.status, detail: t.slice(0, 500) }, 502);
  }

  const aiJson = await aiRes.json();
  const content = aiJson?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "ai_empty_response" }, 502);

  let parsed: {
    titulo: string; subtitulo?: string; resumo?: string; corpo: string;
    seo_title?: string; seo_description?: string;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: "ai_invalid_json" }).eq("id", briefing.id);
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  const slug = slugify(parsed.titulo);

  const { data: inserted, error: insErr } = await sb
    .from("generated_articles")
    .insert({
      regiao_id: briefing.regiao_id,
      categoria_id: briefing.categoria_id ?? null,
      campaign_id: briefing.campaign_id,
      slug,
      titulo: parsed.titulo,
      subtitulo: parsed.subtitulo ?? null,
      resumo: parsed.resumo ?? null,
      corpo: parsed.corpo,
      seo_title: parsed.seo_title ?? parsed.titulo,
      seo_description: parsed.seo_description ?? parsed.resumo ?? null,
      tipo_conteudo: "institucional",
      status: "rascunho",
    })
    .select("id, slug")
    .single();

  if (insErr) {
    await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: insErr.message }).eq("id", briefing.id);
    return json({ error: "insert_failed", detail: insErr.message }, 500);
  }

  await sb.from("publieditorial_briefings")
    .update({ status: "gerado", generated_article_id: inserted.id })
    .eq("id", briefing.id);

  return json({ ok: true, article: inserted, model: MODEL, titulo: parsed.titulo });
});

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
