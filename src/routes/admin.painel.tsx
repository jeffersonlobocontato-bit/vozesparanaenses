import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";
import { displayRegionName } from "@/lib/region-labels";

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
  const [pipelineBusy, setPipelineBusy] = useState(false);
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
        sb.from("article_clusters").select("*", { count: "exact", head: true }).eq("status", "novo"),
        sb.from("article_clusters").select("*", { count: "exact", head: true }).eq("status", "selecionado_cota"),
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
    setPipelineBusy(true);
    setPipelineLog(["Iniciando pipeline…"]);
    const steps: Array<{ name: string; fn: string; body?: Record<string, unknown> }> = [
      { name: "1/3 Scrape de fontes (forçado)", fn: "scrape-source", body: { force: true, sync: true } },
      { name: "2/3 Clustering", fn: "cluster-articles" },
      { name: "3/3 Classificação + cotas", fn: "classify-and-quota" },
    ];
    for (const s of steps) {
      setPipelineLog((l) => [...l, `${s.name}…`]);
      try {
        const { data, error } = await supabase.functions.invoke(s.fn, { body: s.body ?? {} });
        if (error) throw error;
        const summary = data && typeof data === "object" ? JSON.stringify(data).slice(0, 140) : "ok";
        setPipelineLog((l) => [...l, `  ✓ ${summary}`]);
      } catch (e: unknown) {
        setPipelineLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
        break;
      }
    }
    setPipelineLog((l) => [...l, "Pipeline finalizado."]);
    setPipelineBusy(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do portal e atalhos de gestão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="rounded border px-3 py-1.5 text-xs hover:bg-accent">↻ Atualizar</button>
          <button onClick={runPipeline} disabled={pipelineBusy}
            className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60">
            {pipelineBusy ? "Rodando pipeline…" : "▶ Rodar pipeline agora"}
          </button>
        </div>
      </div>

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {/* KPIs editoriais */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Editorial</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Rascunhos" value={m?.drafts} tone="amber" to="/admin" />
          <Kpi label="Aprovados" value={m?.approved} tone="blue" to="/admin" />
          <Kpi label="Publicados" value={m?.published} tone="green" to="/admin" />
          <Kpi label="Publicados hoje" value={m?.publishedToday} tone="green" />
          <Kpi label="Rejeitados" value={m?.rejected} tone="slate" to="/admin" />
        </div>
      </section>

      {/* Pipeline */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Coletado nas últimas 24h" value={m?.rawLast24h} tone="slate" />
          <Kpi label="Pautas novas" value={m?.clustersNovos} tone="amber" to="/admin/clusters" />
          <Kpi label="Selecionadas por cota" value={m?.clustersSelecionados} tone="blue" to="/admin/clusters" />
          <Kpi label="Fontes ativas" value={m ? `${m.fontesAtivas}/${m.fontesTotal}` : undefined} tone="slate" to="/admin/fontes" />
        </div>
        {m?.ultimaGeracao && (
          <p className="mt-2 text-xs text-muted-foreground">
            Última matéria gerada: {new Date(m.ultimaGeracao).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      {pipelineLog.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded border bg-muted p-2 text-[11px] leading-tight">
          {pipelineLog.join("\n")}
        </pre>
      )}

      {/* Atalhos */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Gestão</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Shortcut to="/admin" title="Fila editorial" desc="Revisar, editar e publicar matérias." />
          <Shortcut to="/admin/clusters" title="Diagnóstico do pipeline" desc="Clusters coletados, score de interesse e o que foi descartado por cota." />
          <Shortcut to="/admin/fontes" title="Fontes" desc="Cadastrar e ativar veículos monitorados." />
          <Shortcut to="/admin/regioes" title="Regiões e cotas" desc={`${m?.regioesAtivas ?? "—"} regiões ativas.`} />
          <Shortcut to="/admin/anuncios" title="Anúncios" desc="Anunciantes, campanhas, criativos e targeting." />
          <Shortcut to="/admin/senha" title="Minha senha" desc="Trocar a senha da conta editorial." />
        </div>
      </section>

      {/* Anúncios */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Anúncios</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Campanhas ativas" value={m ? `${m.campanhasAtivas}/${m.campanhasTotal}` : undefined} tone="green" to="/admin/anuncios" />
          <Kpi label="Criativos aprovados" value={m?.criativosAprovados} tone="blue" to="/admin/anuncios" />
          <Kpi label="Criativos pendentes" value={m?.criativosPendentes} tone="amber" to="/admin/anuncios" />
          <Kpi label="Impressões hoje" value={m?.impressoesHoje} tone="slate" to="/admin/anuncios" />
          <Kpi label="Cliques hoje" value={
            m ? `${m.cliquesHoje}${m.impressoesHoje ? ` · ${((m.cliquesHoje / m.impressoesHoje) * 100).toFixed(1)}%` : ""}` : undefined
          } tone="green" to="/admin/anuncios" />
        </div>
      </section>

      {/* Recentes */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimas matérias geradas</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          {recent.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma matéria gerada ainda.</p>}
          <ul className="divide-y">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(r.status)}`}>
                  {r.status}
                </span>
                <span className="flex-1 truncate">{r.titulo}</span>
                {r.regiao && <span className="hidden text-xs text-muted-foreground sm:inline">{displayRegionName(r.regiao.slug, r.regiao.nome)}</span>}
                <span className="text-xs text-muted-foreground">{new Date(r.gerado_em).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function statusTone(s: string) {
  if (s === "publicado") return "bg-green-100 text-green-800";
  if (s === "aprovado") return "bg-blue-100 text-blue-800";
  if (s === "rejeitado") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

function Kpi({ label, value, tone, to }: { label: string; value: number | string | undefined; tone: "amber" | "blue" | "green" | "slate"; to?: string }) {
  const toneMap: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-green-200 bg-green-50 text-green-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };
  const body = (
    <div className={`rounded-lg border p-4 ${toneMap[tone]} ${to ? "transition hover:shadow-sm" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value ?? "…"}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Shortcut({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="block rounded-lg border bg-card p-4 transition hover:border-[#0A2540] hover:shadow-sm">
      <div className="font-semibold text-[#0A2540]">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}