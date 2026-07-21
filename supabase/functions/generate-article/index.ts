// Vozes Paranaenses — generate-article
// Etapa 2 de 2 do pipeline editorial (separada de extract-facts em
// 2026-07): recebe { cluster_id } ou { extracted_facts_id }, lê os fatos
// JÁ EXTRAÍDOS (não chama IA para extrair nada de novo) e redige a
// matéria seguindo o Método DEL. Grava em `generated_articles`
// (status='rascunho') para revisão no dashboard editorial.
//
// Pré-requisito: rode extract-facts para o cluster antes de chamar isto.
// Se não houver extracted_facts para o cluster, retorna erro
// `facts_not_extracted_yet` — não faz fallback silencioso para extrair
// fatos aqui, propositalmente, para manter as duas etapas realmente
// separadas e auditáveis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const BASE_SYSTEM_PROMPT = `Você é editor-chefe do portal regional "Vozes Paranaenses".
Sua tarefa: a partir de FATOS JÁ APURADOS (fornecidos como JSON, não como
texto-fonte bruto), redigir UMA reportagem original em português brasileiro,
seguindo o Método DEL (Denso, Editorial, Local) + a regra do lide 5W1H
(O quê / Quem / Quando / Onde / Como / Por quê) na PRIMEIRA frase.

REGRAS INEGOCIÁVEIS:
1. Use SOMENTE os fatos fornecidos no JSON de entrada — nunca invente nomes,
   números, datas, cargos ou citações que não estejam ali.
2. Se um campo do JSON de fatos vier null ou vazio, não mencione esse ponto
   na matéria em vez de inventar um valor.
3. Tom editorial: informativo, direto, sem opinião, foco no impacto local.
   O PRIMEIRO parágrafo (lide) deve responder O QUÊ + QUEM + QUANDO + ONDE em
   até 30 palavras. COMO e POR QUÊ entram no 2º parágrafo.
4. Título: até 90 caracteres, sem clickbait, com o fato central.
5. Subtítulo: contexto complementar, até 160 caracteres.
6. Resumo: 2-3 frases, autocontido (para redes sociais e SEO).
7. Corpo: profundidade condicionada ao que foi apurado — se os fatos são
   ricos (dados, citações, contexto), escreva 6-10 parágrafos cobrindo tudo
   isso; se os fatos são escassos, escreva só o essencial (lide + como/por
   quê) e pare — nunca infle parágrafo com repetição ou generalidade só para
   alcançar um número maior.
8. TL;DR (answer-first): 2 a 3 frases curtas com a resposta direta ao "o que
   aconteceu?", otimizado para AI Overviews / ChatGPT / Perplexity.
9. FAQ: 3 a 5 perguntas frequentes que uma pessoa da região faria sobre esse
   fato, cada resposta com 1-3 frases baseadas SOMENTE nos fatos fornecidos.
   Se os fatos não permitirem perguntas úteis, retorne array vazio.

PROMPT MENTAL (responda internamente antes de escrever):
1. Qual é o fato? 2. Qual é a informação mais relevante? 3. Quem é o leitor?
4. Qual editoria? 5. Qual estrutura sintática devo usar? 6. Qual interpretação
editorial devo aplicar? 7. Qual linguagem representa o portal? 8. Existe
contexto suficiente? 9. Há dados verificáveis? 10. A notícia preserva o
padrão editorial do veículo?

