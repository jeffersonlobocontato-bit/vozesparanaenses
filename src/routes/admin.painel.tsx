import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { displayRegionName } from "@/lib/region-labels";
import { PublishArticleBox } from "@/components/admin/PublishArticleBox";
import { CicloConteudo } from "@/components/admin/CicloConteudo";
import { PageHeader, refreshBtnClass } from "@/components/admin/ui";
import { AGENDA_076, type JobCron } from "@/lib/pipeline-agenda";
import {
  Send, Inbox, NotebookPen, Radar, Layers, Megaphone, Eye, MousePointerClick,
  RefreshCw, Clock3, ShieldAlert, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/admin/painel")({
  component: AdminDashboard,
});

type Resumo = {
  coletado: Record<string, number>;
  fontes_ativas: Record<string, number>;
  materias_publicadas: number;
  materias_revisao: number;
  notas_publicadas: number;
  notas_revisao: number;
  pautas_aguardando: number;
  ultima_materia: string | null;
};

type Anuncios = { campanhasAtivas: number; criativosPendentes: number; impressoesHoje: number; cliquesHoje: number };

type Recente = {
  id: string;
  slug: string;
  titulo: string;
  status: string;
  gerado_em: string;
  formato: string | null;
  criticidade_nivel: string | null;
  regiao: { slug: string; nome: string } | null;
};

function inicioDoDiaBrt(): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${hoje}T00:00:00-03:00`).toISOString();
}

function AdminDashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [jobs, setJobs] = useState<JobCron[]>([]);
  const [aoVivo, setAoVivo] = useState(false);
  const [ads, setAds] = useState<Anuncios | null>(null);
  const [recentes, setRecentes] = useState<Recente[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const desde = inicioDoDiaBrt();

      const [agenda, res, rec, camp, criat, imp, cli] = await Promise.all([
        sb.rpc("pipeline_agenda"),
        sb.rpc("pipeline_resumo_hoje"),
        sb.from("generated_articles")
          .select("id, slug, titulo, status, gerado_em, formato, criticidade_nivel, regiao:regioes(slug, nome)")
          .order("gerado_em", { ascending: false })
          .limit(10),
        sb.from("ad_campaigns").select("*", { count: "exact", head: true }).eq("status", "ativa"),
        sb.from("ad_creatives").select("*", { count: "exact", head: true }).eq("aprovado", false),
        sb.from("ad_impressions").select("*", { count: "exact", head: true }).gte("servido_em", desde),
        sb.from("ad_clicks").select("*", { count: "exact", head: true }).gte("clicado_em", desde),
      ]);

      // Grade: cron ao vivo (078) ou a de referência do 076.
      if (!agenda.error && Array.isArray(agenda.data)) {
        setJobs(agenda.data as JobCron[]);
        setAoVivo(true);
      } else {
        setJobs(AGENDA_076.map((j) => ({
          ...j, active: true, alvo: null, corpo: null, ultima_execucao: null, ultimo_status: null,
          ultima_mensagem: null, execucoes_24h: 0, falhas_24h: 0,
        })));
        setAoVivo(false);
      }

      if (!res.error && res.data) {
        setResumo(res.data as Resumo);
      } else {
        // Sem a 078: números essenciais direto das tabelas.
        const [pub, rev, nPub, nRev, ult] = await Promise.all([
          sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "publicado").gte("publicado_em", desde),
          sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "rascunho"),
          sb.from("coluna_cidade_notas").select("*", { count: "exact", head: true }).eq("status", "publicado").gte("publicado_em", desde),
          sb.from("coluna_cidade_notas").select("*", { count: "exact", head: true }).eq("status", "revisao"),
          sb.from("generated_articles").select("gerado_em").order("gerado_em", { ascending: false }).limit(1).maybeSingle(),
        ]);
        setResumo({
          coletado: {}, fontes_ativas: {},
          materias_publicadas: pub.count ?? 0, materias_revisao: rev.count ?? 0,
          notas_publicadas: nPub.count ?? 0, notas_revisao: nRev.count ?? 0,
          pautas_aguardando: 0,
          ultima_materia: (ult.data as { gerado_em: string } | null)?.gerado_em ?? null,
        });
      }

      if (rec.error) throw rec.error;
      setRecentes((rec.data ?? []) as unknown as Recente[]);
      setAds({
        campanhasAtivas: camp.count ?? 0,
        criativosPendentes: criat.count ?? 0,
        impressoesHoje: imp.count ?? 0,
        cliquesHoje: cli.count ?? 0,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar o painel");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const coletadoTotal = resumo ? Object.values(resumo.coletado).reduce((a, b) => a + b, 0) : undefined;
  const revisaoTotal = resumo ? resumo.materias_revisao + resumo.notas_revisao : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Visão geral"
        title="Painel"
        subtitle="O dia do portal: o que entrou, o que saiu e o que espera você."
        actions={
          <button onClick={load} className={refreshBtnClass()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        }
      />

      {err && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {/* Hoje */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Matérias publicadas hoje" value={resumo?.materias_publicadas} icon={Send} tone="green" />
        <Kpi label="Notas publicadas hoje" value={resumo?.notas_publicadas} icon={NotebookPen} tone="teal" to="/admin/notas-cidades" />
        <Kpi
          label="Esperando revisão"
          value={revisaoTotal}
          detalhe={resumo ? `${resumo.materias_revisao} matérias · ${resumo.notas_revisao} notas` : undefined}
          icon={Inbox}
          tone={revisaoTotal ? "amber" : "slate"}
          to="/admin"
        />
        <Kpi
          label={coletadoTotal !== undefined && aoVivo ? "Coletado hoje" : "Pautas na esteira"}
          value={aoVivo ? coletadoTotal : resumo?.pautas_aguardando}
          detalhe={aoVivo && resumo ? `${resumo.pautas_aguardando} pautas aguardando escrita` : undefined}
          icon={aoVivo ? Radar : Layers}
          tone="slate"
        />
      </section>

      {/* Ciclo de conteúdo */}
      <section>
        <SectionTitle
          title="Ciclo de conteúdo"
          subtitle="Quando cada frente coleta e o processamento escreve. Tudo roda sozinho; o botão adianta uma coleta fora da grade."
          aside={resumo?.ultima_materia && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              <Clock3 className="h-3 w-3" /> Última matéria: {new Date(resumo.ultima_materia).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        />
        <CicloConteudo
          jobs={jobs}
          aoVivo={aoVivo}
          coletadoHoje={resumo?.coletado ?? {}}
          fontesAtivas={resumo?.fontes_ativas ?? {}}
          onDisparado={load}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Últimas matérias */}
        <section>
          <SectionTitle title="Últimas matérias" subtitle="O que a redação automática acabou de produzir" />
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {recentes.length === 0 && <p className="p-6 text-sm text-slate-500">Nenhuma matéria ainda.</p>}
            <ul className="divide-y divide-slate-100">
              {recentes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <StatusPill status={r.status} />
                  {r.status === "rascunho" && r.criticidade_nivel && r.criticidade_nivel !== "baixo" && (
                    <span title={`Criticidade ${r.criticidade_nivel}`} className="text-amber-600"><ShieldAlert className="h-3.5 w-3.5" /></span>
                  )}
                  {r.status === "publicado" && r.regiao ? (
                    <a href={`/${r.regiao.slug}/${r.slug}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-[#E29F65]">
                      {r.titulo}
                    </a>
                  ) : (
                    <Link to="/admin" className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-[#E29F65]">{r.titulo}</Link>
                  )}
                  {r.regiao && <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{displayRegionName(r.regiao.slug, r.regiao.nome)}</span>}
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {new Date(r.gerado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Anúncios */}
        <section>
          <SectionTitle title="Anúncios hoje" subtitle="Monetização" />
          <Link to="/admin/anuncios" className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <dl className="grid grid-cols-2 gap-4">
              <Mini icon={Megaphone} label="Campanhas ativas" value={ads?.campanhasAtivas} />
              <Mini icon={Inbox} label="Criativos a aprovar" value={ads?.criativosPendentes} alerta={!!ads?.criativosPendentes} />
              <Mini icon={Eye} label="Impressões" value={ads?.impressoesHoje} />
              <Mini
                icon={MousePointerClick}
                label="Cliques"
                value={ads ? `${ads.cliquesHoje}${ads.impressoesHoje ? ` · ${((ads.cliquesHoje / ads.impressoesHoje) * 100).toFixed(1)}%` : ""}` : undefined}
              />
            </dl>
          </Link>
        </section>
      </div>

      {/* Publicação manual — fora do fluxo automático, recolhida por padrão */}
      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#12201E]">Publicar matéria manualmente</h2>
            <p className="text-xs text-slate-500">Texto próprio ou de parceiro. A IA completa SEO, TL;DR, 5W1H e FAQ.</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 p-5">
          <PublishArticleBox />
        </div>
      </details>
    </div>
  );
}

