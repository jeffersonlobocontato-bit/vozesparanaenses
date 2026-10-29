// Vozes Paranaenses — classify-and-quota
// Para cada cluster novo:
//  1. Classifica a categoria editorial E o crivo editorial (tema/prioridade/
//     valor noticioso) numa única chamada de LLM barato — ver
//     ../_shared/crivo-editorial.ts.
//  2. Descarta o que não tem valor noticioso e o que REPETE um fato já
//     selecionado nas últimas 72h (cluster_duplicado, por centróide).
//  3. Aplica quota_rules por região × categoria (janela 7d). Estourou o
//     teto: marca forcar_nota — release de prefeitura vira NOTA na coluna
//     regional e notícia de portal é descartada (portal nunca vira nota) —,
//     exceto prioridade alta (serviço/saúde/educação/segurança/utilidade
//     pública), que sempre passa.
//
// Body opcional: { regiao_id?: string }

import { exigirInterno } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cabeNaCotaForaDoPr, CRIVO_PROMPT, CRIVO_SCHEMA, faixaForaDoPr, type FaixaForaDoPr, motivoDescartePortal, pareceReleaseDeAssessoria, parseCrivo, pesoPrioridade, type ResultadoCrivo } from "../_shared/crivo-editorial.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

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

  let body: { regiao_id?: string; sync?: boolean; limit?: number; cluster_ids?: string[] } = {};
  try { body = await req.json(); } catch { body = {}; }
  const limit = Math.max(1, Math.min(body.limit ?? 15, 50));
  const clusterIds = Array.isArray(body.cluster_ids)
    ? Array.from(new Set(body.cluster_ids.filter((id) => typeof id === "string" && id.length > 0))).slice(0, 200)
    : [];

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: cats } = await sb.from("editorial_categories").select("id, slug, nome, peso_engajamento");
  const categorias = (cats ?? []) as { id: string; slug: string; nome: string; peso_engajamento: number }[];
  if (!categorias.length) return json({ error: "no_categories_defined" }, 400);

  let cq = sb
    .from("article_clusters")
    .select("id, regiao_id, categoria_id, prioridade_score, criado_em, fonte_oficial, curadoria_nacional, regiao:regioes(slug)")
    .eq("status", "novo")
    // Curadoria de esportes já nasce com editoria (categoria_id) e também
    // passa pelo crivo — desde out/2026 ela publica sozinha nos ciclos.
    .or("categoria_id.is.null,curadoria_nacional.eq.true")
    .order("prioridade_score", { ascending: false })
    .limit(limit);
  if (body.regiao_id) cq = cq.eq("regiao_id", body.regiao_id);
  if (clusterIds.length) cq = cq.in("id", clusterIds);
  const { data: clusters, error } = await cq;
  if (error) return json({ error: "cluster_query_failed", detail: error.message }, 500);
  if (!clusters?.length) return json({ ok: true, classified: 0, selected: 0 });

  // A classificação de 50 clusters + escrita automática leva minutos (LLM
  // por cluster). O fetch do cliente (browser / curl) estoura antes de
  // terminar. Roda tudo em background via EdgeRuntime.waitUntil e responde
  // imediatamente — a fila editorial vai sendo populada aos poucos.
  const runPipeline = async () => {
    await processClusters({ clusters, categorias, sb, aiKey, url, key });
  };
  if (body.sync) {
    const result = await processClusters({ clusters, categorias, sb, aiKey, url, key });
    return json({ ok: true, ...result });
  }
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  const task = runPipeline().catch((e) => console.error("[classify-and-quota] background error", (e as Error).message));
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  return json({ ok: true, mode: "background", clusters: clusters.length });
});

