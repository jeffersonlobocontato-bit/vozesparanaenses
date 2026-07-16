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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
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
  const fila = pendentes.filter((c) => !bloqueados.has(c.id)).slice(0, limit);

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
            if (!ef.ok) { erros.push({ cluster_id: c.id, etapa: "extract-facts", detalhe: (await ef.text()).slice(0, 300) }); continue; }
            extraidas++;
          }
          const ga = await fetch(`${selfUrl}/functions/v1/generate-article`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
            body: JSON.stringify({ cluster_id: c.id }),
          });
          if (!ga.ok) { erros.push({ cluster_id: c.id, etapa: "generate-article", detalhe: (await ga.text()).slice(0, 300) }); continue; }
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
