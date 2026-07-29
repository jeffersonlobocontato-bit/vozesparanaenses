// Vozes Paranaenses — publish-article
// Card "Publicar matéria" do /admin/painel.
//
// DIFERENÇA FUNDAMENTAL para `manual-article`: aqui a IA NÃO reescreve nada.
// O texto enviado pelo editor é gravado LITERALMENTE em `corpo`. A IA é usada
// apenas para preencher os metadados de SEO/GEO/AEO (seo_title,
// seo_description, resumo, tl;dr, 5W1H, FAQ, cidade principal e cidades
// mencionadas) a partir do texto que já veio pronto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Payload = {
  regiao_id: string;
  categoria_id: string;
  titulo: string;
  texto: string;
  subtitulo?: string;
  publicar?: boolean;
  imagem_capa_url?: string;
  imagem_legenda?: string;
  imagem_credito?: string;
  video_url?: string;
  fonte_url?: string;
};

const SYSTEM = `Você é o editor de SEO/GEO do portal regional paranaense "Vozes Paranaenses".
Você recebe uma matéria JÁ ESCRITA e FECHADA por um jornalista humano.

REGRA ABSOLUTA: você NÃO reescreve, NÃO resume dentro do corpo, NÃO corrige e
NÃO altera o texto da matéria. Seu trabalho é apenas EXTRAIR e MONTAR os
metadados de indexação a partir do que está escrito.

Nunca invente fatos, nomes, números ou datas que não estejam no texto.
Se uma informação não existir no texto, retorne null (ou array vazio).

Retorne APENAS JSON válido, sem markdown, exatamente neste schema:
{
  "seo_title": "até 60 caracteres, com a palavra-chave principal",
  "seo_description": "até 155 caracteres, descritivo, sem clickbait",
  "resumo": "2-3 frases autocontidas para redes sociais",
  "tldr": "2-3 frases curtas respondendo direto 'o que aconteceu?' (answer-first para AI Overviews)",
  "fatos_5w1h": { "quem": null, "o_que": null, "quando": null, "onde": null, "por_que": null, "como": null },
  "faq": [{ "pergunta": "...", "resposta": "1-3 frases baseadas SOMENTE no texto" }],
  "cidade_principal": "cidade paranaense central da notícia ou null",
  "cidades_mencionadas": ["outras cidades citadas"]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!extUrl || !extKey) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  const titulo = (body.titulo ?? "").trim();
  const texto = (body.texto ?? "").trim();
  if (!body.regiao_id) return json({ error: "missing_regiao_id" }, 400);
  if (!body.categoria_id) return json({ error: "missing_categoria_id" }, 400);
  if (!titulo) return json({ error: "missing_titulo" }, 400);
  if (texto.length < 120) {
    return json({ error: "texto_muito_curto", hint: "Cole ao menos 120 caracteres do texto final." }, 422);
  }

  const sb = createClient(extUrl, extKey, { auth: { persistSession: false } });

  // 1. IA só para metadados — o corpo continua exatamente como o editor escreveu.
  const meta = await gerarMetadados(titulo, texto, aiKey);
  if ("error" in meta) return json(meta, meta.httpStatus ?? 502);

  // 2. Slug único por região
  const baseSlug = slugify(titulo);
  let slug = baseSlug;
  {
    const { data: existing } = await sb
      .from("generated_articles")
      .select("id")
      .eq("regiao_id", body.regiao_id)
      .eq("slug", baseSlug)
      .maybeSingle();
    if (existing) slug = `${baseSlug}-${Date.now().toString(36).slice(-5)}`;
  }

  const agora = new Date().toISOString();
  const publicar = body.publicar !== false; // padrão do card é publicar

  const row: Record<string, unknown> = {
    regiao_id: body.regiao_id,
    categoria_id: body.categoria_id,
    slug,
    titulo,
    subtitulo: body.subtitulo?.trim() || null,
    corpo: texto, // ← LITERAL, sem passar pela IA
    resumo: meta.resumo ?? null,
    seo_title: meta.seo_title ?? titulo,
    seo_description: meta.seo_description ?? meta.resumo ?? null,
    tldr: meta.tldr ?? null,
    fatos_5w1h: meta.fatos_5w1h ?? null,
    faq: Array.isArray(meta.faq) ? meta.faq : [],
    cidade_principal: meta.cidade_principal ?? null,
    cidades_mencionadas: Array.isArray(meta.cidades_mencionadas) ? meta.cidades_mencionadas : [],
    status: publicar ? "publicado" : "rascunho",
  };
  if (publicar) row.publicado_em = agora;
  if (body.imagem_capa_url?.trim()) {
    row.imagem_capa_url = body.imagem_capa_url.trim();
    row.og_image_url = body.imagem_capa_url.trim();
  }
  if (body.imagem_legenda?.trim()) row.imagem_legenda = body.imagem_legenda.trim();
  if (body.imagem_credito?.trim()) row.imagem_credito = body.imagem_credito.trim();
  if (body.video_url?.trim()) row.video_url = body.video_url.trim();

  const { data: inserted, error: insErr } = await sb
    .from("generated_articles")
    .insert(row)
    .select("id, slug, titulo, status")
    .single();
  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  return json({ ok: true, article: inserted, slug: inserted.slug, publicado: publicar, model: MODEL });
});

type Meta = {
  seo_title?: string | null;
  seo_description?: string | null;
  resumo?: string | null;
  tldr?: string | null;
  fatos_5w1h?: Record<string, unknown> | null;
  faq?: Array<{ pergunta: string; resposta: string }>;
  cidade_principal?: string | null;
  cidades_mencionadas?: string[];
};

async function gerarMetadados(
  titulo: string,
  texto: string,
  aiKey: string,
): Promise<Meta | { error: string; detail?: string; status?: number; httpStatus?: number }> {
  const userPrompt = `TÍTULO: ${titulo}\n\nTEXTO FINAL DA MATÉRIA (não altere, apenas leia):\n"""\n${texto.slice(0, 24000)}\n"""`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (e) {
      if (attempt === 2) return { error: "ai_network_error", detail: String(e), httpStatus: 502 };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) return { error: "rate_limited", httpStatus: 429 };
    if (res.status === 402) return { error: "ai_credits_exhausted", httpStatus: 402 };
    if (!res.ok) {
      const t = await res.text();
      if (attempt === 2) return { error: "ai_gateway_error", status: res.status, detail: t.slice(0, 400), httpStatus: 502 };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(String(content).replace(/^```json\s*|```$/g, "").trim()) as Meta;
    } catch {
      if (attempt === 2) return { error: "ai_invalid_json", detail: String(content).slice(0, 300), httpStatus: 502 };
    }
  }
  return { error: "ai_failed", httpStatus: 502 };
}

function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
