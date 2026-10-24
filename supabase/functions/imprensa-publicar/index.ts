// Vozes Paranaenses — imprensa-publicar
// Publica a matéria revisada pelo cliente. Exige aceite explícito do termo
// de responsabilidade (registra hora, IP e o texto exato aceito) — sem
// isso, não publica.
//
// Publica direto no ar e devolve o link da matéria (o cliente compartilha
// em seguida). A primeira foto de `fotos` é a principal (capa); as demais
// vão para a galeria.
//
// Body: { submissao_id, titulo, subtitulo, corpo, fotos, termo_aceito: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { gerarMetadados, type Meta } from "../_shared/metadados-artigo.ts";
import { resolverCidade } from "../_shared/imprensa-cidade.ts";

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
    .select("id, ativo, status, nome_empresa, cidade_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!cliente || !cliente.ativo) return json({ error: "cliente_sem_acesso" }, 403);
  if (cliente.status !== "aprovado") {
    return json({ error: "cadastro_pendente", detail: "Seu cadastro ainda está em análise. A publicação é liberada assim que a equipe aprovar." }, 403);
  }

  let body: {
    submissao_id?: string; titulo?: string; subtitulo?: string; corpo?: string;
    fotos?: Array<{ url: string; legenda?: string }>; termo_aceito?: boolean; regiao_id?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  if (!body.termo_aceito) {
    return json({ error: "termo_nao_aceito", detail: "É preciso aceitar o termo de responsabilidade antes de publicar." }, 400);
  }
  if (!body.submissao_id || !body.titulo?.trim() || !body.corpo?.trim()) {
    return json({ error: "campos_obrigatorios_faltando", detail: "Falta título ou texto." }, 400);
  }

  // Região automática: a cidade da prefeitura do cadastro; sem ela (cliente
  // criado à mão), a cidade citada no nome do cliente, no título ou no texto.
  const cidade = await resolverCidade(sb, cliente, body.titulo!, body.corpo!);
  const regiaoId = cidade?.regiao_id ?? body.regiao_id ?? null;
  if (!regiaoId) {
    return json({ error: "cidade_nao_identificada", detail: "Não identificamos a cidade da matéria. Cite o nome do município no texto." }, 400);
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

  // SEO/GEO/AEO (seo, resumo, tl;dr, 5W1H, FAQ, cidades): a IA só lê o
  // texto revisado pelo cliente, não reescreve. Se falhar, publica assim mesmo
  // com o básico tirado do título/subtítulo.
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  let meta: Meta = {};
  if (aiKey) {
    const r = await gerarMetadados(body.titulo.trim(), body.corpo.trim(), aiKey);
    if (!("error" in r)) meta = r;
  }
  const cidadesMencionadas = Array.from(new Set([
    ...(cidade ? [cidade.nome] : []),
    ...(Array.isArray(meta.cidades_mencionadas) ? meta.cidades_mencionadas : []),
  ]));
  const capa = body.fotos?.[0]?.url ?? null;

  // Fixação: a matéria da prefeitura fica fixada para os leitores da própria
  // cidade (manchete se tiver foto, senão 1º da coluna da direita). A anterior
  // do mesmo cliente sai da fixação para não acumular.
  if (cidade) {
    await sb.from("generated_articles")
      .update({ fixado_posicao: null, fixado_escopo: null, fixado_cidades: [] })
      .eq("origem_imprensa_cliente_id", cliente.id)
      .eq("fixado_escopo", "cidades");
  }

  const { data: artigo, error: insertErr } = await sb
    .from("generated_articles")
    .insert({
      titulo: body.titulo.trim(),
      subtitulo: body.subtitulo?.trim() ?? null,
      slug: slugFinal,
      corpo: body.corpo.trim(),
      categoria_id: submissao.categoria_detectada_id,
      regiao_id: regiaoId,
      cidade_principal: cidade?.nome ?? meta.cidade_principal ?? null,
      cidades_mencionadas: cidadesMencionadas,
      imagem_capa_url: capa,
      og_image_url: capa,
      imagem_credito: capa ? `Foto: ${cliente.nome_empresa}` : null,
      imagem_galeria: body.fotos ?? [],
      seo_title: meta.seo_title ?? body.titulo.trim().slice(0, 70),
      seo_description: meta.seo_description ?? (body.subtitulo?.trim() || null),
      resumo: meta.resumo ?? (body.subtitulo?.trim() || null),
      tldr: meta.tldr ?? null,
      fatos_5w1h: meta.fatos_5w1h ?? null,
      faq: Array.isArray(meta.faq) ? meta.faq : [],
      ...(cidade
        ? { fixado_escopo: "cidades", fixado_cidades: [cidade.slug], fixado_regioes: [], fixado_posicao: capa ? 0 : 1 }
        : {}),
      status: "publicado",
      publicado_em: new Date().toISOString(),
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
    status: "publicado",
    generated_article_id: artigo.id,
    atualizado_em: new Date().toISOString(),
  }).eq("id", submissao.id);

  const { data: regiao } = await sb.from("regioes").select("slug").eq("id", regiaoId).maybeSingle();

  return json({
    ok: true,
    status: "publicado",
    detail: "Matéria publicada.",
    article_id: artigo.id,
    slug: artigo.slug,
    regiao_slug: regiao?.slug ?? null,
  });
});