Retorne APENAS JSON válido, sem markdown, no schema fornecido.`;

type Payload = { cluster_id?: string; extracted_facts_id?: string; extra_instructions?: string };

type DnaSintatico = Record<string, string | undefined>;
type DnaSemantico = Record<string, string | undefined>;
type DnaLexical = Record<string, string | undefined>;
type Matriz = Record<string, string | undefined>;

type MemoriaEditorial = {
  missao?: string | null;
  valores?: string | null;
  posicionamento?: string | null;
  manual_estilo?: string | null;
  glossario?: Array<{ termo?: string; definicao?: string }> | null;
  siglas?: Array<{ sigla?: string; significado?: string }> | null;
  pessoas?: Array<{ nome?: string; cargo?: string; partido?: string; estado?: string }> | null;
  instituicoes?: Array<{ nome?: string; tipo?: string }> | null;
};

type ExtractedFactsRow = {
  id: string;
  cluster_id: string;
  quem: string | null;
  o_que: string | null;
  quando: string | null;
  onde: string | null;
  por_que: string | null;
  dados: Record<string, unknown> | null;
  citacoes: Array<{ autor?: string; texto?: string }> | null;
  fontes: Array<{ url?: string; veiculo?: string }> | null;
};

type GeneratedPayload = {
  titulo: string;
  subtitulo?: string;
  resumo?: string;
  corpo: string;
  seo_title?: string;
  seo_description?: string;
  tldr?: string;
  faq?: Array<{ pergunta: string; resposta: string }>;
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
  if (!body.cluster_id && !body.extracted_facts_id) {
    return json({ error: "missing_cluster_id_or_extracted_facts_id" }, 400);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Buscar os fatos JÁ EXTRAÍDOS — nunca chama IA de extração aqui
  let facts: ExtractedFactsRow | null = null;
  if (body.extracted_facts_id) {
    const { data, error } = await sb
      .from("extracted_facts")
      .select("id, cluster_id, quem, o_que, quando, onde, por_que, dados, citacoes, fontes")
      .eq("id", body.extracted_facts_id)
      .maybeSingle();
    if (error) return json({ error: "facts_fetch_failed", detail: error.message }, 500);
    facts = data;
  } else if (body.cluster_id) {
    const { data, error } = await sb
      .from("extracted_facts")
      .select("id, cluster_id, quem, o_que, quando, onde, por_que, dados, citacoes, fontes")
      .eq("cluster_id", body.cluster_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return json({ error: "facts_fetch_failed", detail: error.message }, 500);
    facts = data;
  }

  if (!facts) {
    return json(
      { error: "facts_not_extracted_yet", hint: "Rode a função extract-facts para este cluster antes de gerar a matéria." },
      409,
    );
  }

  const clusterId = facts.cluster_id;
  const { data: cluster, error: cErr } = await sb
    .from("article_clusters")
    .select("id, regiao_id, categoria_id, interesse_score, categoria:editorial_categories(slug)")
    .eq("id", clusterId)
    .maybeSingle();
  if (cErr || !cluster) return json({ error: "cluster_not_found", detail: cErr?.message }, 404);
  const categoriaSlug = Array.isArray(cluster.categoria) ? cluster.categoria[0]?.slug : cluster.categoria?.slug;

  // 1b. Carregar o agente redator especializado da editoria (se existir e
  // estiver ativo) — o prompt-base do agente é injetado ANTES do system
  // padrão, permitindo tom/estilo por editoria (política, esporte, cidades…).
  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (cluster.categoria_id) {
    const [{ data: agente }, { data: memoria }, { data: profundidade }] = await Promise.all([
      sb.from("agentes_redatores")
        .select("instrucoes_base, exemplo_texto, ativo, dna_sintatico, dna_semantico, dna_lexical, matriz_editorial")
        .eq("categoria_id", cluster.categoria_id).maybeSingle(),
      sb.from("memoria_editorial")
        .select("missao, valores, posicionamento, manual_estilo, glossario, siglas, pessoas, instituicoes")
        .eq("singleton", true).maybeSingle(),
      sb.from("reforco_profundidade_editorial")
        .select("instrucoes").eq("ativo", true).limit(1).maybeSingle(),
    ]);
    if (agente?.ativo) {
      const del = buildDelPrompt(agente as {
        instrucoes_base?: string; exemplo_texto?: string | null;
        dna_sintatico?: DnaSintatico; dna_semantico?: DnaSemantico;
        dna_lexical?: DnaLexical; matriz_editorial?: Matriz;
      }, memoria as MemoriaEditorial | null);
      if (del.trim()) systemPrompt = `${del}\n\n---\n\n${BASE_SYSTEM_PROMPT}`;
    }
    if (profundidade?.instrucoes?.trim()) {
      systemPrompt = `${systemPrompt}\n\n---\n\n${profundidade.instrucoes.trim()}`;
    }
  }

  // Instruções extras do editor (usado pelo fluxo manual-article — ex.: "focar no impacto em Maringá")
  const extra = (body.extra_instructions ?? "").trim();
  if (extra) {
    systemPrompt = `${systemPrompt}\n\n---\n\n## INSTRUÇÕES ADICIONAIS DO EDITOR (prioridade máxima sobre estilo, sem inventar fatos)\n${extra}`;
  }

  // 2. Chamar IA — só para redação (Método DEL), a partir dos fatos já prontos
  const dados = (facts.dados ?? {}) as Record<string, unknown>;
  const userPrompt = buildUserPrompt(facts, dados);
  const aiResult = await generateArticleJson(systemPrompt, userPrompt, aiKey);
  if ("error" in aiResult) return json(aiResult, aiResult.httpStatus ?? 502);
  const parsed = aiResult.parsed;

  const baseSlug = slugify(parsed.titulo);
  // Garante unicidade por (regiao_id, slug). Se colidir com uma matéria já
  // existente na mesma região, adiciona sufixo curto do cluster_id.
  let slug = baseSlug;
  {
    const { data: existing } = await sb
      .from("generated_articles")
      .select("id")
      .eq("regiao_id", cluster.regiao_id)
      .eq("slug", baseSlug)
      .maybeSingle();
    if (existing) {
      const suffix = String(clusterId).replace(/-/g, "").slice(0, 6);
      slug = `${baseSlug}-${suffix}`;
    }
  }
  const cidadePrincipal = (dados.cidade_principal as string | null) ?? null;
  const cidadesMencionadas = (dados.cidades_mencionadas as string[] | undefined) ?? [];

  // 3. Persistir generated_articles (rascunho) — extracted_facts já existe, não regrava
  const { data: inserted, error: insErr } = await sb
    .from("generated_articles")
    .insert({
      cluster_id: clusterId,
      regiao_id: cluster.regiao_id,
      categoria_id: cluster.categoria_id,
      slug,
      titulo: parsed.titulo,
      subtitulo: parsed.subtitulo ?? null,
      resumo: parsed.resumo ?? null,
      corpo: parsed.corpo,
      seo_title: parsed.seo_title ?? parsed.titulo,
      seo_description: parsed.seo_description ?? parsed.resumo ?? null,
      cidade_principal: cidadePrincipal,
      cidades_mencionadas: cidadesMencionadas,
      tldr: parsed.tldr ?? null,
      fatos_5w1h: {
        quem: facts.quem, o_que: facts.o_que, quando: facts.quando, onde: facts.onde,
        por_que: facts.por_que, como: dados.como ?? null,
      },
      faq: Array.isArray(parsed.faq) ? parsed.faq : [],
      status: "rascunho",
    })
    .select("id, slug")
    .single();

  if (insErr) {
    // Corrida: mesmo com a checagem acima, dois clusters podem tentar o mesmo
    // slug ao mesmo tempo. Tenta de novo com sufixo do cluster_id.
    if (/generated_articles_regiao_id_slug_key|duplicate key/i.test(insErr.message)) {
      const suffix = String(clusterId).replace(/-/g, "").slice(0, 8);
      const retrySlug = `${baseSlug}-${suffix}`;
      const { data: retry, error: retryErr } = await sb
        .from("generated_articles")
        .insert({
          cluster_id: clusterId,
          regiao_id: cluster.regiao_id,
          categoria_id: cluster.categoria_id,
          slug: retrySlug,
          titulo: parsed.titulo,
          subtitulo: parsed.subtitulo ?? null,
          resumo: parsed.resumo ?? null,
          corpo: parsed.corpo,
          seo_title: parsed.seo_title ?? parsed.titulo,
          seo_description: parsed.seo_description ?? parsed.resumo ?? null,
          cidade_principal: cidadePrincipal,
          cidades_mencionadas: cidadesMencionadas,
          tldr: parsed.tldr ?? null,
          fatos_5w1h: {
            quem: facts.quem, o_que: facts.o_que, quando: facts.quando, onde: facts.onde,
            por_que: facts.por_que, como: dados.como ?? null,
          },
          faq: Array.isArray(parsed.faq) ? parsed.faq : [],
          status: "rascunho",
        })
        .select("id, slug")
        .single();
      if (retryErr) return json({ error: "insert_failed", detail: retryErr.message }, 500);
      // reatribui para o fluxo seguinte
      (inserted as unknown) = retry;
    } else {
      return json({ error: "insert_failed", detail: insErr.message }, 500);
    }
  }

  // A partir daqui a matéria já existe. Marca o cluster como concluído ANTES
  // de qualquer tarefa auxiliar (ex.: copiar foto externa), para uma demora de
  // rede não deixar a pauta presa em `selecionado_cota`/`fatos_extraidos`.
  await markClusterDone(sb, clusterId);

  // 3b. Sempre copiar a foto original do scraping para o storage — assim o
  // editor pode escolher, com um clique, entre a foto real e uma variação IA
  // (mesmo se a fonte tirar o arquivo do ar depois).
  let temFotoReal = false;
  try {
    const { data: ca } = await sb
      .from("cluster_articles")
      .select("raw_article_id")
      .eq("cluster_id", clusterId);
    const rawIdsList = (ca ?? []).map((r) => r.raw_article_id);
    if (rawIdsList.length) {
      const { data: raws } = await sb
        .from("raw_articles")
        .select("imagem_original_url, imagem_credito, fonte:fontes(nome)")
        .in("id", rawIdsList)
        .not("imagem_original_url", "is", null)
        .limit(1);
      const raw = raws?.[0] as
        | { imagem_original_url: string | null; imagem_credito: string | null; fonte: { nome: string } | { nome: string }[] | null }
        | undefined;
      const srcUrl = raw?.imagem_original_url ?? null;
      if (srcUrl) {
        temFotoReal = true;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6_000);
        let imgRes: Response | null = null;
        try {
          imgRes = await fetch(srcUrl, {
            headers: { "User-Agent": "VozesParanaensesBot/1.0 (+https://vozesparanaenses.com.br)" },
            signal: controller.signal,
          });
        } catch (_) {
          imgRes = null;
        } finally {
          clearTimeout(timeout);
        }
        if (imgRes?.ok) {
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          const mime = imgRes.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
          if (/^image\//.test(mime) && buf.byteLength > 1024) {
            const ext = mime.split("/")[1]?.split("+")[0] ?? "jpg";
            const path = `${inserted.id}/original.${ext}`;
            const { error: upErr } = await sb.storage.from("article-covers").upload(path, buf, {
              contentType: mime, upsert: true,
            });
            if (!upErr) {
              const { data: pub } = sb.storage.from("article-covers").getPublicUrl(path);
              const veic = Array.isArray(raw?.fonte) ? raw?.fonte[0]?.nome : raw?.fonte?.nome;
              const creditoScraped = raw?.imagem_credito?.trim();
              const credito = creditoScraped && creditoScraped.length
                ? (veic && !creditoScraped.toLowerCase().includes(veic.toLowerCase())
                    ? `${creditoScraped} / ${veic}`
                    : creditoScraped)
                : `Imagem: reprodução${veic ? ` — ${veic}` : ""}`;
              await sb.from("generated_articles")
                .update({
                  imagem_original_url: pub.publicUrl,
                  imagem_capa_url: pub.publicUrl,
                  og_image_url: pub.publicUrl,
                  imagem_credito: credito,
                })
                .eq("id", inserted.id);
            }
          }
        }
      }
    }
  } catch (_) {
    // Falha ao copiar a foto original não bloqueia a geração da matéria —
    // o editor pode gerar/subir a capa manualmente depois.
  }

  // 3c. Publicação automática: só quando NÃO há foto real da fonte (o uso da
  // foto em si, mesmo com crédito, é uma decisão de risco que fica sempre
  // com o editor humano), o interesse de leitura está no patamar "muito
  // alto" E a categoria não é Segurança/Policial — matéria sobre pessoa
  // identificável em contexto criminal carrega risco real de difamação/
  // exposição mesmo sem foto, então fica sempre na fila manual, sem exceção.
  const AUTO_PUBLISH_INTERESSE_MINIMO = 3.5;
  const CATEGORIAS_SEMPRE_MANUAIS = ["seguranca"];
  const categoriaSensivel = categoriaSlug ? CATEGORIAS_SEMPRE_MANUAIS.includes(categoriaSlug) : false;
  const podeAutoPublicar =
    !temFotoReal && !categoriaSensivel && (cluster.interesse_score ?? 0) >= AUTO_PUBLISH_INTERESSE_MINIMO;
  if (podeAutoPublicar) {
    await sb.from("generated_articles")
      .update({ status: "publicado", publicado_automaticamente: true, publicado_em: new Date().toISOString() })
      .eq("id", inserted.id);
  }

  // 5. Marcar raws desse cluster como processados
  const { data: ca } = await sb.from("cluster_articles").select("raw_article_id").eq("cluster_id", clusterId);
  const rawIds = (ca ?? []).map((r) => r.raw_article_id);
  if (rawIds.length) await sb.from("raw_articles").update({ processado: true }).in("id", rawIds);

  return json({
    ok: true,
    article: inserted,
    model: MODEL,
    titulo: parsed.titulo,
    publicado_automaticamente: podeAutoPublicar,
    tem_foto_real: temFotoReal,
    categoria_sensivel: categoriaSensivel,
  });
});

