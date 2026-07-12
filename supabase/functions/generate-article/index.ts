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
const MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT = `Você é editor-chefe do portal regional "Vozes Paranaenses".
Sua tarefa: a partir de FATOS JÁ APURADOS (fornecidos como JSON, não como
texto-fonte bruto), redigir UMA reportagem original em português brasileiro,
seguindo o Método DEL (Denso, Editorial, Local).

REGRAS INEGOCIÁVEIS:
1. Use SOMENTE os fatos fornecidos no JSON de entrada — nunca invente nomes,
   números, datas, cargos ou citações que não estejam ali.
2. Se um campo do JSON de fatos vier null ou vazio, não mencione esse ponto
   na matéria em vez de inventar um valor.
3. Tom editorial: informativo, direto, sem opinião, foco no impacto local.
4. Título: até 90 caracteres, sem clickbait, com o fato central.
5. Subtítulo: contexto complementar, até 160 caracteres.
6. Resumo: 2-3 frases, autocontido (para redes sociais e SEO).
7. Corpo: 4-8 parágrafos curtos, lead na primeira frase.
8. TL;DR (answer-first): 2 a 3 frases curtas com a resposta direta ao "o que
   aconteceu?", otimizado para AI Overviews / ChatGPT / Perplexity.
9. FAQ: 3 a 5 perguntas frequentes que uma pessoa da região faria sobre esse
   fato, cada resposta com 1-3 frases baseadas SOMENTE nos fatos fornecidos.
   Se os fatos não permitirem perguntas úteis, retorne array vazio.

Retorne APENAS JSON válido, sem markdown, no schema fornecido.`;

type Payload = { cluster_id?: string; extracted_facts_id?: string };

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
    .select("id, regiao_id, categoria_id, interesse_score")
    .eq("id", clusterId)
    .maybeSingle();
  if (cErr || !cluster) return json({ error: "cluster_not_found", detail: cErr?.message }, 404);

  // 2. Chamar IA — só para redação (Método DEL), a partir dos fatos já prontos
  const dados = (facts.dados ?? {}) as Record<string, unknown>;
  const userPrompt = buildUserPrompt(facts, dados);
  const aiRes = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

  let parsed: GeneratedPayload;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  const slug = slugify(parsed.titulo);
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

  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

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
        const imgRes = await fetch(srcUrl, {
          headers: { "User-Agent": "VozesParanaensesBot/1.0 (+https://vozesparanaenses.com.br)" },
        });
        if (imgRes.ok) {
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
  // com o editor humano) E o interesse de leitura já calculado pelo motor de
  // cotas está no patamar "muito alto". Todo o resto fica em 'rascunho',
  // esperando decisão manual de publicar — ou expira em 12h (ver
  // expire-drafts) se ninguém decidir.
  const AUTO_PUBLISH_INTERESSE_MINIMO = 3.5;
  const podeAutoPublicar = !temFotoReal && (cluster.interesse_score ?? 0) >= AUTO_PUBLISH_INTERESSE_MINIMO;
  if (podeAutoPublicar) {
    await sb.from("generated_articles")
      .update({ status: "publicado", publicado_automaticamente: true, publicado_em: new Date().toISOString() })
      .eq("id", inserted.id);
  }

  // 4. Marcar cluster como "rascunho gerado" para que suma do Painel de Pautas
  const { error: statusErr } = await sb
    .from("article_clusters")
    .update({ status: "rascunho_gerado" })
    .eq("id", clusterId);
  if (statusErr) {
    console.error("Erro ao atualizar status do cluster:", statusErr);
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
  });
});

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
  "corpo": "texto em markdown, 4-8 parágrafos curtos",
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
