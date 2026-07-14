// Vozes Paranaenses — vitrine-pessoal-criar
// Recebe o formulário do profissional liberal, valida o filtro
// pessoa/empresa, redige o rascunho com o agente de IA em modo "vitrine
// pessoal", e devolve o token único de edição (sem precisar de login).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

type Payload = {
  nome_cliente: string; contato: string; profissao: string;
  sobre_pessoa_ou_empresa: "pessoa" | "empresa";
  regiao_id: string; categoria_id?: string | null; briefing_texto: string;
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
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.nome_cliente || !body.contato || !body.profissao || !body.regiao_id || !body.briefing_texto) {
    return json({ error: "campos_obrigatorios_faltando" }, 400);
  }

  if (body.sobre_pessoa_ou_empresa !== "pessoa") {
    return json({
      error: "produto_nao_aplicavel",
      redirecionar_para: "chat_comercial",
      mensagem: "A Vitrine Pessoal é exclusiva para profissional liberal falando sobre o próprio trabalho. Para empresa, temos pacotes de publieditorial e combos — fale com nosso comercial.",
    }, 422);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: agente } = await sb
    .from("agente_vitrine_pessoal")
    .select("instrucoes_base")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  const systemPrompt = agente?.instrucoes_base ??
    "Você é o redator da Vitrine Pessoal do Vozes Paranaenses. Use somente o briefing, tom pessoal e caloroso. Retorne APENAS JSON.";

  const userPrompt = `Profissional: ${body.nome_cliente} — ${body.profissao}

Briefing fornecido (use SOMENTE isto — não invente nada além):
"""
${body.briefing_texto}
"""

Redija a Vitrine Pessoal no schema JSON:
{
  "titulo": "string até 90 chars",
  "subtitulo": "string até 160 chars",
  "resumo": "2-3 frases autocontidas",
  "corpo": "texto em markdown, 4-6 parágrafos curtos",
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
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  const slug = slugify(parsed.titulo);

  const { data: article, error: insErr } = await sb
    .from("generated_articles")
    .insert({
      regiao_id: body.regiao_id,
      categoria_id: body.categoria_id ?? null,
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
    .select("id")
    .single();

  if (insErr || !article) return json({ error: "article_insert_failed", detail: insErr?.message }, 500);

  const { data: pedido, error: pedErr } = await sb
    .from("vitrine_pessoal_pedidos")
    .insert({
      nome_cliente: body.nome_cliente,
      contato: body.contato,
      profissao: body.profissao,
      sobre_pessoa_ou_empresa: "pessoa",
      regiao_id: body.regiao_id,
      categoria_id: body.categoria_id ?? null,
      briefing_texto: body.briefing_texto,
      generated_article_id: article.id,
      status: "aguardando_edicao",
      metodo_pagamento: "pix_manual",
    })
    .select("token")
    .single();

  if (pedErr || !pedido) return json({ error: "pedido_insert_failed", detail: pedErr?.message }, 500);

  return json({ ok: true, token: pedido.token });
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
