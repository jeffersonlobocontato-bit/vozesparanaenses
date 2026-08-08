// Vozes Paranaenses — imprensa-publicar
// Publica a matéria revisada pelo cliente. Exige aceite explícito do termo
// de responsabilidade (registra hora, IP e o texto exato aceito) — sem
// isso, não publica.
//
// Por padrão sai como "aguardando_aprovacao", não publicado direto — essa
// é a decisão mais segura até ficar definido se algum cliente terá
// publicação automática liberada.
//
// Body: { submissao_id, titulo, subtitulo, corpo, fotos, termo_aceito: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TERMO_RESPONSABILIDADE =
  'Ao clicar em "Publicar", você declara que é o autor ou representante legal autorizado da fonte deste conteúdo e assume, de forma pessoal e exclusiva, integral responsabilidade civil e criminal pela veracidade, exatidão e legalidade das informações aqui apresentadas — nos termos dos artigos 186 e 927 do Código Civil e dos artigos 138 a 140 do Código Penal. O Vozes Paranaenses atua como provedor de aplicação de internet nos termos do art. 19 da Lei 12.965/2014, sem verificação editorial prévia do conteúdo fornecido pelo cliente.';

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "content-type": "application/json" } });
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing_external_supabase_env" }, 500);

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: cliente } = await sb
    .from("clientes_imprensa")
    .select("id, ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!cliente || !cliente.ativo) return json({ error: "cliente_sem_acesso" }, 403);

  let body: {
    submissao_id?: string; titulo?: string; subtitulo?: string; corpo?: string;
    fotos?: Array<{ url: string; legenda?: string }>; termo_aceito?: boolean; regiao_id?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  if (!body.termo_aceito) {
    return json({ error: "termo_nao_aceito", detail: "É preciso aceitar o termo de responsabilidade antes de publicar." }, 400);
  }
  if (!body.submissao_id || !body.titulo?.trim() || !body.corpo?.trim() || !body.regiao_id) {
    return json({ error: "campos_obrigatorios_faltando", detail: "Falta título, corpo ou região." }, 400);
  }

  const { data: submissao, error: subErr } = await sb
    .from("imprensa_submissoes")
    .select("id, categoria_detectada_id, cliente_id")
    .eq("id", body.submissao_id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();
  if (subErr || !submissao) return json({ error: "submissao_nao_encontrada" }, 404);
  if (!submissao.categoria_detectada_id) return json({ error: "sem_categoria_detectada" }, 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Gera slug único (retry com sufixo, mesmo padrão do generate-article).
  const base = slugify(body.titulo);
  let slugFinal = base;
  for (let i = 0; i < 5; i++) {
    const { data: existe } = await sb.from("generated_articles").select("id").eq("slug", slugFinal).maybeSingle();
    if (!existe) break;
    slugFinal = `${base}-${i + 2}`;
  }

  const { data: artigo, error: insertErr } = await sb
    .from("generated_articles")
    .insert({
      titulo: body.titulo.trim(),
      subtitulo: body.subtitulo?.trim() ?? null,
      slug: slugFinal,
      corpo: body.corpo.trim(),
      categoria_id: submissao.categoria_detectada_id,
      regiao_id: body.regiao_id,
      imagem_capa_url: body.fotos?.[0]?.url ?? null,
      imagem_galeria: body.fotos ?? [],
      status: "rascunho",
      origem_imprensa_cliente_id: cliente.id,
      publicado_automaticamente: false,
      gerado_em: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (insertErr) return json({ error: "insert_artigo_failed", detail: insertErr.message }, 500);

  await sb.from("imprensa_submissoes").update({
    titulo_gerado: body.titulo.trim(),
    subtitulo_gerado: body.subtitulo?.trim() ?? null,
    corpo_gerado: body.corpo.trim(),
    fotos: body.fotos ?? [],
    termo_aceito_em: new Date().toISOString(),
    termo_aceito_ip: ip,
    termo_aceito_texto: TERMO_RESPONSABILIDADE,
    status: "aguardando_aprovacao",
    generated_article_id: artigo.id,
    atualizado_em: new Date().toISOString(),
  }).eq("id", submissao.id);

  return json({
    ok: true,
    status: "rascunho",
    detail: "Conteúdo enviado e aguardando aprovação rápida da equipe editorial (fila do painel) antes de ir ao ar.",
    article_id: artigo.id,
  });
});
