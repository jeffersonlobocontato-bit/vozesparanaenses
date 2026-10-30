// Vozes Paranaenses — publish-article
// Card "Publicar matéria" do /admin/painel.
//
// DIFERENÇA FUNDAMENTAL para `manual-article`: aqui a IA NÃO reescreve nada.
// O texto enviado pelo editor é gravado LITERALMENTE em `corpo`. A IA é usada
// apenas para preencher os metadados de SEO/GEO/AEO (seo_title,
// seo_description, resumo, tl;dr, 5W1H, FAQ, cidade principal e cidades
// mencionadas) a partir do texto que já veio pronto.

import { exigirEquipe } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gerarMetadados, MODEL_METADADOS } from "../_shared/metadados-artigo.ts";
import { garantirPreviaLeve } from "../_shared/previa-leve.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = MODEL_METADADOS;

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



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirEquipe(req);
    if (negado) return negado;
  }
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
  if (row.og_image_url) await garantirPreviaLeve(sb, inserted.id, row.og_image_url as string);

  return json({ ok: true, article: inserted, slug: inserted.slug, publicado: publicar, model: MODEL });
});

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