async function processClusters(
  { clusters, categorias, sb, aiKey, url, key }: {
    clusters: Array<{ id: string; regiao_id: string; categoria_id?: string | null; prioridade_score: number; criado_em: string; fonte_oficial?: boolean; curadoria_nacional?: boolean }>;
    categorias: { id: string; slug: string; nome: string; peso_engajamento: number }[];
    // deno-lint-ignore no-explicit-any
    sb: any;
    aiKey: string;
    url: string;
    key: string;
  },
): Promise<Record<string, number>> {
  const _serve = null; // placeholder para manter escopo

  // 1. Classificar cada cluster (usa título do primeiro artigo do cluster)
  const classified: { id: string; regiao_id: string; categoria_id: string; score: number; curadoria_nacional: boolean; fonte_oficial: boolean; prioridade: string; foraDoPr: FaixaForaDoPr | null }[] = [];
  let semValor = 0;
  let descartesPortal = 0;
  for (const c of clusters) {
    // Se o cluster já está fincado em uma região do Paraná (pela detecção
    // de cidade no scrape-source), NUNCA classifica como nacional/
    // internacional — essas duas tags são exclusivas de clusters cuja
    // região é "nacional" ou "internacional". Sem essa trava, o LLM
    // manda muita notícia local pra nacional só porque o texto não cita
    // literalmente a palavra "Paraná".
    const regiaoSlug = (c as unknown as { regiao?: { slug?: string } }).regiao?.slug ?? "";
    const ehParanaense = !!regiaoSlug && regiaoSlug !== "nacional" && regiaoSlug !== "internacional";
    const categoriasElegiveis = ehParanaense
      ? categorias.filter((k) => k.slug !== "nacional" && k.slug !== "internacional")
      : categorias;
    const { data: ca } = await sb
      .from("cluster_articles")
      .select("raw_article_id")
      .eq("cluster_id", c.id)
      .limit(3);
    const ids = (ca ?? []).map((r: { raw_article_id: string }) => r.raw_article_id);
    const { data: raws } = await sb
      .from("raw_articles")
      .select("titulo, corpo_limpo, imagem_credito")
      .in("id", ids);
    const excerpt = (raws ?? [])
      .map((r: { titulo: string | null; corpo_limpo: string | null }) => `${r.titulo ?? ""}\n${(r.corpo_limpo ?? "").slice(0, 400)}`)
      .join("\n\n---\n\n")
      .slice(0, 3000);
    const crivo = await classify(excerpt, categoriasElegiveis, aiKey);
    const catSlug = crivo.categoria ?? "";
    // Curadoria que já nasceu com editoria (esportes) mantém a dela.
    const cat = (c.categoria_id ? categorias.find((k) => k.id === c.categoria_id) : null)
      ?? categoriasElegiveis.find((k) => k.slug === catSlug) ?? categoriasElegiveis[0];

    // Portais/jornais do PR (não é prefeitura nem curadoria): fora release de
    // assessoria de prefeitura (já coletamos da própria prefeitura), fato
    // fora do Paraná e crítica política sobre a cidade.
    const ehPortal = !c.fonte_oficial && !c.curadoria_nacional;
    const creditos = (raws ?? []).map((r: { imagem_credito?: string | null }) => r.imagem_credito ?? "").join(" ");
    const motivoPortal = ehPortal
      ? motivoDescartePortal({ ...crivo, origem_assessoria: crivo.origem_assessoria || pareceReleaseDeAssessoria(excerpt, creditos) })
      : null;

    if (!crivo.valor_noticioso || motivoPortal) {
      await sb.from("article_clusters")
        .update({ categoria_id: cat.id, tema_crivo: crivo.tema, prioridade_crivo: crivo.prioridade, status: "descartado" })
        .eq("id", c.id);
      // Motivo em coluna própria (073); sem ela, só o status já basta.
      await sb.from("article_clusters").update({ descarte_motivo: motivoPortal ?? "sem valor noticioso" }).eq("id", c.id);
      if (motivoPortal) descartesPortal++;
      else semValor++;
      continue;
    }

    // Bônus por cobertura estadual: se este cluster está vinculado (mesma
    // notícia detectada em outra região — ver cluster-articles), soma um
    // reforço proporcional a quantas regiões distintas já cobriram o fato.
    let bonusEstadual = 0;
    const { data: grupoRow } = await sb.from("article_clusters").select("grupo_estadual_id").eq("id", c.id).maybeSingle();
    const grupoEstadualId = grupoRow?.grupo_estadual_id ?? null;
    if (grupoEstadualId) {
      const { data: irmaos } = await sb
        .from("article_clusters")
        .select("regiao_id")
        .eq("grupo_estadual_id", grupoEstadualId);
      const regioesDistintas = new Set((irmaos ?? []).map((i: { regiao_id: string }) => i.regiao_id)).size;
      bonusEstadual = Math.max(0, regioesDistintas - 1) * 0.5;
    }

    // Interesse de leitura = nº de fontes (prova social) × peso da categoria
    // (comportamento histórico de consumo) × fator de recência (decai em 48h)
    // + bônus por cobertura em múltiplas regiões.
    const horasDesdeCriacao = (Date.now() - new Date(c.criado_em).getTime()) / 3_600_000;
    const fatorRecencia = Math.max(0.3, 1 - horasDesdeCriacao / 48);
    // Fonte oficial (prefeitura) não depende de nº de fontes pra ser
    // relevante — usa um piso próprio em vez de prioridade_score (que,
    // pra essas, é sempre 1, já que nunca precisam de outra fonte
    // corroborando o mesmo fato).
    const OFICIAL_SCORE_BASE = 2.0;
    const scoreBase = c.fonte_oficial ? OFICIAL_SCORE_BASE : c.prioridade_score;
    // Crivo: pauta de serviço/utilidade pública sobe; evento/propaganda desce.
    const interesseScore = Number(((scoreBase * cat.peso_engajamento * fatorRecencia + bonusEstadual) * pesoPrioridade(crivo.prioridade)).toFixed(2));

    await sb.from("article_clusters").update({
      categoria_id: cat.id,
      interesse_score: interesseScore,
      tema_crivo: crivo.tema,
      prioridade_crivo: crivo.prioridade,
    }).eq("id", c.id);
    // Que imagem a matéria pode ter (ver decidirImagem) — coluna da 073.
    await sb.from("article_clusters").update({ imagem_tipo: crivo.imagem }).eq("id", c.id);
    classified.push({ id: c.id, regiao_id: c.regiao_id, categoria_id: cat.id, score: c.prioridade_score, curadoria_nacional: !!c.curadoria_nacional, fonte_oficial: !!c.fonte_oficial, prioridade: crivo.prioridade, foraDoPr: faixaForaDoPr(regiaoSlug, cat.slug, excerpt) });
  }

  // 2. Aplicar quotas — janela 7 dias, agrupando por região × categoria
  const { data: quotas } = await sb.from("quota_rules").select("regiao_id, categoria_id, piso_pct, teto_pct");
  const quotaMap = new Map<string, { piso: number; teto: number }>();
  for (const q of (quotas ?? []) as { regiao_id: string; categoria_id: string; piso_pct: number; teto_pct: number }[]) {
    quotaMap.set(`${q.regiao_id}:${q.categoria_id}`, { piso: q.piso_pct, teto: q.teto_pct });
  }

  // Contagem atual por região dos últimos 7d de publicados
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { data: recentPub } = await sb
    .from("generated_articles")
    .select("regiao_id, categoria_id")
    .gte("publicado_em", since)
    .eq("status", "publicado");
  const currentCounts = new Map<string, number>();
  const regionTotals = new Map<string, number>();
  for (const row of (recentPub ?? []) as { regiao_id: string; categoria_id: string | null }[]) {
    if (!row.categoria_id) continue;
    const k = `${row.regiao_id}:${row.categoria_id}`;
    currentCounts.set(k, (currentCounts.get(k) ?? 0) + 1);
    regionTotals.set(row.regiao_id, (regionTotals.get(row.regiao_id) ?? 0) + 1);
  }

  // Cota diária de fora do PR: o que já foi escrito hoje (Brasília) nas
  // regiões nacional/internacional, por faixa.
  const diaSp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const inicioIso = new Date(`${diaSp}T00:00:00-03:00`).toISOString();
  const noDiaForaDoPr: Record<FaixaForaDoPr, number> = { nacional: 0, internacional: 0, esportes: 0 };
  if (classified.some((c) => c.foraDoPr)) {
    const { data: hoje } = await sb.from("generated_articles")
      .select("titulo, regiao:regioes!inner(slug), categoria:editorial_categories(slug)")
      .in("regiao.slug", ["nacional", "internacional"])
      .gte("gerado_em", inicioIso)
      .neq("status", "rejeitado");
    for (const g of (hoje ?? []) as { titulo: string; regiao: { slug: string }; categoria: { slug: string } | null }[]) {
      const f = faixaForaDoPr(g.regiao.slug, g.categoria?.slug ?? "", g.titulo ?? "");
      if (f) noDiaForaDoPr[f]++;
    }
  }
  let foraDaCota = 0;

  let selected = 0;
  let discarded = 0;
  let duplicadas = 0;
  let viraramNota = 0;
  const selecionados: string[] = [];
  for (const c of classified.sort((a, b) => b.score - a.score)) {
    // Curadoria (esportes, nacional, internacional): desde out/2026 entra
    // na seleção automática como as demais — publica só texto, sem foto
    // (ver decidirFormato/decidirImagem).

    // Nunca repetir: mesmo fato já selecionado/escrito nas últimas 72h
    // (inclusive o que foi selecionado neste mesmo lote, logo acima).
    const { data: igual } = await sb.rpc("cluster_duplicado", { p_cluster_id: c.id });
    if (igual) {
      await sb.from("article_clusters").update({ status: "descartado" }).eq("id", c.id);
      console.log(`[classify-and-quota] cluster ${c.id} repete ${igual} — descartado`);
      duplicadas++;
      discarded++;
      continue;
    }

    if (c.foraDoPr) {
      if (!cabeNaCotaForaDoPr(c.foraDoPr, noDiaForaDoPr[c.foraDoPr], c.prioridade)) {
        await sb.from("article_clusters").update({ status: "descartado" }).eq("id", c.id);
        await sb.from("article_clusters").update({ descarte_motivo: `cota do dia de fora do PR (${c.foraDoPr})` }).eq("id", c.id);
        foraDaCota++;
        discarded++;
        continue;
      }
      noDiaForaDoPr[c.foraDoPr]++;
    }

    const rule = quotaMap.get(`${c.regiao_id}:${c.categoria_id}`);
    const total = Math.max(regionTotals.get(c.regiao_id) ?? 0, 10);
    const currentPct = ((currentCounts.get(`${c.regiao_id}:${c.categoria_id}`) ?? 0) / total) * 100;
    const teto = rule?.teto ?? 100;
    const estourou = currentPct >= teto && c.prioridade !== "alta";
    await sb.from("article_clusters")
      .update({ status: "selecionado_cota", ...(estourou ? { forcar_nota: true } : {}) })
      .eq("id", c.id);
    if (estourou) {
      viraramNota++;
    } else {
      currentCounts.set(`${c.regiao_id}:${c.categoria_id}`, (currentCounts.get(`${c.regiao_id}:${c.categoria_id}`) ?? 0) + 1);
      regionTotals.set(c.regiao_id, (regionTotals.get(c.regiao_id) ?? 0) + 1);
    }
    selected++;
    selecionados.push(c.id);
  }

  // A redação (extrair fatos + escrever) NÃO acontece mais aqui — fica
  // inteiramente a cargo do `process-pending-clusters`, chamado logo em
  // seguida no pipeline. Antes havia uma cadeia de escrita duplicada aqui
  // dentro que falhava em silêncio (só console.error, sem aparecer em
  // lugar nenhum) — se ela falhasse, o process-pending-clusters não
  // encontrava mais nada pendente pra processar, e parecia que "rodou
  // tudo" sem nenhuma matéria sair e sem erro visível em canto nenhum.
  // Ter um único lugar escrevendo evita essa corrida e concentra o erro
  // num só ponto, já com retorno detalhado.
  console.log(`[classify-and-quota] concluído: classified=${classified.length} selected=${selected} discarded=${discarded} duplicadas=${duplicadas} sem_valor=${semValor} descartes_portal=${descartesPortal} viraram_nota=${viraramNota} fora_da_cota_pr=${foraDaCota}`);
  return { classified: classified.length, selected, discarded, duplicadas, sem_valor: semValor, descartes_portal: descartesPortal, viraram_nota: viraramNota, fora_da_cota_pr: foraDaCota, pendentes_para_escrita: selecionados.length };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

// Sem resposta válida da IA: editoria neutra, nunca a 1ª da lista (que podia
// ser "agro" ou "eleicoes-2026").
function fallbackSlug(categorias: { slug: string }[]): string {
  for (const s of ["cidades", "nacional"]) if (categorias.some((c) => c.slug === s)) return s;
  return categorias[0].slug;
}

async function classify(
  excerpt: string,
  categorias: { slug: string; nome: string }[],
  apiKey: string,
): Promise<ResultadoCrivo> {
  const slugs = categorias.map((c) => c.slug).join(", ");
  const sys = `Você é um editor de um portal do Paraná (Brasil). Classifique o excerto em UMA editoria dentre: ${slugs}.

POLÍTICA PRIMEIRO (vale para fato nacional, paranaense ou local): eleição, segundo turno, candidato, campanha, pesquisa eleitoral, partido, Congresso, Câmara, Senado, Assembleia, câmara de vereadores, votação de projeto de lei, governo/ministro/presidente/governador/prefeito em ato político, plebiscito → responda "politica". Serviço ao eleitor ligado à eleição (documentos, locais de votação, transporte no dia da votação) também é "politica".

Regras de escopo geográfico (para o que NÃO é política):
- Se o fato NÃO menciona o Paraná nem cidade/pessoa/instituição do Paraná, e ocorre em outro estado brasileiro ou tem escopo nacional (Brasil, órgãos federais, STF, seleção brasileira, etc.), responda "nacional".
- Se o fato ocorre fora do Brasil (outro país, órgãos internacionais, esportes/política/economia estrangeiros) e não tem ligação direta com o Paraná, responda "internacional".
- Caso contrário (fato paranaense OU com impacto direto no Paraná), escolha a editoria temática apropriada (economia, agro, seguranca, educacao, esportes, cultura, saude, cidades, meio-ambiente).

${CRIVO_PROMPT}

Responda APENAS com JSON: ${CRIVO_SCHEMA}`;
  const fallback = (): ResultadoCrivo => ({ ...parseCrivo("", excerpt), categoria: fallbackSlug(categorias) });
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: excerpt }],
        // 150 cortava o JSON do crivo no meio → a pauta caía na 1ª editoria
        // da lista (ex.: previsão do tempo em "Eleições 2026").
        max_tokens: 600,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback();
    const j = await res.json();
    const raw = String(j.choices?.[0]?.message?.content ?? "").trim();
    const crivo = parseCrivo(raw, excerpt);
    // Prioriza slugs mais longos primeiro (ex.: "internacional" antes de
    // "nacional") para não confundir substrings.
    const ordered = [...categorias].sort((a, b) => b.slug.length - a.slug.length);
    const alvo = (crivo.categoria ?? raw).toLowerCase();
    const found = ordered.find((c) => alvo.includes(c.slug));
    // Eleição é assunto da editoria Política (decisão de 24/10/2026).
    const slug = found?.slug === "eleicoes-2026" && categorias.some((c) => c.slug === "politica") ? "politica" : found?.slug;
    return { ...crivo, categoria: slug ?? fallbackSlug(categorias) };
  } catch {
    return fallback();
  }
}
