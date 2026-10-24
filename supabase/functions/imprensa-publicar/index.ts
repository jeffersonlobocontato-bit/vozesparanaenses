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

type Cidade = { id: string; nome: string; regiao_id: string | null };

function normalizar(v: string): string {
  return ` ${v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

async function resolverCidade(
  // deno-lint-ignore no-explicit-any
  sb: any,
  cliente: { cidade_id?: string | null; nome_empresa?: string | null },
  titulo: string,
  corpo: string,
): Promise<Cidade | null> {
  if (cliente.cidade_id) {
    const { data } = await sb.from("cidades").select("id, nome, regiao_id").eq("id", cliente.cidade_id).maybeSingle();
    if (data) return data as Cidade;
  }
  const { data: cidades } = await sb.from("cidades").select("id, nome, regiao_id");
  // Nome mais longo primeiro: "Santa Terezinha de Itaipu" antes de "Itaipu".
  const lista = ((cidades ?? []) as Cidade[])
    .map((c) => ({ c, n: normalizar(c.nome) }))
    .sort((a, b) => b.n.length - a.n.length);
  for (const texto of [cliente.nome_empresa ?? "", titulo, corpo]) {
    const t = normalizar(texto);
    let melhor: { c: Cidade; pos: number } | null = null;
    for (const { c, n } of lista) {
      const pos = t.indexOf(n);
      if (pos >= 0 && (!melhor || pos < melhor.pos)) melhor = { c, pos };
    }
    if (melhor) return melhor.c;
  }
  return null;
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

  const { data: artigo, error: insertErr } = await sb
    .from("generated_articles")
    .insert({
      titulo: body.titulo.trim(),
      subtitulo: body.subtitulo?.trim() ?? null,
      slug: slugFinal,
      corpo: body.corpo.trim(),
      categoria_id: submissao.categoria_detectada_id,
      regiao_id: regiaoId,
      cidade_principal: cidade?.nome ?? null,
      imagem_capa_url: body.fotos?.[0]?.url ?? null,
      og_image_url: body.fotos?.[0]?.url ?? null,
      imagem_galeria: body.fotos ?? [],
      seo_title: body.titulo.trim(),
      seo_description: body.subtitulo?.trim() || null,
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