async function generateArticleJson(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<
  | { parsed: GeneratedPayload }
  | { error: string; detail?: string; status?: number; raw?: string; httpStatus?: number }
> {
  const basePayload = {
    model: MODEL,
    temperature: 0.15,
    max_tokens: 2600,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(attempt === 1
        ? basePayload
        : {
            ...basePayload,
            max_tokens: 1800,
            temperature: 0,
            messages: [
              { role: "system", content: `${systemPrompt}\n\nSe houver qualquer risco de JSON inválido, reduza o texto e retorne APENAS JSON compacto válido.` },
              { role: "user", content: userPrompt },
            ],
          }),
    });

    if (res.status === 429) return { error: "rate_limited", httpStatus: 429 };
    if (res.status === 402) return { error: "ai_credits_exhausted", httpStatus: 402 };
    if (!res.ok) {
      const t = await res.text();
      if (attempt === 2) return { error: "ai_gateway_error", status: res.status, detail: t.slice(0, 500), httpStatus: 502 };
      continue;
    }

    const aiJson = await res.json();
    const choiceError = aiJson?.choices?.[0]?.error;
    if (choiceError) {
      if (attempt === 2) {
        return { error: "ai_choice_error", detail: choiceError?.message ?? "Modelo encerrou sem JSON.", httpStatus: 502 };
      }
      continue;
    }

    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt === 2) return { error: "ai_empty_response", httpStatus: 502 };
      continue;
    }

    const parsed = parseGeneratedPayload(content);
    if (parsed) return { parsed };
    if (attempt === 2) return { error: "ai_invalid_json", raw: String(content).slice(0, 500), httpStatus: 502 };
  }

  return { error: "ai_generation_failed", httpStatus: 502 };
}

