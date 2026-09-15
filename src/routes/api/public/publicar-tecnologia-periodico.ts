// Vozes Paranaenses — publicação periódica da editoria Tecnologia.
// Chamada por cron (ver supabase-external/059_cron_tecnologia.sql), mas só
// age de verdade se já passaram 2 dias desde a última publicação de
// Tecnologia — chamar com mais frequência não acelera o ritmo.
//
// A cada 7 dias (a partir da última edição especial), em vez de escrever a
// partir de um cluster comum, gera a edição semanal com Jefferson Lobo como
// personagem comentando o tema da semana.
//
// Diferente da curadoria de Segurança/Esportes (nunca publica sozinha),
// esta SIM publica automaticamente.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const INTERVALO_MS = 2 * 24 * 3600 * 1000;
const INTERVALO_SEMANAL_MS = 7 * 24 * 3600 * 1000;

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

async function run(): Promise<Response> {
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const serviceKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;
  const aiKey = process.env.LOVABLE_API_KEY;
  const selfUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const selfKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !aiKey || !selfUrl || !selfKey) {
    return Response.json({ error: "missing_env" }, { status: 500 });
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: catTec } = await sb
    .from("editorial_categories")
    .select("id")
    .eq("slug", "tecnologia")
    .maybeSingle();
  if (!catTec) {
    return Response.json(
      { error: "categoria_tecnologia_nao_encontrada" },
      { status: 500 },
    );
  }

  // 1. Ritmo de 2 em 2 dias.
  const { data: ultima } = await sb
    .from("generated_articles")
    .select("gerado_em")
    .eq("categoria_id", catTec.id)
    .order("gerado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima && Date.now() - new Date(ultima.gerado_em).getTime() < INTERVALO_MS) {
    return Response.json({
      ok: true,
      aguardando: true,
      motivo: "Ainda não passaram 2 dias desde a última publicação de Tecnologia.",
    });
  }

  // 2. É a edição semanal com Jefferson Lobo?
  const { data: ultimaEspecial } = await sb
    .from("generated_articles")
    .select("gerado_em")
    .eq("categoria_id", catTec.id)
    .eq("serie_semanal_jefferson", true)
    .order("gerado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ehEdicaoEspecial =
    !ultimaEspecial ||
    Date.now() - new Date(ultimaEspecial.gerado_em).getTime() >=
      INTERVALO_SEMANAL_MS;

  const { data: regiaoNacional } = await sb
    .from("regioes")
    .select("id")
    .eq("slug", "nacional")
    .maybeSingle();
  if (!regiaoNacional) {
    return Response.json(
      { error: "regiao_nacional_nao_encontrada" },
      { status: 500 },
    );
  }

  if (ehEdicaoEspecial) {
    const { data: recentes } = await sb
      .from("generated_articles")
      .select("titulo, resumo")
      .eq("categoria_id", catTec.id)
      .order("gerado_em", { ascending: false })
      .limit(5);
    const contextoSemana =
      (recentes ?? []).map((r: { titulo: string }) => `- ${r.titulo}`).join("\n") ||
      "Nenhuma matéria de Tecnologia publicada ainda esta semana.";

    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você escreve a edição semanal especial da editoria Tecnologia do Vozes Paranaenses. Diferente das matérias comuns, esta traz Jefferson Lobo — palestrante e especialista em IA, autor do livro "A IA com a Sua Voz", conhecido por criticar o "cardápio mágico de prompt" e defender a linguagem como ativo estratégico na IA — como comentarista dos principais fatos da semana em inteligência artificial.

Notícias de tecnologia publicadas esta semana, pra contextualizar:
${contextoSemana}

Escreva uma matéria em formato de comentário/análise, citando Jefferson Lobo fazendo a leitura crítica desses fatos (nunca invente citação literal entre aspas — parafraseie a posição dele, atribuindo com "segundo Jefferson Lobo" ou "na leitura de Jefferson Lobo"). Mínimo 3000 caracteres no corpo.

Responda em JSON com TODOS estes campos preenchidos (corpo em parágrafos separados por \\n\\n):
{"titulo":"...","subtitulo":"...","corpo":"...","seo_title":"até 60 caracteres","seo_description":"até 155 caracteres","resumo":"2-3 frases autocontidas","tldr":"2-3 frases answer-first respondendo 'o que aconteceu?'","fatos_5w1h":{"quem":"...","o_que":"...","quando":"...","onde":"...","por_que":"...","como":"..."},"faq":[{"pergunta":"...","resposta":"1-3 frases baseadas somente no texto"}]}`,
          },
        ],
      }),
    });
    if (!resp.ok) {
      return Response.json(
        { error: "geracao_especial_falhou", detail: (await resp.text()).slice(0, 300) },
        { status: 502 },
      );
    }
    const data = await resp.json();
    let draft: { titulo: string; subtitulo: string; corpo: string };
    try {
      draft = JSON.parse(data.choices[0].message.content);
    } catch {
      return Response.json({ error: "geracao_especial_invalida" }, { status: 502 });
    }

    const agora = new Date().toISOString();
    const { data: artigo, error: insErr } = await sb
      .from("generated_articles")
      .insert({
        titulo: draft.titulo,
        subtitulo: draft.subtitulo,
        slug: slugify(draft.titulo),
        corpo: draft.corpo,
        categoria_id: catTec.id,
        regiao_id: regiaoNacional.id,
        status: "publicado",
        publicado_automaticamente: true,
        serie_semanal_jefferson: true,
        gerado_em: agora,
        publicado_em: agora,
      })
      .select("id, slug")
      .single();
    if (insErr) {
      return Response.json(
        { error: "insert_especial_falhou", detail: insErr.message },
        { status: 500 },
      );
    }
    return Response.json({
      ok: true,
      tipo: "edicao_especial_jefferson",
      article: artigo,
    });
  }

  // 3. Publicação comum: melhor cluster de tecnologia pendente.
  const { data: cluster } = await sb
    .from("article_clusters")
    .select("id")
    .eq("categoria_id", catTec.id)
    .eq("curadoria_nacional", true)
    .eq("status", "novo")
    .order("prioridade_score", { ascending: false })
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!cluster) {
    return Response.json({
      ok: true,
      aguardando: true,
      motivo: "Nenhum cluster de Tecnologia pendente no momento.",
    });
  }

  const ef = await fetch(`${selfUrl}/functions/v1/extract-facts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${selfKey}`,
    },
    body: JSON.stringify({ cluster_id: cluster.id }),
  });
  if (!ef.ok) {
    return Response.json(
      { error: "extract_facts_falhou", detail: (await ef.text()).slice(0, 300) },
      { status: 502 },
    );
  }

  const ga = await fetch(`${selfUrl}/functions/v1/generate-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${selfKey}`,
    },
    body: JSON.stringify({ cluster_id: cluster.id }),
  });
  if (!ga.ok) {
    return Response.json(
      { error: "generate_article_falhou", detail: (await ga.text()).slice(0, 300) },
      { status: 502 },
    );
  }
  const gaData = await ga.json();

  // generate-article decide auto-publicação por interesse_score (pipeline
  // regional); a curadoria usa prioridade_score, então aquele auto-publish
  // nunca dispara aqui. Esta editoria publica sozinha — força o status.
  if (gaData.article?.id) {
    await sb
      .from("generated_articles")
      .update({
        status: "publicado",
        publicado_automaticamente: true,
        publicado_em: new Date().toISOString(),
      })
      .eq("id", gaData.article.id);
  }

  return Response.json({
    ok: true,
    tipo: "publicacao_comum",
    article: gaData.article ?? null,
  });
}

export const Route = createFileRoute("/api/public/publicar-tecnologia-periodico")({
  server: {
    handlers: {
      GET: async () => run(),
      POST: async () => run(),
    },
  },
});
