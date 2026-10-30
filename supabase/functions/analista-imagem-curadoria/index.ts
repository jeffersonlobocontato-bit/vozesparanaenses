// Vozes Paranaenses — analista-imagem-curadoria
//
// Garante pelo menos 1 matéria NACIONAL e 1 INTERNACIONAL (temas gerais e
// política — fora esportes e tecnologia) com imagem de risco baixo, para
// essas editorias também aparecerem na primeira dobra da home.
//
// A cada chamada, para cada editoria (nacional, internacional):
//   - se já há matéria dela com imagem e destaque na home nas últimas 12h,
//     não faz nada;
//   - senão, pega as matérias publicadas nas últimas 12h ainda sem imagem e
//     sem análise (até 3), e para cada uma:
//       1. a analista planeja (tema sensível? que lugar/instituição buscar?)
//       2. busca fotos de licença livre no Wikimedia Commons
//       3. a analista OLHA as fotos e dá nota de risco
//       4. usa a primeira de risco BAIXO; sem nenhuma, ilustração por IA
//          (se o tema não for sensível)
//     e para na primeira matéria que conseguir imagem.
// Toda análise fica gravada em generated_articles.imagem_analise.
//
// Agendado pela 075 (de meia em meia hora, das 8h às 22h).
// Body opcional: { article_id?: string } — analisa só essa matéria.

import { exigirInterno } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { avaliarFotos, escolherFotoBaixoRisco, planejarImagem, type AvaliacaoFoto } from "../_shared/analista-imagem.ts";
import { buscarCommonsTema, copiarImagemParaStorage, CREDITO_IA, ehTemaPolicial, gerarIlustracaoTematica, type FotoCandidata } from "../_shared/imagem.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ESCOPOS = ["nacional", "internacional"] as const;
const FORA = ["esportes", "tecnologia"];
const JANELA_MS = 12 * 3600_000;

type Materia = {
  id: string;
  titulo: string;
  resumo: string | null;
  regiao_id: string;
  categoria: { slug?: string } | { slug?: string }[] | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirInterno(req);
    if (negado) return negado;
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { article_id?: string; refazer?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Refazer a capa de UMA matéria (qualquer região), ex.: trocar a ilustração
  // antiga de IA pela regra nova (foto livre do tema › imagem realista de IA).
  if (body.article_id && body.refazer) {
    const { data: m } = await sb.from("generated_articles")
      .select("id, titulo, resumo, regiao_id, categoria:editorial_categories(slug), imagem_capa_url, og_image_url, imagem_credito, imagem_legenda")
      .eq("id", body.article_id).maybeSingle();
    if (!m) return json({ error: "materia_nao_encontrada" }, 404);
    const catRel = (m as unknown as Materia).categoria;
    const cat = Array.isArray(catRel) ? catRel[0]?.slug : catRel?.slug;
    const anterior = { imagem_capa_url: m.imagem_capa_url, og_image_url: m.og_image_url, imagem_credito: m.imagem_credito, imagem_legenda: m.imagem_legenda };
    const resultado = await analisarMateria(sb, aiKey, m as unknown as Materia, cat ?? "geral");
    if (resultado.decisao === "sem_imagem") {
      // Não deixa a matéria sem capa: mantém a anterior.
      await sb.from("generated_articles").update(anterior).eq("id", m.id);
    }
    return json({ ok: true, id: m.id, titulo: m.titulo, ...resultado });
  }
  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  const relatorio: Record<string, unknown> = {};

  const { data: regioes } = await sb.from("regioes").select("id, slug").in("slug", ESCOPOS as unknown as string[]);
  for (const escopo of ESCOPOS) {
    const regiaoId = (regioes ?? []).find((r: { slug: string }) => r.slug === escopo)?.id;
    if (!regiaoId) { relatorio[escopo] = "região não cadastrada"; continue; }

    if (!body.article_id) {
      const { count } = await sb.from("generated_articles")
        .select("id", { count: "exact", head: true })
        .eq("regiao_id", regiaoId).eq("status", "publicado").eq("destaque_home", true)
        .not("imagem_capa_url", "is", null).gte("publicado_em", desde);
      if ((count ?? 0) > 0) { relatorio[escopo] = "já tem matéria com imagem na dobra"; continue; }
    }

    let q = sb.from("generated_articles")
      .select("id, titulo, resumo, regiao_id, categoria:editorial_categories(slug)")
      .eq("regiao_id", regiaoId).eq("status", "publicado").is("imagem_capa_url", null)
      .order("publicado_em", { ascending: false }).limit(10);
    q = body.article_id ? q.eq("id", body.article_id) : q.is("imagem_analise", null).gte("publicado_em", desde);
    const { data: candidatas, error } = await q;
    if (error) { relatorio[escopo] = `erro: ${error.message}`; continue; }

    const elegiveis = ((candidatas ?? []) as Materia[]).filter((m) => {
      const cat = Array.isArray(m.categoria) ? m.categoria[0]?.slug : m.categoria?.slug;
      return !FORA.includes(cat ?? "");
    }).slice(0, 3);

    const tentativas: unknown[] = [];
    for (const m of elegiveis) {
      const resultado = await analisarMateria(sb, aiKey, m, escopo);
      tentativas.push({ id: m.id, titulo: m.titulo, ...resultado });
      if (resultado.decisao !== "sem_imagem") break;
    }
    relatorio[escopo] = tentativas.length ? tentativas : "nenhuma matéria elegível nas últimas 12h";
  }

  return json({ ok: true, relatorio });
});