function SectionTitle({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#12201E]">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

type Tone = "amber" | "green" | "slate" | "teal";
const ICON_TONE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-600",
  green: "bg-emerald-100 text-emerald-600",
  slate: "bg-slate-100 text-slate-600",
  teal: "bg-teal-100 text-teal-600",
};

function Kpi({ label, value, detalhe, tone, icon: Icon, to }: {
  label: string; value: number | string | undefined; detalhe?: string; tone: Tone;
  icon: React.ComponentType<{ className?: string }>; to?: string;
}) {
  const body = (
    <div className={`flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition ${to ? "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : ""}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums text-[#12201E]">{value ?? "…"}</div>
        {detalhe && <div className="truncate text-xs text-slate-500">{detalhe}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Mini({ icon: Icon, label, value, alerta }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number | string | undefined; alerta?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className={`mt-0.5 text-lg font-bold tabular-nums ${alerta ? "text-amber-600" : "text-[#12201E]"}`}>{value ?? "…"}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    publicado: ["Publicado", "bg-emerald-100 text-emerald-700"],
    rascunho: ["Revisão", "bg-amber-100 text-amber-700"],
    rejeitado: ["Rejeitado", "bg-rose-100 text-rose-700"],
    expirado: ["Expirado", "bg-slate-100 text-slate-500"],
  };
  const [rotulo, cls] = map[status] ?? [status, "bg-slate-100 text-slate-600"];
  return <span className={`inline-flex w-20 shrink-0 justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{rotulo}</span>;
}
