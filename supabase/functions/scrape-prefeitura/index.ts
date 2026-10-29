// Vozes Paranaenses — scrape-prefeitura
// Coleta EXCLUSIVAMENTE fontes do tipo 'prefeitura' (assessoria de imprensa
// oficial) — função independente do scrape-source (veículos de imprensa),
// de propósito: cron próprio, sem compartilhar agendamento nem lógica com
// o scraping de portais/jornais. Mesmo mecanismo de coleta (RSS/HTML/
// Firecrawl) e mesmos ciclos fixos, só que sobre uma fatia diferente de
// `fontes` (tipo = 'prefeitura').
// Body opcional: { fonte_id?: string, force?: boolean, sync?: boolean }.

import { exigirInterno } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarCidades } from "../_shared/cidades.ts";
import { carregarNomesVeiculos, comLimiteDeTempo, MAX_PAGINAS_PREFEITURA, fonteElegivel, ordenarPorTentativa, processarItensDaFonte, type MetaPagina, type RelatorioFonte } from "../_shared/coleta.ts";
import { lerPaginaPrefeitura, scrapeFonte } from "../_shared/leitor-prefeitura.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Fonte = {
  id: string;
  regiao_id: string | null;
  nome: string;
  url_base: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  frequencia_horas: number | null;
  ultimo_scrape_em: string | null;
  cidade_slug: string | null;
  abrangencia: string | null;
};