async function analisarMateria(
  // deno-lint-ignore no-explicit-any
  sb: any,
  aiKey: string,
  m: Materia,
  escopo: string,
): Promise<{ decisao: "foto_commons" | "ilustracao_ia" | "sem_imagem"; motivo: string }> {
  const plano = await planejarImagem(aiKey, { titulo: m.titulo, resumo: m.resumo, escopo });
  const analise: Record<string, unknown> = { em: new Date().toISOString(), escopo, plano };

  const registrar = async (decisao: string, extra: Record<string, unknown> = {}) => {
    await sb.from("generated_articles").update({ imagem_analise: { ...analise, decisao, ...extra } }).eq("id", m.id);
  };

  if (plano.tema_sensivel) {
    await registrar("sem_imagem", { motivo: `tema sensível: ${plano.motivo}` });
    return { decisao: "sem_imagem", motivo: "tema sensível" };
  }

  // Fotos de licença livre do lugar/instituição.
  const candidatas: FotoCandidata[] = [];
  for (const busca of plano.buscas) {
    for (const f of await buscarCommonsTema(busca, 3)) {
      if (!candidatas.some((c) => c.url === f.url)) candidatas.push(f);
    }
  }
  const fotos = candidatas.slice(0, 4);
  let avaliacoes: AvaliacaoFoto[] = [];
  if (fotos.length) {
    avaliacoes = await avaliarFotos(aiKey, m, fotos);
    const i = escolherFotoBaixoRisco(avaliacoes);
    if (i !== null) {
      const foto = fotos[i];
      const capa = await copiarImagemParaStorage(sb, foto.url, `${m.id}/commons-${Date.now().toString(36)}.jpg`);
      if (capa) {
        await sb.from("generated_articles").update({
          imagem_capa_url: capa,
          og_image_url: capa,
          imagem_credito: foto.credito,
          imagem_legenda: `Imagem ilustrativa: ${foto.titulo.replace(/\.[a-z]+$/i, "").replace(/_/g, " ")}`,
          foto_origem: "commons_analista",
          destaque_home: true,
        }).eq("id", m.id);
        await registrar("foto_commons", { foto: { titulo: foto.titulo, licenca: foto.licenca, autor: foto.autor }, avaliacoes });
        return { decisao: "foto_commons", motivo: foto.titulo };
      }
    }
  }

  // Sem foto de risco baixo: ilustração por IA, só do tema — nunca em tema
  // policial (regra de 30/10/2026: polícia só com foto real).
  if (ehTemaPolicial(`${m.titulo}. ${m.resumo ?? ""}`)) {
    await registrar("sem_imagem", { motivo: "tema policial: sem ilustração de IA", avaliacoes });
    return { decisao: "sem_imagem", motivo: "tema policial: sem ilustração de IA" };
  }
  const ilustracao = await gerarIlustracaoTematica({ sb, aiKey, articleId: m.id, tema: `${m.titulo}. ${m.resumo ?? ""}` });
  if (ilustracao) {
    await sb.from("generated_articles").update({
      imagem_capa_url: ilustracao,
      og_image_url: ilustracao,
      imagem_credito: CREDITO_IA,
      imagem_legenda: "Imagem ilustrativa gerada por inteligência artificial",
      foto_origem: "ilustracao_ia",
      destaque_home: true,
    }).eq("id", m.id);
    await registrar("ilustracao_ia", { candidatas: fotos.map((f) => f.titulo), avaliacoes });
    return { decisao: "ilustracao_ia", motivo: fotos.length ? "nenhuma foto de risco baixo" : "nenhuma foto livre encontrada" };
  }

  await registrar("sem_imagem", { motivo: "falha ao gerar ilustração", avaliacoes });
  return { decisao: "sem_imagem", motivo: "falha ao gerar ilustração" };
}
