// Vozes Paranaenses — cluster-articles
// Agrupa `raw_articles` não processados sobre o MESMO fato usando embeddings
// (openai/text-embedding-3-small via Lovable AI Gateway) + similaridade
// cosseno na tabela `raw_articles` (pgvector). Gera clusters em
// `article_clusters` + `cluster_articles` e marca raws como `processado=true`.
//
// Body opcional: { regiao_id?: string, limit?: number, threshold?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-3-small";

type Raw = {
  id: string;
  regiao_id: string | null;
  titulo: string | null;
  corpo_limpo: string | null;
  embedding: number[] | null;
  fonte: { tipo: string; curadoria_editoria: string | null } | { tipo: string; curadoria_editoria: string | null }[] | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { regiao_id?: string; limit?: number; threshold?: number; fonte_tipo?: "veiculo" | "prefeitura" } = {};
  try { body = await req.json(); } catch { body = {}; }
  const limit = Math.min(body.limit ?? 100, 200);
  const threshold = body.threshold ?? 0.82;

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Tenta com a coluna nova de curadoria (migration 041). Se ela ainda não
  // foi rodada no banco, a consulta falha por coluna inexistente — nesse
  // caso, refaz sem essa coluna, em vez de derrubar o pipeline inteiro
  // (clustering normal do Paraná não pode depender de uma feature opcional
  // ainda não instalada).
  async function buscarRaws(comCuradoria: boolean) {
    let q = sb
      .from("raw_articles")
      .select(
        comCuradoria
          ? "id, regiao_id, titulo, corpo_limpo, embedding, fonte:fonte_id(tipo, curadoria_editoria)"
          : "id, regiao_id, titulo, corpo_limpo, embedding, fonte:fonte_id(tipo)",
      )
      .eq("processado", false)
      .order("coletado_em", { ascending: false })
      .limit(limit);
    if (body.regiao_id) q = q.eq("regiao_id", body.regiao_id);
    return q;
  }

  let { data: raws, error } = await buscarRaws(true);
  let curadoriaDisponivel = true;
  if (error) {
    console.warn("[cluster-articles] coluna de curadoria indisponível (migration 041 pendente?), seguindo sem ela:", error.message);
    curadoriaDisponivel = false;
    ({ data: raws, error } = await buscarRaws(false));
  }
  if (error) return json({ error: "raw_query_failed", detail: error.message }, 500);
  if (!raws?.length) return json({ ok: true, processed: 0, clusters: 0 });

  // Filtro opcional por tipo de fonte — usado pelo botão "Scrape prefeituras"
  // do painel, que quer clusterizar SÓ as raws oficiais recém-coletadas,
  // sem varrer o backlog de veículos/curadoria que ainda esteja pendente.
  if (body.fonte_tipo) {
    raws = (raws as Raw[]).filter((r) => {
      const f = Array.isArray(r.fonte) ? r.fonte[0] : r.fonte;
      return f?.tipo === body.fonte_tipo;
    });
    if (!raws.length) return json({ ok: true, processed: 0, clusters: 0 });
  }

  // 1. Fontes oficiais (prefeitura) não precisam de embedding nem de
  //    cruzamento com outra fonte — cada release já é, por natureza,
  //    elegível sozinho. Viram cluster de 1 item na hora, sem entrar no
  //    laço de similaridade abaixo (que é só para veículos de imprensa).
  const isOficial = (r: Raw) => {
    const f = Array.isArray(r.fonte) ? r.fonte[0] : r.fonte;
    return f?.tipo === "prefeitura";
  };
  const curadoriaTag = (r: Raw): string | null => {
    const f = Array.isArray(r.fonte) ? r.fonte[0] : r.fonte;
    return f?.curadoria_editoria ?? null;
  };
  const rawsOficiais = (raws as Raw[]).filter(isOficial);
  const rawsCuradoria = (raws as Raw[]).filter((r) => !isOficial(r) && curadoriaTag(r));
  const rawsVeiculo = (raws as Raw[]).filter((r) => !isOficial(r) && !curadoriaTag(r));

  let createdOficiais = 0;
  for (const r of rawsOficiais) {
    if (!r.regiao_id) continue;
    const { data: cluster, error: cErr } = await sb
      .from("article_clusters")
      .insert({ regiao_id: r.regiao_id, prioridade_score: 1, status: "novo", fonte_oficial: true })
      .select("id")
      .single();
    if (cErr || !cluster) { console.error("cluster oficial insert failed", cErr?.message); continue; }
    await sb.from("cluster_articles").insert({ cluster_id: cluster.id, raw_article_id: r.id });
    await sb.from("raw_articles").update({ processado: true }).eq("id", r.id);
    createdOficiais++;
  }

  // 2. Veículos de imprensa seguem o fluxo normal (embedding + similaridade).
  const items = rawsVeiculo;
  const needEmbed = items.filter((r) => !r.embedding);
  let embedFalhas = 0;
  let ultimoErroEmbed: string | undefined;
  for (const r of needEmbed) {
    const text = `${r.titulo ?? ""}\n\n${r.corpo_limpo ?? ""}`.slice(0, 4000);
    if (!text.trim()) continue;
    const { vetor, erro } = await embed(text, aiKey);
    if (vetor) {
      r.embedding = vetor;
      await sb.from("raw_articles").update({ embedding: vetor }).eq("id", r.id);
    } else {
      embedFalhas++;
      ultimoErroEmbed = erro;
    }
  }

  // 2. Agrupar por região + similaridade cosseno (O(n²) simples)
  const withEmb = items.filter((r) => r.embedding && r.regiao_id);
  const groups: Raw[][] = [];
  const used = new Set<string>();
  for (const r of withEmb) {
    if (used.has(r.id)) continue;
    const g: Raw[] = [r];
    used.add(r.id);
    for (const o of withEmb) {
      if (used.has(o.id)) continue;
      if (o.regiao_id !== r.regiao_id) continue;
      const sim = cosine(r.embedding!, o.embedding!);
      if (sim >= threshold) {
        g.push(o);
        used.add(o.id);
      }
    }
    groups.push(g);
  }

  // 3. Persistir clusters (por região, como já era) + calcular embedding
  //    centróide de cada um, usado no passo seguinte para ligar clusters de
  //    regiões diferentes quando é a mesma notícia estadual.
  let created = 0;
  const novosClusters: { id: string; regiao_id: string; embedding: number[] }[] = [];
  for (const g of groups) {
    const regiao_id = g[0].regiao_id!;
    const centroide = mediaVetores(g.map((r) => r.embedding!));
    const { data: cluster, error: cErr } = await sb
      .from("article_clusters")
      .insert({ regiao_id, prioridade_score: g.length, status: "novo", embedding_centroide: centroide })
      .select("id")
      .single();
    if (cErr || !cluster) {
      console.error("cluster insert failed", cErr?.message);
      continue;
    }
    const links = g.map((r) => ({ cluster_id: cluster.id, raw_article_id: r.id }));
    await sb.from("cluster_articles").insert(links);
    await sb.from("raw_articles").update({ processado: true }).in("id", g.map((r) => r.id));
    novosClusters.push({ id: cluster.id, regiao_id, embedding: centroide });
    created++;
  }

  // 3b. Curadoria nacional (Segurança/Esportes) — mesmo princípio de
  //     embedding + similaridade, mas SEM exigir região de detecção de
  //     cidade (são fontes nacionais/internacionais) e SEM misturar as
  //     duas editorias entre si. A categoria já é conhecida de antemão
  //     (vem da própria fonte), então o cluster nasce classificado, sem
  //     precisar do classify-and-quota. curadoria_nacional=true impede a
  //     seleção automática por cota — só escreve quando o admin clicar
  //     "Escrever agora" no painel de curadoria.
  //     Aponta pra região "Nacional" (já existe na taxonomia) — isso é o
  //     que faz essas matérias aparecerem também na home/nav de região,
  //     não só na editoria. Simplificação atual: tudo cai em "Nacional",
  //     mesmo quando o fato é internacional — distinguir os dois exigiria
  //     detecção de país no texto, o que não faz parte deste escopo ainda.
  let createdCuradoria = 0;
  if (rawsCuradoria.length) {
    const needEmbedCur = rawsCuradoria.filter((r) => !r.embedding);
    for (const r of needEmbedCur) {
      const text = `${r.titulo ?? ""}\n\n${r.corpo_limpo ?? ""}`.slice(0, 4000);
      if (!text.trim()) continue;
      const { vetor } = await embed(text, aiKey);
      if (vetor) {
        r.embedding = vetor;
        await sb.from("raw_articles").update({ embedding: vetor }).eq("id", r.id);
      }
    }

    const [{ data: cats }, { data: regioesNacInt }] = await Promise.all([
      sb.from("editorial_categories").select("id, slug").in("slug", ["seguranca", "esportes"]),
      sb.from("regioes").select("id, slug").in("slug", ["nacional", "internacional"]),
    ]);
    const catIdBySlug = new Map((cats ?? []).map((c) => [c.slug, c.id]));
    const regiaoNacionalId = (regioesNacInt ?? []).find((r) => r.slug === "nacional")?.id ?? null;
    const regiaoInternacionalId = (regioesNacInt ?? []).find((r) => r.slug === "internacional")?.id ?? null;

    const withEmbCur = rawsCuradoria.filter((r) => r.embedding);
    for (const tag of ["seguranca", "esportes"] as const) {
      const categoriaId = catIdBySlug.get(tag);
      if (!categoriaId) continue;
      const doTag = withEmbCur.filter((r) => curadoriaTag(r) === tag);
      const usedCur = new Set<string>();
      const gruposCur: Raw[][] = [];
      for (const r of doTag) {
        if (usedCur.has(r.id)) continue;
        const g: Raw[] = [r];
        usedCur.add(r.id);
        for (const o of doTag) {
          if (usedCur.has(o.id)) continue;
          const sim = cosine(r.embedding!, o.embedding!);
          if (sim >= threshold) { g.push(o); usedCur.add(o.id); }
        }
        gruposCur.push(g);
      }
      for (const g of gruposCur) {
        const textoGrupo = g.map((r) => `${r.titulo ?? ""} ${r.corpo_limpo ?? ""}`).join(" ");
        const ehInternacional = pareceInternacional(textoGrupo);
        const regiaoDoCluster = ehInternacional ? (regiaoInternacionalId ?? regiaoNacionalId) : regiaoNacionalId;
        const { data: cluster, error: cErr } = await sb
          .from("article_clusters")
          .insert({
            regiao_id: regiaoDoCluster,
            categoria_id: categoriaId,
            prioridade_score: g.length,
            status: "novo",
            curadoria_nacional: true,
          })
          .select("id")
          .single();
        if (cErr || !cluster) { console.error("cluster curadoria insert failed", cErr?.message); continue; }
        const links = g.map((r) => ({ cluster_id: cluster.id, raw_article_id: r.id }));
        await sb.from("cluster_articles").insert(links);
        await sb.from("raw_articles").update({ processado: true }).in("id", g.map((r) => r.id));
        createdCuradoria++;
      }
    }
  }

  // 4. Vincular entre regiões: mesma notícia coberta por regiões diferentes
  //    vira o mesmo grupo_estadual_id — sem fundir a publicação, só para
  //    qualificar o interesse de leitura (ver classify-and-quota).
  let linked = 0;
  if (novosClusters.length) {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: outrosData } = await sb
      .from("article_clusters")
      .select("id, regiao_id, grupo_estadual_id, embedding_centroide")
      .not("embedding_centroide", "is", null)
      .gte("criado_em", since)
      .limit(300);
    const outros = (outrosData ?? []) as { id: string; regiao_id: string; grupo_estadual_id: string | null; embedding_centroide: number[] }[];
    const CROSS_REGION_THRESHOLD = 0.85;

    for (const novo of novosClusters) {
      let melhor: { id: string; grupo_estadual_id: string | null; sim: number } | null = null;
      for (const outro of outros) {
        if (outro.id === novo.id || outro.regiao_id === novo.regiao_id) continue;
        const sim = cosine(novo.embedding, outro.embedding_centroide);
        if (sim >= CROSS_REGION_THRESHOLD && (!melhor || sim > melhor.sim)) {
          melhor = { id: outro.id, grupo_estadual_id: outro.grupo_estadual_id, sim };
        }
      }
      if (melhor) {
        const grupoId = melhor.grupo_estadual_id ?? crypto.randomUUID();
        await sb.from("article_clusters").update({ grupo_estadual_id: grupoId }).eq("id", novo.id);
        if (!melhor.grupo_estadual_id) {
          await sb.from("article_clusters").update({ grupo_estadual_id: grupoId }).eq("id", melhor.id);
        }
        linked++;
      }
    }
  }

  return json({
    ok: true,
    processed: items.length + rawsOficiais.length + rawsCuradoria.length,
    clusters: created + createdOficiais + createdCuradoria,
    clusters_oficiais: createdOficiais,
    clusters_curadoria_nacional: createdCuradoria,
    linked_cross_regiao: linked,
    embeddings_falharam: embedFalhas,
    embeddings_tentados: needEmbed.length,
    aviso: embedFalhas > 0 && embedFalhas === needEmbed.length
      ? `TODOS os ${embedFalhas} embeddings falharam — nenhum cluster novo pôde ser formado. Último erro: ${ultimoErroEmbed}`
      : embedFalhas > 0
        ? `${embedFalhas}/${needEmbed.length} embeddings falharam. Último erro: ${ultimoErroEmbed}`
        : undefined,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function embed(text: string, apiKey: string): Promise<{ vetor: number[] | null; erro?: string }> {
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("embed failed", res.status, detalhe);
      const motivo = res.status === 402
        ? "saldo de IA esgotado (402)"
        : res.status === 401 || res.status === 403
          ? "chave de IA inválida/sem permissão"
          : `erro ${res.status}`;
      return { vetor: null, erro: `${motivo}: ${detalhe.slice(0, 200)}` };
    }
    const j = await res.json();
    const vetor = j.data?.[0]?.embedding ?? null;
    return { vetor, erro: vetor ? undefined : "resposta sem embedding" };
  } catch (e) {
    console.error("embed error", (e as Error).message);
    return { vetor: null, erro: `exceção: ${(e as Error).message}` };
  }
}