// Ciclos 12h e 18h (Brasília), em lotes — ver ../_shared/coleta.ts.

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

  let body: { fonte_id?: string; force?: boolean; sync?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Fontes menos recentemente coletadas primeiro: cada chamada do cron
  // dentro da janela do ciclo pega o próximo lote.
  let query = sb
    .from("fontes")
    .select("id, regiao_id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ultimo_scrape_em, cidade_slug, abrangencia, ultimo_ciclo")
    .eq("ativo", true)
    .eq("tipo", "prefeitura")
    .order("ultimo_scrape_em", { ascending: true, nullsFirst: true });
  if (body.fonte_id) query = query.eq("id", body.fonte_id);

  const { data: fontes, error } = await query;
  if (error) return json({ error: "fontes_query_failed", detail: error.message }, 500);

  const [cidades, nomesVeiculos] = await Promise.all([carregarCidades(sb), carregarNomesVeiculos(sb)]);

  const eligible = ordenarPorTentativa((fontes ?? []) as Array<Fonte & { ultimo_ciclo?: { em?: string } | null }>)
    .filter((f) => body.fonte_id || body.force || fonteElegivel(f as Fonte));

  // Orçamento de tempo por chamada: o que não couber fica para a próxima
  // chamada do cron dentro da mesma janela do ciclo.
  const inicioExec = Date.now();
  const ORCAMENTO_MS = body.fonte_id || body.sync ? 35_000 : 110_000;
  const dentroDoOrcamento = () => Date.now() - inicioExec < ORCAMENTO_MS;

  async function processFonte(fonte: Fonte): Promise<RelatorioFonte> {
    const vazio = (erro: string): RelatorioFonte => ({ fonte: fonte.nome, total: 0, inseridas: 0, duplicadas: 0, sem_data: 0, fora_do_dia: 0, fotos: {}, erro });
    // Tempo-limite por fonte: site travado registra a tentativa e vai para o fim da fila.
    return comLimiteDeTempo(sb, fonte, async () => {
      const itens = await scrapeFonte(fonte);
      return await processarItensDaFonte({
        sb, fonte, itens, cidades, nomesVeiculos, dentroDoOrcamento,
        // Portal Atende.Net (IPM): leitor próprio, sem JavaScript nem Firecrawl.
        buscarPagina: lerPaginaPrefeitura,
        fotoSempreLiberada: true,
        aceitarOntem: true,
        maxPaginas: MAX_PAGINAS_PREFEITURA,
      });
    }, vazio);
  }


  // Se o cliente pediu explicitamente uma única fonte, roda inline e devolve
  // o relatório. Caso contrário, dispara em background e responde na hora
  // — o Edge Runtime tem timeout curto do lado do cliente (fetch) e o
  // pipeline no admin encadeia scrape → cluster → classify; travar aqui
  // fazia o botão "Rodar pipeline" abortar antes do fim.
  async function runAll(fontesList: Fonte[], paralelo = 6): Promise<RelatorioFonte[]> {
    const queue = [...fontesList];
    const results: RelatorioFonte[] = [];
    const workers = Array.from({ length: Math.min(paralelo, queue.length) }, async () => {
      while (queue.length) {
        if (!dentroDoOrcamento()) break; // resto fica para a próxima chamada do cron
        const f = queue.shift();
        if (!f) return;
        results.push(await processFonte(f));
      }
    });
    await Promise.all(workers);
    return results;
  }

  // Modo síncrono: usado pelo botão manual "Rodar pipeline" (que encadeia
  // scrape → cluster → classify e precisa que cada etapa termine de
  // verdade antes da próxima). Sem isso, os passos seguintes rodam sobre
  // uma raw_articles ainda vazia, porque o scraping real ainda não terminou.
  if (body.fonte_id || body.sync) {
    const results = await runAll(eligible as Fonte[]);
    return json({ ok: true, processed: results.length, total_eligible: eligible.length, report: results });
  }

  // Fora da janela do ciclo (ou ciclo já concluído), o cron chama e sai.
  if (!eligible.length) return json({ ok: true, queued: 0, mode: "idle" });

  // Lote pequeno por chamada: o cron chama a cada 3 min durante 2 h (40
  // chamadas × LOTE ≥ 188 prefeituras). Antes cada chamada tentava as 188
  // com 6 em paralelo, o worker em segundo plano era encerrado antes de
  // gravar qualquer coisa e as mesmas fontes voltavam ao topo da fila —
  // a coleta de prefeituras ficou parada (out/2026).
  const LOTE = 5;
  const queue = (eligible as Fonte[]).slice(0, LOTE);
  // Marca a tentativa já no início: a próxima chamada pega o lote seguinte
  // mesmo que este seja interrompido.
  const marca = new Date().toISOString();
  await Promise.all(queue.map((f) => sb.from("fontes").update({
    ultimo_ciclo: { fonte: f.nome, em: marca, andamento: true },
  }).eq("id", f.id)));
  const task = (async () => {
    const results = await runAll(queue, 2);
    const inseridas = results.reduce((n, r) => n + r.inseridas, 0);
    console.log(`[scrape-prefeitura] lote: ${results.length} fontes, ${inseridas} notícias do dia`);
    if (!inseridas) return;
    // Encadeia o resto do pipeline (cluster + classify) para que o usuário
    // não precise ficar apertando 3 botões — o scrape roda em background e
    // dispara os próximos passos automaticamente.
    for (const fn of ["cluster-articles", "classify-and-quota"]) {
      try {
        const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
        const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;
        const res = await fetch(`${selfUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${selfKey}`, apikey: selfKey },
          body: "{}",
        });
        console.log(`[scrape-prefeitura] chained ${fn} -> ${res.status}`);
      } catch (e) {
        console.error(`[scrape-prefeitura] chained ${fn} failed`, (e as Error).message);
      }
    }
  })();
  // Roda o lote DENTRO da requisição (não em EdgeRuntime.waitUntil): em
  // 28/10/2026 o lote em segundo plano era encerrado sem gravar nada (as
  // fontes ficavam "andamento: true" para sempre), enquanto a mesma coleta
  // inline gravou normal — e segue até o fim mesmo quando o pg_net do cron
  // desiste de esperar a resposta (timeout de 10 s). Lote de 5 cabe no
  // orçamento de 110 s.
  await task.catch((e) => console.error("[scrape-prefeitura] lote falhou", (e as Error).message));
  return json({ ok: true, queued: queue.length, restantes: eligible.length - queue.length, mode: "inline" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