function parseGeneratedPayload(content: string): GeneratedPayload | null {
  const raw = content.trim();
  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""),
    raw.slice(Math.max(0, raw.indexOf("{")), raw.lastIndexOf("}") + 1),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as GeneratedPayload;
      if (parsed?.titulo && parsed?.corpo) return parsed;
    } catch (_) {
      // tenta a próxima forma
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function markClusterDone(sb: any, clusterId: string) {
  const { error: statusErr } = await sb
    .from("article_clusters")
    .update({ status: "rascunho_gerado" })
    .eq("id", clusterId);
  if (!statusErr) return;

  const invalidEnum = statusErr.code === "22P02" || /rascunho_gerado|cluster_status/i.test(statusErr.message ?? "");
  if (invalidEnum) {
    const { error: fallbackErr } = await sb
      .from("article_clusters")
      .update({ status: "descartado" })
      .eq("id", clusterId);
    if (fallbackErr) console.error("Erro ao aplicar fallback de status do cluster:", fallbackErr);
    return;
  }
  console.error("Erro ao atualizar status do cluster:", statusErr);
}

function buildUserPrompt(facts: ExtractedFactsRow, dados: Record<string, unknown>) {
  const fontesTxt = (facts.fontes ?? [])
    .map((f, i) => `${i + 1}. ${f.veiculo ?? "fonte"} — ${f.url ?? ""}`)
    .join("\n");

  return `Fatos apurados sobre este acontecimento (já extraídos, não invente nada além disto):

{
  "quem": ${JSON.stringify(facts.quem)},
  "o_que": ${JSON.stringify(facts.o_que)},
  "quando": ${JSON.stringify(facts.quando)},
  "onde": ${JSON.stringify(facts.onde)},
  "por_que": ${JSON.stringify(facts.por_que)},
  "como": ${JSON.stringify(dados.como ?? null)},
  "dados": ${JSON.stringify(dados)},
  "citacoes": ${JSON.stringify(facts.citacoes ?? [])}
}

Fontes originais (para referência editorial, ex.: "segundo apurou o Vozes Paranaenses" ou citar o veículo quando fizer sentido):
${fontesTxt}

Redija a reportagem no schema JSON:
{
  "titulo": "string até 90 chars",
  "subtitulo": "string até 160 chars",
  "resumo": "2-3 frases autocontidas",
  "tldr": "2-3 frases curtas com a resposta direta (answer-first p/ IA)",
  "corpo": "texto em markdown — 6-10 parágrafos SE os fatos apurados forem ricos (use todos os dados/citações); só o essencial (lide + como/por quê) SE os fatos forem escassos — nunca infle pra alcançar um número de parágrafos",
  "seo_title": "string até 60 chars",
  "seo_description": "string até 155 chars",
  "faq": [ { "pergunta": "string", "resposta": "1-3 frases baseadas SOMENTE nos fatos acima" } ]
}`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// Serializa memória global + as 4 camadas DEL em ordem, omitindo camadas
// vazias (retrocompatível: se tudo vazio e só houver instrucoes_base, é
// o único bloco). Assim o custo de tokens escala com o que o editor
// realmente preencher.
function buildDelPrompt(
  agente: { instrucoes_base?: string; exemplo_texto?: string | null;
    dna_sintatico?: DnaSintatico; dna_semantico?: DnaSemantico;
    dna_lexical?: DnaLexical; matriz_editorial?: Matriz; },
  memoria: MemoriaEditorial | null,
): string {
  const parts: string[] = [];

  if (memoria) {
    const mem: string[] = [];
    if (memoria.missao) mem.push(`Missão: ${memoria.missao}`);
    if (memoria.valores) mem.push(`Valores: ${memoria.valores}`);
    if (memoria.posicionamento) mem.push(`Posicionamento: ${memoria.posicionamento}`);
    if (memoria.manual_estilo) mem.push(`Manual de estilo: ${memoria.manual_estilo}`);
    const siglas = (memoria.siglas ?? []).filter((s) => s?.sigla && s?.significado)
      .map((s) => `${s.sigla} = ${s.significado}`).join(" · ");
    if (siglas) mem.push(`Siglas: ${siglas}`);
    const glos = (memoria.glossario ?? []).filter((g) => g?.termo && g?.definicao)
      .map((g) => `${g.termo}: ${g.definicao}`).join(" · ");
    if (glos) mem.push(`Glossário: ${glos}`);
    const inst = (memoria.instituicoes ?? []).filter((i) => i?.nome)
      .map((i) => i.tipo ? `${i.nome} (${i.tipo})` : i.nome).join(", ");
    if (inst) mem.push(`Instituições recorrentes: ${inst}`);
    if (mem.length) parts.push(`## MEMÓRIA EDITORIAL (identidade do portal)\n${mem.join("\n")}`);
  }

  const mat = serializeLayer(agente.matriz_editorial, {
    objetivo: "Objetivo", publico: "Público", fontes_prioritarias: "Fontes prioritárias",
    fontes_proibidas: "Fontes proibidas", indicadores: "Indicadores", cta: "CTA",
  });
  if (mat) parts.push(`## MATRIZ EDITORIAL DESTA EDITORIA\n${mat}`);

  const sin = serializeLayer(agente.dna_sintatico, {
    titulo_padrao: "Padrão de título", subtitulo_padrao: "Padrão de subtítulo",
    ordem_informacoes: "Ordem das informações", tamanho_paragrafos: "Tamanho dos parágrafos",
    ritmo: "Ritmo", uso_listas: "Uso de listas", uso_intertitulos: "Uso de intertítulos",
  });
  if (sin) parts.push(`## D — DNA SINTÁTICO (arquitetura do texto)\n${sin}`);

  const sem = serializeLayer(agente.dna_semantico, {
    eixo_narrativo: "Eixo narrativo", enfases: "Ênfases",
    perguntas_obrigatorias: "Perguntas obrigatórias", conflitos_tipicos: "Conflitos típicos",
  });
  if (sem) parts.push(`## E — DNA SEMÂNTICO (como interpretar o fato)\n${sem}`);

  const lex = serializeLayer(agente.dna_lexical, {
    palavras_preferidas: "Palavras preferidas", palavras_proibidas: "Palavras proibidas",
    verbos_predominantes: "Verbos predominantes", adjetivos_evitados: "Adjetivos evitados",
    expressoes_recorrentes: "Expressões recorrentes", tom: "Tom",
    formalidade: "Formalidade", nivel_tecnico: "Nível técnico",
  });
  if (lex) parts.push(`## L — DNA LEXICAL (como escrever)\n${lex}`);

  if (agente.instrucoes_base?.trim()) {
    parts.push(`## INSTRUÇÕES COMPLEMENTARES\n${agente.instrucoes_base.trim()}`);
  }
  if (agente.exemplo_texto?.trim()) {
    parts.push(`## EXEMPLO DE LIDE (referência de tom, NÃO copie)\n${agente.exemplo_texto.trim()}`);
  }

  return parts.join("\n\n");
}

function serializeLayer(layer: Record<string, string | undefined> | undefined, labels: Record<string, string>): string {
  if (!layer) return "";
  const lines: string[] = [];
  for (const key of Object.keys(labels)) {
    const v = layer[key]?.trim();
    if (v) lines.push(`- ${labels[key]}: ${v}`);
  }
  return lines.join("\n");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
