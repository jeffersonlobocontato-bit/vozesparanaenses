import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";
import { displayRegionName } from "@/lib/region-labels";
import {
  FileText, CheckCircle2, Send, XCircle, CalendarClock,
  Radar, Layers, ListChecks, Radio, Megaphone,
  Clock3, MousePointerClick, Eye, Users, Newspaper, Map,
  Bot, BookOpen, KeyRound, Activity, RefreshCw, Play,
} from "lucide-react";

export const Route = createFileRoute("/admin/painel")({
  component: AdminDashboard,
});

type Metrics = {
  drafts: number;
  approved: number;
  published: number;
  rejected: number;
  publishedToday: number;
  clustersNovos: number;
  clustersSelecionados: number;
  rawLast24h: number;
  fontesAtivas: number;
  fontesTotal: number;
  regioesAtivas: number;
  ultimaGeracao: string | null;
  campanhasAtivas: number;
  campanhasTotal: number;
  criativosPendentes: number;
  criativosAprovados: number;
  impressoesHoje: number;
  cliquesHoje: number;
};

type RecentDraft = {
  id: string;
  titulo: string;
  status: string;
  gerado_em: string;
  regiao: { slug: string; nome: string } | null;
};

function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState<"prefeituras" | "portais" | "curadoria" | null>(null);
  const pipelineBusy = pipelineRunning !== null;
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

      const [drafts, approved, published, rejected, publishedToday,
        clustersNovos, clustersSelecionados, rawLast24h,
        fontesAtivas, fontesTotal, regioesAtivas, ultima, recentRes,
        campanhasAtivas, campanhasTotal, criativosPendentes, criativosAprovados,
        impressoesHoje, cliquesHoje] = await Promise.all([
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "rascunho"),
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "aprovado"),
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "publicado"),
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "rejeitado"),
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "publicado").gte("publicado_em", startOfDay.toISOString()),
        // Contamos só os clusters de curadoria nacional porque é o
        // único conjunto que a página /admin/clusters exibe. Os
        // paranaenses fluem automaticamente pelo pipeline até virar
        // rascunho em generated_articles (visto em /admin), então
        // contar todos aqui deixava o KPI mostrando 166/28 mas o card
        // abria uma tela vazia.
        sb.from("article_clusters").select("*", { count: "exact", head: true }).eq("status", "novo").eq("curadoria_nacional", true),
        sb.from("article_clusters").select("*", { count: "exact", head: true }).eq("status", "selecionado_cota").eq("curadoria_nacional", true),
        sb.from("raw_articles").select("*", { count: "exact", head: true }).gte("coletado_em", since24h),
        sb.from("fontes").select("*", { count: "exact", head: true }).eq("ativo", true),
        sb.from("fontes").select("*", { count: "exact", head: true }),
        sb.from("regioes").select("*", { count: "exact", head: true }).eq("ativa", true),
        sb.from("generated_articles").select("gerado_em").order("gerado_em", { ascending: false }).limit(1).maybeSingle(),
        sb.from("generated_articles")
          .select("id, titulo, status, gerado_em, regiao:regioes(slug, nome)")
          .order("gerado_em", { ascending: false })
          .limit(8),
        sb.from("ad_campaigns").select("*", { count: "exact", head: true }).eq("status", "ativa"),
        sb.from("ad_campaigns").select("*", { count: "exact", head: true }),
        sb.from("ad_creatives").select("*", { count: "exact", head: true }).eq("aprovado", false),
        sb.from("ad_creatives").select("*", { count: "exact", head: true }).eq("aprovado", true),
        sb.from("ad_impressions").select("*", { count: "exact", head: true }).gte("servido_em", startOfDay.toISOString()),
        sb.from("ad_clicks").select("*", { count: "exact", head: true }).gte("clicado_em", startOfDay.toISOString()),
      ]);

      const errs = [drafts, approved, published, rejected, publishedToday, clustersNovos, clustersSelecionados, rawLast24h, fontesAtivas, fontesTotal, regioesAtivas, recentRes, campanhasAtivas, campanhasTotal, criativosPendentes, criativosAprovados, impressoesHoje, cliquesHoje].map(r => r.error).filter(Boolean);
      if (errs.length) throw errs[0];

      setM({
        drafts: drafts.count ?? 0,
        approved: approved.count ?? 0,
        published: published.count ?? 0,
        rejected: rejected.count ?? 0,
        publishedToday: publishedToday.count ?? 0,
        clustersNovos: clustersNovos.count ?? 0,
        clustersSelecionados: clustersSelecionados.count ?? 0,
        rawLast24h: rawLast24h.count ?? 0,
        fontesAtivas: fontesAtivas.count ?? 0,
        fontesTotal: fontesTotal.count ?? 0,
        regioesAtivas: regioesAtivas.count ?? 0,
        ultimaGeracao: (ultima.data as { gerado_em: string } | null)?.gerado_em ?? null,
        campanhasAtivas: campanhasAtivas.count ?? 0,
        campanhasTotal: campanhasTotal.count ?? 0,
        criativosPendentes: criativosPendentes.count ?? 0,
        criativosAprovados: criativosAprovados.count ?? 0,
        impressoesHoje: impressoesHoje.count ?? 0,
        cliquesHoje: cliquesHoje.count ?? 0,
      });
      setRecent((recentRes.data ?? []) as unknown as RecentDraft[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar métricas");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runPipeline() {
    setPipelineRunning("portais");
    setPipelineLog(["Iniciando pipeline…"]);
    // Cada etapa é chamada em lotes pequenos porque o `supabase.functions.invoke`
    // do browser fecha a conexão em ~60s. Antes rodávamos `cluster-articles`
    // sem limite (limite padrão 100) e a chamada estourava o timeout — a função
    // continuava rodando no servidor, mas o front-end via erro e abortava o
    // pipeline. Agora fatiamos em lotes de 25 e loopamos até esvaziar a fila.
    try {
      // 1/4 Scrape em lotes pequenos. Rodar todos os portais em uma única
      // chamada síncrona pode passar do limite do gateway e abortar o pipeline
      // antes de chegar na escrita, mesmo já havendo matérias coletadas.
      setPipelineLog((l) => [...l, "1/4 Scrape de fontes (em lotes)…"]);
      const scrapeBatchSize = 6;
      for (let i = 0; i < 12; i++) {
        const scrape = await supabase.functions.invoke("scrape-source", {
          body: { force: true, sync: true, apenas_curadoria: false, limit: scrapeBatchSize, offset: i * scrapeBatchSize },
        });
        if (scrape.error) {
          setPipelineLog((l) => [...l, `  ⚠ scrape lote ${i + 1} falhou (${scrape.error.message}); seguindo para clusterizar o que já foi coletado.`]);
          break;
        }
        const sd = (scrape.data ?? {}) as { processed?: number; total_eligible?: number; report?: Array<{ inserted?: number }> };
        const inseridos = sd.report?.reduce((sum, row) => sum + (row.inserted ?? 0), 0) ?? 0;
        setPipelineLog((l) => [...l, `  lote ${i + 1}: fontes=${sd.processed ?? 0}/${sd.total_eligible ?? "?"} novas=${inseridos}`]);
        if (!sd.processed || sd.processed < scrapeBatchSize) break;
      }

      // 2/4 Clustering em lotes de 25 (~25s cada) até drenar
      setPipelineLog((l) => [...l, "2/4 Clustering (em lotes)…"]);
      for (let i = 1; i <= 20; i++) {
        const r = await supabase.functions.invoke("cluster-articles", { body: { limit: 25, fonte_tipo: "veiculo", apenas_curadoria: false } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { processed?: number; clusters?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: processado=${d.processed ?? 0} clusters=${d.clusters ?? 0}`]);
        if (!d.processed) break;
      }

      // 3/4 + 4/4 em ciclos: classifica um lote e já escreve o que foi
      // selecionado. Antes o painel tentava drenar TODA a classificação antes
      // de começar a escrita; se a aba/HTTP caísse no meio, parecia
      // "finalizado", mas nenhuma matéria nova era gerada.
      setPipelineLog((l) => [...l, "3/4 Classificação + cotas e 4/4 escrita (em ciclos seguros)…"]);
      for (let i = 1; i <= 30; i++) {
        const r = await supabase.functions.invoke("classify-and-quota", { body: { sync: true, limit: 15 } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { classified?: number; selected?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: classificados=${d.classified ?? 0} selecionados=${d.selected ?? 0}`]);
        if (!d.classified) break;
        if ((d.selected ?? 0) > 0) {
          const w = await supabase.functions.invoke("process-pending-clusters", { body: { limit: 5, sync: true } });
          if (w.error) throw w.error;
          const wd = (w.data ?? {}) as { pendentes?: number; escritas?: number; erros?: Array<{ etapa?: string; detalhe?: string }> };
          setPipelineLog((l) => [...l, `    escrita: pendentes=${wd.pendentes ?? 0} escritas=${wd.escritas ?? 0} erros=${wd.erros?.length ?? 0}`]);
          if (wd.erros?.length) {
            const first = wd.erros[0];
            setPipelineLog((l) => [...l, `    aviso: ${first.etapa ?? "escrita"} — ${(first.detalhe ?? "erro ao gerar matéria").slice(0, 220)}`]);
          }
          if (wd.erros?.length && !wd.escritas) throw new Error(`${wd.erros[0]?.etapa ?? "escrita"}: ${wd.erros[0]?.detalhe ?? "erro ao gerar matéria"}`);
        }
      }

      setPipelineLog((l) => [...l, "Drenando pautas já selecionadas que ficaram pendentes…"]);
      for (let i = 1; i <= 30; i++) {
        const r = await supabase.functions.invoke("process-pending-clusters", { body: { limit: 5, sync: true } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { pendentes?: number; escritas?: number; erros?: Array<{ etapa?: string; detalhe?: string }> };
        setPipelineLog((l) => [...l, `  pendente ${i}: pendentes=${d.pendentes ?? 0} escritas=${d.escritas ?? 0} erros=${d.erros?.length ?? 0}`]);
        if (d.erros?.length) {
          const first = d.erros[0];
          setPipelineLog((l) => [...l, `    aviso: ${first.etapa ?? "escrita"} — ${(first.detalhe ?? "erro ao gerar matéria").slice(0, 220)}`]);
        }
        if (d.erros?.length && !d.escritas) throw new Error(`${d.erros[0]?.etapa ?? "escrita"}: ${d.erros[0]?.detalhe ?? "erro ao gerar matéria"}`);
        if (!d.pendentes || !d.escritas) break;
      }
    } catch (e: unknown) {
      setPipelineLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
      setPipelineLog((l) => [...l, "Pipeline interrompido — nenhuma etapa seguinte foi mascarada como concluída."]);
      setPipelineRunning(null);
      load();
      return;
    }
    setPipelineLog((l) => [...l, "Pipeline finalizado."]);
    setPipelineRunning(null);
    load();
  }

  async function runPrefeituras() {
    setPipelineRunning("prefeituras");
    setPipelineLog(["Coletando releases oficiais de prefeituras…"]);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-prefeitura", { body: { force: true, sync: true } });
      if (error) throw error;
      const summary = data && typeof data === "object" ? JSON.stringify(data).slice(0, 240) : "ok";
      setPipelineLog((l) => [...l, `  ✓ ${summary}`]);
      // Encadeia clustering (em lotes, pra não estourar o timeout do
      // browser) + classificação pra as matérias oficiais entrarem na fila.
      setPipelineLog((l) => [...l, "cluster-articles (em lotes)…"]);
      for (let i = 1; i <= 20; i++) {
        const r = await supabase.functions.invoke("cluster-articles", { body: { limit: 25, fonte_tipo: "prefeitura" } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { processed?: number; clusters?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: processado=${d.processed ?? 0} clusters=${d.clusters ?? 0}`]);
        if (!d.processed) break;
      }
      setPipelineLog((l) => [...l, "classificação + escrita (em ciclos seguros)…"]);
      for (let i = 1; i <= 30; i++) {
        const r = await supabase.functions.invoke("classify-and-quota", { body: { sync: true, limit: 15 } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { classified?: number; selected?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: classificados=${d.classified ?? 0} selecionados=${d.selected ?? 0}`]);
        if (!d.classified) break;
        if ((d.selected ?? 0) > 0) {
          const w = await supabase.functions.invoke("process-pending-clusters", { body: { limit: 5, sync: true } });
          if (w.error) throw w.error;
          const wd = (w.data ?? {}) as { pendentes?: number; escritas?: number; erros?: Array<{ etapa?: string; detalhe?: string }> };
          setPipelineLog((l) => [...l, `    escrita: pendentes=${wd.pendentes ?? 0} escritas=${wd.escritas ?? 0} erros=${wd.erros?.length ?? 0}`]);
          if (wd.erros?.length) {
            const first = wd.erros[0];
            setPipelineLog((l) => [...l, `    aviso: ${first.etapa ?? "escrita"} — ${(first.detalhe ?? "erro ao gerar matéria").slice(0, 220)}`]);
          }
          if (wd.erros?.length && !wd.escritas) throw new Error(`${wd.erros[0]?.etapa ?? "escrita"}: ${wd.erros[0]?.detalhe ?? "erro ao gerar matéria"}`);
        }
      }
      setPipelineLog((l) => [...l, "Drenando pautas já selecionadas que ficaram pendentes…"]);
      for (let i = 1; i <= 30; i++) {
        const r = await supabase.functions.invoke("process-pending-clusters", { body: { limit: 5, sync: true } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { pendentes?: number; escritas?: number; erros?: Array<{ etapa?: string; detalhe?: string }> };
        setPipelineLog((l) => [...l, `  pendente ${i}: pendentes=${d.pendentes ?? 0} escritas=${d.escritas ?? 0} erros=${d.erros?.length ?? 0}`]);
        if (d.erros?.length) {
          const first = d.erros[0];
          setPipelineLog((l) => [...l, `    aviso: ${first.etapa ?? "escrita"} — ${(first.detalhe ?? "erro ao gerar matéria").slice(0, 220)}`]);
        }
        if (d.erros?.length && !d.escritas) throw new Error(`${d.erros[0]?.etapa ?? "escrita"}: ${d.erros[0]?.detalhe ?? "erro ao gerar matéria"}`);
        if (!d.pendentes || !d.escritas) break;
      }
    } catch (e: unknown) {
      setPipelineLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
      setPipelineLog((l) => [...l, "Scraping interrompido — nenhuma etapa seguinte foi mascarada como concluída."]);
      setPipelineRunning(null);
      load();
      return;
    }
    setPipelineLog((l) => [...l, "Scraping de prefeituras finalizado."]);
    setPipelineRunning(null);
    load();
  }

  async function runCuradoria(editorias: string[], rotulo: string) {
    setPipelineRunning("curadoria");
    setPipelineLog([`Coletando fontes de curadoria — ${rotulo}…`]);
    try {
      const scrape = await supabase.functions.invoke("scrape-source", {
        body: { force: true, sync: true, curadoria_editorias: editorias },
      });
      if (scrape.error) throw scrape.error;
      const sd = (scrape.data ?? {}) as { report?: Array<{ inserted?: number; inserted_id?: string | null }> };
      const insertedIds = (sd.report ?? [])
        .filter((row) => (row.inserted ?? 0) > 0 && row.inserted_id)
        .map((row) => row.inserted_id as string);
      setPipelineLog((l) => [...l, `  ✓ ${JSON.stringify(scrape.data).slice(0, 200)}`]);
      if (!insertedIds.length) {
        setPipelineLog((l) => [...l, "  • Nenhuma matéria nova foi coletada neste ciclo; não vou reaproveitar pauta antiga/backlog."]);
        setPipelineLog((l) => [...l, `Coleta de ${rotulo} finalizada sem novidades.`]);
        setPipelineRunning(null);
        load();
        return;
      }
      setPipelineLog((l) => [...l, `cluster-articles (em lotes, só ${rotulo})…`]);
      for (let i = 1; i <= 20; i++) {
        const r = await supabase.functions.invoke("cluster-articles", {
          body: { limit: 25, curadoria_editorias: editorias, raw_article_ids: insertedIds },
        });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { processed?: number; clusters?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: processado=${d.processed ?? 0} clusters=${d.clusters ?? 0}`]);
        if (!d.processed) break;
      }
      setPipelineLog((l) => [...l, "classify-and-quota (em lotes, sem escrever sozinho)…"]);
      for (let i = 1; i <= 30; i++) {
        const r = await supabase.functions.invoke("classify-and-quota", { body: { sync: true, limit: 15 } });
        if (r.error) throw r.error;
        const d = (r.data ?? {}) as { classified?: number; selected?: number };
        setPipelineLog((l) => [...l, `  lote ${i}: classificados=${d.classified ?? 0} selecionados=${d.selected ?? 0}`]);
        if (!d.classified) break;
      }
    } catch (e: unknown) {
      setPipelineLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
      setPipelineLog((l) => [...l, "Coleta interrompida — nenhuma etapa seguinte foi mascarada como concluída."]);
      setPipelineRunning(null);
      load();
      return;
    }
    setPipelineLog((l) => [...l, `Coleta de ${rotulo} finalizada — vá em Curadoria pra decidir o que escrever.`]);
    setPipelineRunning(null);
    load();
  }

  const runCuradoriaSegurancaEsporte = () => runCuradoria(["seguranca", "esportes"], "Segurança & Esporte");
  const runCuradoriaGeral = () => runCuradoria(["geral"], "Nacional Geral");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0066CC]">Visão geral</p>
          <h1 className="mt-1 text-3xl font-bold text-[#0A2540]">Painel editorial</h1>
          <p className="mt-1 text-sm text-slate-500">Métricas em tempo real do portal, pipeline e monetização.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#0066CC] hover:text-[#0066CC]">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button onClick={runPrefeituras} disabled={pipelineBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-60">
            {pipelineRunning === "prefeituras" ? <><Activity className="h-3.5 w-3.5 animate-pulse" /> Coletando…</> : <><Radio className="h-3.5 w-3.5" /> Scrape prefeituras</>}
          </button>
          <button onClick={runPipeline} disabled={pipelineBusy}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A2540] to-[#0d3a6e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60">
            {pipelineRunning === "portais" ? <><Activity className="h-3.5 w-3.5 animate-pulse" /> Rodando pipeline…</> : <><Play className="h-3.5 w-3.5" /> Rodar pipeline agora</>}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {/* KPIs editoriais */}
      <Section title="Editorial" subtitle="Estado atual das matérias">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Rascunhos" value={m?.drafts} tone="amber" icon={FileText} to="/admin" />
          <Kpi label="Aprovados" value={m?.approved} tone="blue" icon={CheckCircle2} to="/admin" />
          <Kpi label="Publicados" value={m?.published} tone="green" icon={Send} to="/admin" />
          <Kpi label="Publicados hoje" value={m?.publishedToday} tone="teal" icon={CalendarClock} />
          <Kpi label="Rejeitados" value={m?.rejected} tone="rose" icon={XCircle} to="/admin" />
        </div>
      </Section>

      {/* Pipeline — 4 cards, cada um com scraping próprio e destino claro */}
      <Section title="Pipeline" subtitle="Coleta, curadoria e geração automática — 1 botão por origem">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PipelineCard
            tone="teal"
            titulo="Prefeituras (Paraná)"
            desc="Releases oficiais das cidades cadastradas. Escreve sozinho — cai direto na Fila pra revisar."
            to="/admin"
            actionLabel="▶ Rodar prefeituras"
            onAction={runPrefeituras}
            running={pipelineRunning === "prefeituras"}
            blocked={pipelineBusy && pipelineRunning !== "prefeituras"}
          />
          <PipelineCard
            tone="blue"
            titulo="Portais (Paraná)"
            desc="Veículos de imprensa regionais. Escreve sozinho — cai direto na Fila pra revisar."
            to="/admin"
            actionLabel="▶ Rodar portais"
            onAction={runPipeline}
            running={pipelineRunning === "portais"}
            blocked={pipelineBusy && pipelineRunning !== "portais"}
          />
          <PipelineCard
            tone="amber"
            titulo="Segurança & Esporte (Nacional)"
            desc="G1, Metrópoles, R7, CNN, ge, Lance!, ESPN, Gazeta. Nunca escreve sozinho — você decide na Curadoria."
            to="/admin/clusters"
            actionLabel="▶ Rodar coleta"
            onAction={runCuradoriaSegurancaEsporte}
            running={pipelineRunning === "curadoria"}
            blocked={pipelineBusy && pipelineRunning !== "curadoria"}
          />
          <PipelineCard
            tone="violet"
            titulo="Nacional — Geral"
            desc="Mesmas fontes gerais, classificadas pela IA fora de Segurança/Esporte. Nunca escreve sozinho."
            to="/admin/clusters"
            actionLabel="▶ Rodar coleta"
            onAction={runCuradoriaGeral}
            running={pipelineRunning === "curadoria"}
            blocked={pipelineBusy && pipelineRunning !== "curadoria"}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Coletado (24h)" value={m?.rawLast24h} tone="slate" icon={Radar} />
          <Kpi label="Pautas novas" value={m?.clustersNovos} tone="amber" icon={Layers} to="/admin/clusters" />
          <Kpi label="Selecionadas por cota" value={m?.clustersSelecionados} tone="blue" icon={ListChecks} to="/admin/clusters" />
          <Kpi label="Fontes ativas" value={m ? `${m.fontesAtivas}/${m.fontesTotal}` : undefined} tone="teal" icon={Radio} to="/admin/fontes" />
        </div>
        {m?.ultimaGeracao && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            <Clock3 className="h-3 w-3" /> Última matéria gerada: {new Date(m.ultimaGeracao).toLocaleString("pt-BR")}
          </p>
        )}
      </Section>

      {pipelineLog.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Activity className="h-3.5 w-3.5" /> Log do pipeline
          </div>
          <pre className="max-h-48 overflow-auto text-[11px] leading-tight text-emerald-200/90">
{pipelineLog.join("\n")}
          </pre>
        </div>
      )}

      {/* Atalhos */}
      <Section title="Gestão" subtitle="Atalhos das áreas de trabalho">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Shortcut to="/admin" icon={Newspaper} tone="blue" title="Fila editorial" desc={m ? `${m.drafts} rascunho${m.drafts === 1 ? "" : "s"} aguardando revisão.` : "Revisar, editar e publicar matérias."} />
          <Shortcut to="/admin/fontes" icon={Radio} tone="teal" title="Fontes" desc="Cadastrar e ativar veículos monitorados." />
          <Shortcut to="/admin/regioes" icon={Map} tone="violet" title="Regiões e cotas" desc={`${m?.regioesAtivas ?? "—"} regiões ativas no portal.`} />
          <Shortcut to="/admin/anuncios" icon={Megaphone} tone="rose" title="Anúncios" desc="Anunciantes, campanhas, criativos e targeting." />
          <Shortcut to="/admin/agentes" icon={Bot} tone="blue" title="Agentes IA" desc="Redatores especializados por editoria." />
          <Shortcut to="/admin/memoria-editorial" icon={BookOpen} tone="slate" title="Memória editorial" desc="Estilo, tom e diretrizes globais." />
          <Shortcut to="/admin/senha" icon={KeyRound} tone="slate" title="Minha senha" desc="Trocar a senha da conta editorial." />
        </div>
      </Section>

      {/* Anúncios */}
      <Section title="Anúncios" subtitle="Monetização e performance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Campanhas ativas" value={m ? `${m.campanhasAtivas}/${m.campanhasTotal}` : undefined} tone="green" icon={Megaphone} to="/admin/anuncios" />
          <Kpi label="Criativos aprovados" value={m?.criativosAprovados} tone="blue" icon={CheckCircle2} to="/admin/anuncios" />
          <Kpi label="Criativos pendentes" value={m?.criativosPendentes} tone="amber" icon={FileText} to="/admin/anuncios" />
          <Kpi label="Impressões hoje" value={m?.impressoesHoje} tone="violet" icon={Eye} to="/admin/anuncios" />
          <Kpi label="Cliques hoje" value={
            m ? `${m.cliquesHoje}${m.impressoesHoje ? ` · ${((m.cliquesHoje / m.impressoesHoje) * 100).toFixed(1)}%` : ""}` : undefined
          } tone="teal" icon={MousePointerClick} to="/admin/anuncios" />
        </div>
      </Section>

      {/* Recentes */}
      <Section title="Últimas matérias geradas" subtitle="Fluxo mais recente do redator IA">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {recent.length === 0 && (
            <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
              <Users className="h-4 w-4" /> Nenhuma matéria gerada ainda.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-slate-50">
                <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(r.status)}`}>
                  {r.status}
                </span>
                <span className="flex-1 truncate font-medium text-slate-800">{r.titulo}</span>
                {r.regiao && <span className="hidden text-xs text-slate-500 sm:inline">{displayRegionName(r.regiao.slug, r.regiao.nome)}</span>}
                <span className="text-xs text-slate-400">{new Date(r.gerado_em).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}

function statusTone(s: string) {
  if (s === "publicado") return "bg-emerald-100 text-emerald-700";
  if (s === "aprovado") return "bg-sky-100 text-sky-700";
  if (s === "rejeitado") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

type Tone = "amber" | "blue" | "green" | "slate" | "teal" | "rose" | "violet";

const ICON_TONE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-600",
  blue: "bg-sky-100 text-sky-600",
  green: "bg-emerald-100 text-emerald-600",
  slate: "bg-slate-100 text-slate-600",
  teal: "bg-teal-100 text-teal-600",
  rose: "bg-rose-100 text-rose-600",
  violet: "bg-violet-100 text-violet-600",
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#0A2540]">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, tone, icon: Icon, to }: {
  label: string; value: number | string | undefined; tone: Tone;
  icon?: React.ComponentType<{ className?: string }>; to?: string;
}) {
  const body = (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition ${to ? "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        {to && <span className="text-slate-300 transition group-hover:text-[#0066CC]">›</span>}
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-[#0A2540]">{value ?? "…"}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Shortcut({ to, title, desc, icon: Icon, tone }: {
  to: string; title: string; desc: string;
  icon: React.ComponentType<{ className?: string }>; tone: Tone;
}) {
  return (
    <Link to={to} className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-[#0A2540] group-hover:text-[#0066CC]">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
    </Link>
  );
}

function PipelineCard({ tone, titulo, desc, to, actionLabel, onAction, running, blocked }: {
  tone: Tone; titulo: string; desc: string; to: string;
  actionLabel: string; onAction: () => void; running: boolean; blocked: boolean;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
          <Play className="h-4 w-4" />
        </div>
        <div className="font-semibold text-[#0A2540]">{titulo}</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onAction}
          disabled={running || blocked}
          className="rounded-full bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {running ? "Rodando…" : actionLabel}
        </button>
        <Link to={to} className="text-xs font-semibold text-[#0066CC] hover:underline">
          Ver →
        </Link>
      </div>
    </div>
  );
}