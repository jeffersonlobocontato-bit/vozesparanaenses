// Vozes Paranaenses — process-pending-clusters
// Ação única (rodada manualmente pelo painel admin) para aplicar as regras
// novas de escrita automática nas pautas que ficaram paradas em
// `selecionado_cota` ou `fatos_extraidos` (sem rascunho gerado ainda).
// Para cada pauta pendente:
//   - se ainda está em `selecionado_cota`, chama extract-facts
//   - em seguida chama generate-article (que decide se auto-publica ou
//     manda pra fila de revisão conforme as regras vigentes)
//
// Body opcional: { limit?: number, regiao_id?: string }

import { exigirInterno } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirInterno(req);
    if (negado) return negado;
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  // As edge functions rodam no Lovable Cloud (SUPABASE_URL), não no
  // banco externo (EXTERNAL_SUPABASE_URL). Uso SUPABASE_URL só para
  // encadear extract-facts + generate-article; as consultas de dados
  // continuam no externo.
  const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
  const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;

  let body: { limit?: number; regiao_id?: string; sync?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }
  // Cada pauta faz 2 chamadas de IA (extrair fatos + escrever). Em modo
  // síncrono, lotes grandes estouram o gateway antes de devolver resposta ao
  // painel. Mantemos lotes pequenos por padrão para garantir retorno visível.
  const limit = Math.max(1, Math.min(body.limit ?? 2, body.sync ? 5 : 50));

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Pautas que estavam aguardando o próximo passo do pipeline.
  let q = sb
    .from("article_clusters")
    .select("id, status, interesse_score, criado_em")
    .in("status", ["selecionado_cota", "fatos_extraidos"])
    .order("interesse_score", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false })
    // Busca uma janela maior que o lote porque alguns clusters antigos podem
    // já ter generated_articles, mas continuar com status pendente por migração
    // incompleta. Se limitarmos antes de filtrar, a função devolve pendentes=0
    // e o painel para sem escrever nada.
    .limit(limit * 10);
  if (body.regiao_id) q = q.eq("regiao_id", body.regiao_id);

  const { data: pendentes, error } = await q;
  if (error) return json({ error: "query_failed", detail: error.message }, 500);
  if (!pendentes?.length) return json({ ok: true, processadas: 0 });

  // Filtra as que ainda não têm rascunho gerado (defesa extra: o status
  // 'rascunho_gerado' já cobre isso, mas a checagem evita retrabalho se
  // algo tiver ficado inconsistente).
  const ids = pendentes.map((c) => c.id);
  const { data: jaTem } = await sb
    .from("generated_articles")
    .select("cluster_id")
    .in("cluster_id", ids);
  const bloqueados = new Set((jaTem ?? []).map((r) => r.cluster_id));
  if (bloqueados.size) {
    await markClustersDone(sb, [...bloqueados]);
  }
  // Fase 1 (20/11/2026): pauta com coleta de mais de 24h já seria descartada
  // como "fora_do_dia" pelo generate-article, mas só DEPOIS de extrair fatos
  // (a etapa mais cara). Descarta antes, sem chamar a IA.
  const livres = pendentes.filter((c) => !bloqueados.has(c.id));
  const vencidas = await pautasVencidas(sb, livres.map((c) => c.id));
  if (vencidas.size) await descartar(sb, [...vencidas]);
  const fila = livres.filter((c) => !vencidas.has(c.id)).slice(0, limit);

  const runAll = async () => {
    const CONCURRENCY = body.sync ? 2 : 3;
    let extraidas = 0;
    let escritas = 0;
    const erros: Array<{ cluster_id: string; etapa: string; detalhe: string }> = [];
    const queue = [...fila];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const c = queue.shift();
        if (!c) return;
        try {
          if (c.status === "selecionado_cota") {
            const ef = await fetch(`${selfUrl}/functions/v1/extract-facts`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
              body: JSON.stringify({ cluster_id: c.id }),
            });
            if (!ef.ok) {
              erros.push({ cluster_id: c.id, etapa: "extract-facts", detalhe: (await ef.text()).slice(0, 300) });
              await registrarFalha(sb, c.id, ef.status);
              continue;
            }
            extraidas++;
          }
          const ga = await fetch(`${selfUrl}/functions/v1/generate-article`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
            // modo automático: crivo (matéria/nota/descarte), validador do
            // dia e publicação pela criticidade — ver generate-article.
            body: JSON.stringify({ cluster_id: c.id, modo: "automatico" }),
          });
          if (!ga.ok) {
            erros.push({ cluster_id: c.id, etapa: "generate-article", detalhe: (await ga.text()).slice(0, 300) });
            await registrarFalha(sb, c.id, ga.status);
            continue;
          }
          // Correção: sem isso, o cluster continuava com status
          // "selecionado_cota"/"fatos_extraidos" mesmo já tendo virado
          // matéria — qualquer chamada seguinte (o dreno de segurança do
          // painel, um duplo clique, ou outra aba rodando o pipeline ao
          // mesmo tempo) encontrava a MESMA pauta como "pendente" de novo
          // e escrevia outra matéria pra ela. Marcar como feito imediatamente
          // após escrever, não só na checagem de duplicata do início.
          await markClustersDone(sb, [c.id]);
          escritas++;
        } catch (e) {
          erros.push({ cluster_id: c.id, etapa: "exception", detalhe: (e as Error).message });
        }
      }
    });
    await Promise.all(workers);
    console.log(`[process-pending-clusters] concluído: pendentes=${fila.length} extraidas=${extraidas} escritas=${escritas} erros=${erros.length}`);
    return { extraidas, escritas, erros };
  };

  if (body.sync) {
    const resultado = await runAll();
    return json({ ok: true, pendentes: fila.length, mode: "sync", ...resultado });
  }
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  const task = runAll().catch((e) => console.error("[process-pending-clusters] background error", (e as Error).message));
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  return json({ ok: true, pendentes: fila.length, mode: "background" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function markClustersDone(sb: any, ids: string[]) {
  if (!ids.length) return;
  const { error } = await sb.from("article_clusters").update({ status: "rascunho_gerado" }).in("id", ids);
  if (!error) return;
  const invalidEnum = error.code === "22P02" || /rascunho_gerado|cluster_status/i.test(error.message ?? "");
  if (invalidEnum) {
    await sb.from("article_clusters").update({ status: "descartado" }).in("id", ids);
  }
}

// Fase 1 (20/11/2026) — trava contra pauta em loop. Antes, uma pauta que
// falhava (JSON truncado, nota inválida) continuava pendente e era repetida a
// cada 4 minutos: duas pautas chegaram a ~500 extrações de fatos cada.
const MAX_TENTATIVAS = 3;
// Falta de crédito, limite de taxa e IA pausada não são culpa da pauta.
const STATUS_NAO_CONTA = new Set([402, 403, 429, 503]);

// deno-lint-ignore no-explicit-any
async function registrarFalha(sb: any, clusterId: string, httpStatus: number) {
  if (STATUS_NAO_CONTA.has(httpStatus)) return;
  const { data } = await sb.from("article_clusters").select("tentativas_ia").eq("id", clusterId).maybeSingle();
  const tentativas = ((data as { tentativas_ia?: number } | null)?.tentativas_ia ?? 0) + 1;
  if (tentativas >= MAX_TENTATIVAS) {
    console.warn(`[process-pending-clusters] pauta ${clusterId} descartada após ${tentativas} falhas`);
    await descartar(sb, [clusterId]);
  }
  await sb.from("article_clusters").update({ tentativas_ia: tentativas }).eq("id", clusterId);
}

// deno-lint-ignore no-explicit-any
async function pautasVencidas(sb: any, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await sb.from("cluster_articles").select("cluster_id, raw_articles(coletado_em)").in("cluster_id", ids);
  const ultima = new Map<string, number>();
  for (const l of (data ?? []) as Array<{ cluster_id: string; raw_articles: { coletado_em: string | null } | null }>) {
    const t = l.raw_articles?.coletado_em ? Date.parse(l.raw_articles.coletado_em) : 0;
    ultima.set(l.cluster_id, Math.max(ultima.get(l.cluster_id) ?? 0, t));
  }
  const limite = Date.now() - 24 * 3600_000;
  return new Set([...ultima].filter(([, t]) => t > 0 && t < limite).map(([id]) => id));
}

// deno-lint-ignore no-explicit-any
async function descartar(sb: any, ids: string[]) {
  if (!ids.length) return;
  await sb.from("article_clusters").update({ status: "descartado" }).in("id", ids);
  const { data } = await sb.from("cluster_articles").select("raw_article_id").in("cluster_id", ids);
  const raws = ((data ?? []) as Array<{ raw_article_id: string }>).map((r) => r.raw_article_id);
  if (raws.length) await sb.from("raw_articles").update({ processado: true }).in("id", raws);
}