// Heurística simples pra separar Nacional de Internacional na curadoria:
// se o texto menciona o Brasil (ou "brasileir@"), é NACIONAL mesmo que cite
// um país estrangeiro junto (ex.: "Brasil vence a Argentina" — é sobre a
// seleção brasileira, não um fato estrangeiro). Só vira Internacional
// quando um país estrangeiro aparece e o Brasil não aparece em lugar
// nenhum. Na dúvida (nenhum dos dois aparece — comum em nota só de placar),
// cai em Nacional por padrão, já que a maioria das fontes é brasileira.
const PAIS_ESTRANGEIRO_RE = new RegExp(
  "\\b(argentina|estados unidos|eua|frança|alemanha|espanha|itália|portugal|inglaterra|" +
  "reino unido|londres|paris|china|japão|coreia do sul|rússia|ucrânia|israel|palestina|gaza|" +
  "méxico|colômbia|chile|uruguai|paraguai|bolívia|peru|equador|venezuela|canadá|austrália|" +
  "áfrica do sul|nigéria|egito|marrocos|catar|arábia saudita|irã|iraque|síria|afeganistão|" +
  "índia|paquistão|turquia|grécia|holanda|bélgica|suíça|áustria|polônia|suécia|noruega|" +
  "dinamarca|finlândia)\\b",
  "i",
);
const BRASIL_RE = /\b(brasil|brasileir[oa]s?)\b/i;

function pareceInternacional(texto: string): boolean {
  if (BRASIL_RE.test(texto)) return false;
  return PAIS_ESTRANGEIRO_RE.test(texto);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function mediaVetores(vetores: number[][]): number[] {
  const n = vetores.length;
  const dim = vetores[0]?.length ?? 0;
  const soma = new Array(dim).fill(0);
  for (const v of vetores) {
    for (let i = 0; i < dim; i++) soma[i] += v[i] ?? 0;
  }
  return soma.map((s) => s / n);
}
