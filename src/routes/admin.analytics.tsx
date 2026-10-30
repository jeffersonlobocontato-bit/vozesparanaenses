import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Activity, AlertOctagon, AlertTriangle, BarChart3, Database, FileText, Gauge, Lightbulb,
  MapPin, MousePointerClick, Newspaper, RefreshCw, Search, ShieldCheck, Target, Users, ExternalLink,
} from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { relatorioAnalytics, type RespostaAba } from "@/lib/ga4.functions";
import { ABAS, type Aba } from "@/lib/ga4-relatorios";
import {
  agrupar, canalPt, dispositivoPt, duracao, eventosPor, inteiro, leituras, num, pct, pctTexto, periodo, soma,
  variacao, VAZIO, type Extras, type Leitura, type Linha, type Relatorios,
} from "@/lib/analytics-leituras";
import { PageHeader, Section, ErrorBanner, EmptyState, campoClass, btn } from "@/components/admin/ui";
import { BasePropria } from "@/components/admin/analytics/BasePropria";

// Painel de Analytics do admin: o GA4 inteiro dentro do painel (API de Dados,
// via ga4.functions.ts) + o que só o nosso banco sabe (produção por editoria
// e região, aceite de cookies, base própria). Menu lateral por aba; cada aba
// abre com as LEITURAS (crítico, alerta, insight — analytics-leituras.ts).

type Busca = { aba?: Aba; dias?: number };
const DIAS = [
  { dias: 1, rotulo: "Hoje" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 28, rotulo: "28 dias" },
  { dias: 90, rotulo: "90 dias" },
] as const;

export const Route = createFileRoute("/admin/analytics")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    aba: ABAS.some((a) => a.id === s.aba) ? (s.aba as Aba) : undefined,
    dias: [1, 7, 28, 90].includes(Number(s.dias)) ? Number(s.dias) : undefined,
  }),
  component: AdminAnalytics,
});

// Cores dos gráficos (validadas: faixa de luminosidade, croma e contraste;
// a 2ª série vai tracejada porque a separação para daltonismo é limítrofe).
const COR = { atual: "#C97A3A", anterior: "#1F8A70", grade: "#E2E8F0", eixo: "#64748B" } as const;

const ICONE: Record<Aba, typeof Activity> = {
  visao: Gauge, "tempo-real": Activity, aquisicao: Target, publico: Users, conteudo: FileText,
  editorias: Newspaper, regioes: MapPin, engajamento: MousePointerClick, conversoes: BarChart3,
  busca: Search, qualidade: ShieldCheck, "base-propria": Database,
};
const GRUPOS: Array<{ titulo: string; abas: Aba[] }> = [
  { titulo: "Panorama", abas: ["visao", "tempo-real"] },
  { titulo: "Audiência", abas: ["aquisicao", "publico"] },
  { titulo: "Conteúdo", abas: ["conteudo", "editorias", "regioes"] },
  { titulo: "Resultado", abas: ["engajamento", "conversoes", "busca"] },
  { titulo: "Dados", abas: ["qualidade", "base-propria"] },
];

function AdminAnalytics() {
  const busca = Route.useSearch();
  const aba: Aba = busca.aba ?? "visao";
  const dias = busca.dias ?? 28;
  const navigate = Route.useNavigate();
  const [forcar, setForcar] = useState(0);
  const meta = ABAS.find((a) => a.id === aba)!;

  const ga = useQuery({
    queryKey: ["analytics-ga", aba, dias, forcar],
    enabled: aba !== "base-propria",
    queryFn: async (): Promise<RespostaAba> => {
      const sb = await getExternalBrowser();
      const token = (await sb.auth.getSession()).data.session?.access_token ?? "";
      return relatorioAnalytics({ data: { token, aba, dias, atualizar: forcar > 0 } });
    },
    staleTime: aba === "tempo-real" ? 30_000 : 5 * 60_000,
    refetchInterval: aba === "tempo-real" ? 60_000 : false,
  });
  const extras = useQuery({ queryKey: ["analytics-extras", dias], queryFn: () => carregarExtras(dias), staleTime: 5 * 60_000 });

  const rel: Relatorios = ga.data?.relatorios ?? {};
  const ex: Extras = extras.data ?? { dias };
  const lista = useMemo(() => (ga.data?.configurado ? leituras(aba, rel, ex) : []), [aba, ga.data, extras.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title={meta.rotulo}
        subtitle={meta.descricao}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {aba !== "tempo-real" && aba !== "base-propria" && (
              <select
                aria-label="Período"
                value={dias}
                onChange={(e) => navigate({ search: { aba, dias: Number(e.target.value) } })}
                className={campoClass}
              >
                {DIAS.map((d) => <option key={d.dias} value={d.dias}>{d.rotulo}</option>)}
              </select>
            )}
            {aba !== "base-propria" && (
              <button type="button" className={btn("secondary", "sm")} onClick={() => setForcar((n) => n + 1)} disabled={ga.isFetching}>
                <RefreshCw className={`h-4 w-4 ${ga.isFetching ? "animate-spin" : ""}`} aria-hidden /> Atualizar
              </button>
            )}
            <a className={btn("ghost", "sm")} href="https://analytics.google.com/analytics/web/#/a400813205p545150980/reports/intelligenthome" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> GA4
            </a>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Abas do Analytics" className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible">
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="flex shrink-0 gap-1 lg:flex-col">
                <p className="hidden px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 lg:block">{g.titulo}</p>
                {g.abas.map((id) => {
                  const a = ABAS.find((x) => x.id === id)!;
                  const Icone = ICONE[id];
                  const ativo = id === aba;
                  return (
                    <Link
                      key={id}
                      to="/admin/analytics"
                      search={{ aba: id, dias }}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
                        ativo ? "bg-[#12201E] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-[#12201E]"
                      }`}
                    >
                      <Icone className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="whitespace-nowrap">{a.rotulo}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {aba === "base-propria" ? (
            <BasePropria />
          ) : ga.isLoading ? (
            <p className="text-sm text-slate-500">Buscando no GA4…</p>
          ) : ga.error ? (
            <ErrorBanner>{ga.error instanceof Error ? ga.error.message : "Erro ao consultar o GA4"}</ErrorBanner>
          ) : ga.data && !ga.data.configurado ? (
            <SemCredencial motivo={ga.data.motivo} />
          ) : ga.data ? (
            <>
              <Leituras lista={lista} />
              <ConteudoAba aba={aba} r={rel} ex={ex} dias={dias} />
              <Rodape resp={ga.data} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ dados do banco
async function carregarExtras(dias: number): Promise<Extras> {
  const sb = await getExternalBrowser();
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const producaoEditoria: Record<string, number> = {};
  const producaoRegiao: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const { data, error } = await sb
      .from("generated_articles")
      .select("categoria:editorial_categories(slug), regiao:regioes(slug)")
      .eq("status", "publicado")
      .gte("publicado_em", desde)
      .range(i * 1000, i * 1000 + 999);
    if (error) break;
    for (const l of (data ?? []) as unknown as Array<{ categoria: { slug: string } | null; regiao: { slug: string } | null }>) {
      if (l.categoria?.slug) producaoEditoria[l.categoria.slug] = (producaoEditoria[l.categoria.slug] ?? 0) + 1;
      if (l.regiao?.slug) producaoRegiao[l.regiao.slug] = (producaoRegiao[l.regiao.slug] ?? 0) + 1;
    }
    if ((data ?? []).length < 1000) break;
  }
  let consentimento: Extras["consentimento"];
  try {
    const { data } = await sb.rpc("consentimento_resumo", { p_dias: dias });
    const linhas = (data ?? []) as Array<{ exibido: number; aceito: number; recusado: number }>;
    consentimento = linhas.reduce((a, l) => ({ exibido: a.exibido + l.exibido, aceito: a.aceito + l.aceito, recusado: a.recusado + l.recusado }), { exibido: 0, aceito: 0, recusado: 0 });
  } catch { /* sem a 098 */ }
  const { count } = await sb
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("tipo_evento", "pageview")
    .gte("ts", desde)
    .not("pagina", "like", "/admin%");
  return { dias, producaoEditoria, producaoRegiao, consentimento, pageviewsBase: count ?? undefined };
}

// ------------------------------------------------------------- peças comuns
function Leituras({ lista }: { lista: Leitura[] }) {
  if (!lista.length) {
    return (
      <Section>
        <p className="text-sm text-slate-500">Nada fora do normal nesta aba no período.</p>
      </Section>
    );
  }
  const estilo = {
    critico: { Icone: AlertOctagon, rotulo: "Crítico", caixa: "border-[#12201E] bg-[#12201E] text-white", sub: "text-white/80" },
    alerta: { Icone: AlertTriangle, rotulo: "Alerta", caixa: "border-[#E29F65] bg-[#E29F65]/15 text-[#12201E]", sub: "text-slate-700" },
    insight: { Icone: Lightbulb, rotulo: "Insight", caixa: "border-slate-200 bg-white text-[#12201E]", sub: "text-slate-600" },
  } as const;
  return (
    <section aria-label="Leituras do período" className="grid gap-3 md:grid-cols-2">
      {lista.map((l, i) => {
        const e = estilo[l.nivel];
        return (
          <div key={i} className={`rounded-2xl border p-4 shadow-sm ${e.caixa}`}>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
              <e.Icone className="h-4 w-4" aria-hidden /> {e.rotulo} · {l.titulo}
            </p>
            <p className={`mt-1.5 text-sm leading-relaxed ${e.sub}`}>{l.texto}</p>
          </div>
        );
      })}
    </section>
  );
}

function Kpi({ rotulo, valor, anterior, formato = "inteiro", inverso }: {
  rotulo: string; valor: number; anterior?: number; formato?: "inteiro" | "pct" | "duracao" | "decimal"; inverso?: boolean;
}) {
  const f = (v: number) => formato === "pct" ? pct(v) : formato === "duracao" ? duracao(v) : formato === "decimal" ? v.toFixed(2).replace(".", ",") : inteiro(v);
  const v = anterior === undefined ? null : variacao(valor, anterior);
  const bom = v === null ? null : inverso ? v < 0 : v >= 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#12201E]">{f(valor)}</p>
      {v !== null && (
        <p className={`mt-0.5 text-xs font-semibold ${bom ? "text-[#1F6B57]" : "text-[#B5651D]"}`}>
          {pctTexto(v)} <span className="font-normal text-slate-400">vs. {f(anterior ?? 0)}</span>
        </p>
      )}
    </div>
  );
}

function Kpis({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

/** Barras horizontais de um tom só (magnitude), com valor escrito ao lado. */
function Barras({ itens, formato = inteiro, vazio = "Sem dados no período." }: {
  itens: Array<{ rotulo: string; valor: number; detalhe?: string }>;
  formato?: (v: number) => string;
  vazio?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} title={`${i.rotulo}: ${formato(i.valor)}${i.detalhe ? ` · ${i.detalhe}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-[#12201E]">{i.rotulo}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {formato(i.valor)}
              {i.detalhe && <span className="ml-2 text-xs text-slate-400">{i.detalhe}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: COR.atual }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Coluna = { rotulo: string; valor: (l: Linha) => ReactNode; num?: boolean };
function Tabela({ colunas, linhas, vazio = "Sem dados no período." }: { colunas: Coluna[]; linhas: Linha[]; vazio?: string }) {
  if (!linhas.length) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {colunas.map((c) => <th key={c.rotulo} className={`px-2 py-2 font-semibold ${c.num ? "text-right" : ""}`}>{c.rotulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {colunas.map((c) => (
                <td key={c.rotulo} className={`px-2 py-1.5 ${c.num ? "text-right tabular-nums text-slate-700" : "max-w-[28rem] truncate text-[#12201E]"}`}>{c.valor(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Serie({ dados, series }: { dados: Array<Record<string, string | number>>; series: Array<{ chave: string; nome: string }> }) {
  if (!dados.length) return <p className="text-sm text-slate-500">Sem dados no período.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
        <XAxis dataKey="rotulo" fontSize={11} stroke={COR.eixo} tickLine={false} />
        <YAxis fontSize={11} stroke={COR.eixo} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.nome} stroke={i === 0 ? COR.atual : COR.anterior}
            strokeWidth={2} strokeDasharray={i === 0 ? undefined : "5 4"} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

const dataGA = (d: string) => (d.length === 8 ? `${d.slice(6, 8)}/${d.slice(4, 6)}` : d);
const titulo = (t: unknown) => String(t ?? "").replace(/\s+[—|-]\s+Vozes Paranaenses$/, "");
const rotuloSlug = (s: unknown) => {
  const t = String(s ?? "");
  if (VAZIO(t)) return "(sem valor)";
  return t.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-2">{children}</div>;
}

function Rodape({ resp }: { resp: RespostaAba }) {
  const erros = Object.entries(resp.erros ?? {});
  return (
    <div className="space-y-2 text-xs text-slate-400">
      {erros.length > 0 && (
        <ErrorBanner>
          Alguns relatórios não vieram: {erros.map(([k, v]) => `${k} (${v.slice(0, 140)})`).join(" · ")}
        </ErrorBanner>
      )}
      <p>
        Fonte: GA4 (propriedade 545150980), páginas do /admin excluídas. Atualizado às{" "}
        {new Date(resp.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (cache de 10 min). Os números do GA são só de quem aceitou os cookies.
      </p>
    </div>
  );
}

function SemCredencial({ motivo }: { motivo?: string }) {
  return (
    <EmptyState title="Falta ligar o painel ao GA4">
      <p className="mb-3">{motivo}</p>
      <ol className="mx-auto max-w-xl list-decimal space-y-1 text-left">
        <li>No Google Cloud (projeto <strong>vozes-paranaense</strong>), ative a <em>Google Analytics Data API</em>.</li>
        <li>Em IAM › Contas de serviço, crie a conta <em>painel-analytics</em> e gere uma chave JSON.</li>
        <li>No GA4: Administrador › Gerenciamento de acesso à propriedade › adicione o e-mail da conta de serviço como <strong>Leitor</strong>.</li>
        <li>Na Lovable, crie o secret <code>GA4_SERVICE_ACCOUNT_JSON</code> com o conteúdo do JSON e publique o site.</li>
      </ol>
      <p className="mt-3">Enquanto isso, a aba <strong>Base própria</strong> continua funcionando.</p>
    </EmptyState>
  );
}

// ----------------------------------------------------------------- as abas
function ConteudoAba({ aba, r, ex, dias }: { aba: Aba; r: Relatorios; ex: Extras; dias: number }) {
  switch (aba) {
    case "visao": return <AbaVisao r={r} />;
    case "tempo-real": return <AbaTempoReal r={r} />;
    case "aquisicao": return <AbaAquisicao r={r} />;
    case "publico": return <AbaPublico r={r} />;
    case "conteudo": return <AbaConteudo r={r} />;
    case "editorias": return <AbaSegmento r={r} dim="customEvent:editoria" nome="Editoria" producao={ex.producaoEditoria} />;
    case "regioes": return <AbaSegmento r={r} dim="customEvent:regiao" nome="Região" producao={ex.producaoRegiao} cidades />;
    case "engajamento": return <AbaEngajamento r={r} />;
    case "conversoes": return <AbaConversoes r={r} />;
    case "busca": return <AbaBusca r={r} />;
    case "qualidade": return <AbaQualidade r={r} ex={ex} dias={dias} />;
    default: return null;
  }
}

function AbaVisao({ r }: { r: Relatorios }) {
  const at = periodo(r.totais, "atual")[0] ?? {};
  const an = periodo(r.totais, "anterior")[0] ?? {};
  const ev = agrupar(periodo(r.eventos, "atual"), "eventName", "eventCount");
  const evAn = agrupar(periodo(r.eventos, "anterior"), "eventName", "eventCount");
  const serie = (r.serie ?? []).map((l) => ({ rotulo: dataGA(String(l.date)), leitores: num(l.activeUsers), visualizacoes: num(l.screenPageViews) }));
  const conv = (e: Record<string, number>) => (e.generate_lead ?? 0) + (e.clique_whatsapp ?? 0) + (e.comentario_enviado ?? 0);
  return (
    <>
      <Kpis>
        <Kpi rotulo="Leitores" valor={num(at.activeUsers)} anterior={num(an.activeUsers)} />
        <Kpi rotulo="Novos leitores" valor={num(at.newUsers)} anterior={num(an.newUsers)} />
        <Kpi rotulo="Sessões" valor={num(at.sessions)} anterior={num(an.sessions)} />
        <Kpi rotulo="Visualizações" valor={num(at.screenPageViews)} anterior={num(an.screenPageViews)} />
        <Kpi rotulo="Taxa de engajamento" valor={num(at.engagementRate)} anterior={num(an.engagementRate)} formato="pct" />
        <Kpi rotulo="Duração média da sessão" valor={num(at.averageSessionDuration)} anterior={num(an.averageSessionDuration)} formato="duracao" />
        <Kpi rotulo="Leituras completas" valor={ev.leitura_completa ?? 0} anterior={evAn.leitura_completa ?? 0} />
        <Kpi rotulo="Conversões (leads, WhatsApp, comentários)" valor={conv(ev)} anterior={conv(evAn)} />
      </Kpis>
      <Section title="Leitores e visualizações por dia">
        <div className="p-4"><Serie dados={serie} series={[{ chave: "visualizacoes", nome: "Visualizações" }, { chave: "leitores", nome: "Leitores" }]} /></div>
      </Section>
      <Grade>
        <Section title="Canais"><div className="p-4">
          <Barras itens={(r.canais ?? []).map((l) => ({ rotulo: canalPt(String(l.sessionDefaultChannelGroup)), valor: num(l.sessions), detalhe: `engaj. ${pct(num(l.engagementRate))}` }))} />
        </div></Section>
        <Section title="Páginas mais vistas"><div className="p-4">
          <Barras itens={(r.paginas ?? []).map((l) => ({ rotulo: titulo(l.pageTitle) || String(l.pagePath), valor: num(l.screenPageViews) }))} />
        </div></Section>
      </Grade>
    </>
  );
}

function AbaTempoReal({ r }: { r: Relatorios }) {
  const tot = r.total?.[0] ?? {};
  const minutos = Array.from({ length: 30 }, (_, i) => 29 - i).map((m) => ({
    rotulo: `-${m}min`,
    leitores: num((r.minutos ?? []).find((l) => Number(l.minutesAgo) === m)?.activeUsers),
  }));
  return (
    <>
      <Kpis>
        <Kpi rotulo="Leitores nos últimos 30 min" valor={num(tot.activeUsers)} />
        <Kpi rotulo="Visualizações nos últimos 30 min" valor={num(tot.screenPageViews)} />
      </Kpis>
      <Section title="Leitores por minuto" subtitle="Atualiza sozinho a cada minuto">
        <div className="p-4"><Serie dados={minutos} series={[{ chave: "leitores", nome: "Leitores" }]} /></div>
      </Section>
      <Grade>
        <Section title="Lendo agora"><div className="p-4">
          <Barras itens={(r.paginas ?? []).map((l) => ({ rotulo: titulo(l.unifiedScreenName), valor: num(l.activeUsers) }))} vazio="Ninguém medido agora." />
        </div></Section>
        <Section title="Cidades"><div className="p-4">
          <Barras itens={(r.cidades ?? []).map((l) => ({ rotulo: VAZIO(l.city) ? "(não identificada)" : String(l.city), valor: num(l.activeUsers) }))} vazio="Ninguém medido agora." />
        </div></Section>
        <Section title="Dispositivo"><div className="p-4">
          <Barras itens={(r.dispositivo ?? []).map((l) => ({ rotulo: dispositivoPt(String(l.deviceCategory)), valor: num(l.activeUsers) }))} vazio="Ninguém medido agora." />
        </div></Section>
        <Section title="Eventos"><div className="p-4">
          <Barras itens={(r.eventos ?? []).map((l) => ({ rotulo: String(l.eventName), valor: num(l.eventCount) }))} vazio="Nenhum evento agora." />
        </div></Section>
      </Grade>
    </>
  );
}

function AbaAquisicao({ r }: { r: Relatorios }) {
  const at = periodo(r.canais, "atual");
  const an = periodo(r.canais, "anterior");
  const total = soma(at, "sessions");
  const canaisTop = at.slice(0, 2).map((l) => String(l.sessionDefaultChannelGroup));
  const porDia = new Map<string, Record<string, string | number>>();
  for (const l of r.serieCanal ?? []) {
    const d = dataGA(String(l.date));
    const c = String(l.sessionDefaultChannelGroup);
    if (!canaisTop.includes(c)) continue;
    const linha = porDia.get(d) ?? { rotulo: d };
    linha[c] = num(l.sessions);
    porDia.set(d, linha);
  }
  return (
    <>
      <Section title="Canais" subtitle="Sessões, qualidade e conversão de cada canal, com o período anterior">
        <div className="p-4">
          <Tabela
            linhas={at}
            colunas={[
              { rotulo: "Canal", valor: (l) => canalPt(String(l.sessionDefaultChannelGroup)) },
              { rotulo: "Sessões", num: true, valor: (l) => inteiro(num(l.sessions)) },
              { rotulo: "Participação", num: true, valor: (l) => (total ? pct(num(l.sessions) / total) : "—") },
              { rotulo: "vs. anterior", num: true, valor: (l) => pctTexto(variacao(num(l.sessions), num(an.find((a) => a.sessionDefaultChannelGroup === l.sessionDefaultChannelGroup)?.sessions))) },
              { rotulo: "Engajamento", num: true, valor: (l) => pct(num(l.engagementRate)) },
              { rotulo: "Duração", num: true, valor: (l) => duracao(num(l.averageSessionDuration)) },
              { rotulo: "Pág./sessão", num: true, valor: (l) => num(l.screenPageViewsPerSession).toFixed(2).replace(".", ",") },
              { rotulo: "Conversões", num: true, valor: (l) => inteiro(num(l.keyEvents)) },
            ]}
          />
        </div>
      </Section>
      {canaisTop.length > 0 && (
        <Section title="Os dois maiores canais por dia">
          <div className="p-4"><Serie dados={[...porDia.values()]} series={canaisTop.map((c) => ({ chave: c, nome: canalPt(c) }))} /></div>
        </Section>
      )}
      <Section title="Fonte / mídia" subtitle="google / organic, instagram / social, whatsapp / … — de onde exatamente veio a sessão">
        <div className="p-4">
          <Tabela
            linhas={r.fontes ?? []}
            colunas={[
              { rotulo: "Fonte / mídia", valor: (l) => String(l.sessionSourceMedium) },
              { rotulo: "Sessões", num: true, valor: (l) => inteiro(num(l.sessions)) },
              { rotulo: "Leitores", num: true, valor: (l) => inteiro(num(l.activeUsers)) },
              { rotulo: "Engajamento", num: true, valor: (l) => pct(num(l.engagementRate)) },
              { rotulo: "Duração", num: true, valor: (l) => duracao(num(l.averageSessionDuration)) },
              { rotulo: "Conversões", num: true, valor: (l) => inteiro(num(l.keyEvents)) },
            ]}
          />
        </div>
      </Section>
      <Grade>
        <Section title="Campanhas (utm_campaign)"><div className="p-4">
          <Tabela
            linhas={(r.campanhas ?? []).filter((l) => !VAZIO(l.sessionCampaignName))}
            vazio="Nenhuma campanha com UTM no período."
            colunas={[
              { rotulo: "Campanha", valor: (l) => String(l.sessionCampaignName) },
              { rotulo: "Fonte", valor: (l) => String(l.sessionSourceMedium) },
              { rotulo: "Sessões", num: true, valor: (l) => inteiro(num(l.sessions)) },
              { rotulo: "Conv.", num: true, valor: (l) => inteiro(num(l.keyEvents)) },
            ]}
          />
        </div></Section>
        <Section title="Páginas de entrada"><div className="p-4">
          <Barras itens={(r.entrada ?? []).map((l) => ({ rotulo: String(l.landingPage), valor: num(l.sessions), detalhe: `engaj. ${pct(num(l.engagementRate))}` }))} />
        </div></Section>
      </Grade>
    </>
  );
}

const DIA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function AbaPublico({ r }: { r: Relatorios }) {
  const tipo = periodo(r.tipo, "atual");
  const tipoAn = periodo(r.tipo, "anterior");
  const g = (ls: Linha[], t: string) => num(ls.find((l) => l.newVsReturning === t)?.activeUsers);
  const horas = Array.from({ length: 24 }, (_, h) => ({
    rotulo: `${h}h`,
    leitores: num((r.hora ?? []).find((l) => Number(l.hour) === h)?.activeUsers),
  }));
  return (
    <>
      <Kpis>
        <Kpi rotulo="Leitores novos" valor={g(tipo, "new")} anterior={g(tipoAn, "new")} />
        <Kpi rotulo="Leitores que voltaram" valor={g(tipo, "returning")} anterior={g(tipoAn, "returning")} />
        <Kpi
          rotulo="Taxa de retorno"
          valor={g(tipo, "returning") / Math.max(1, g(tipo, "new") + g(tipo, "returning"))}
          anterior={g(tipoAn, "returning") / Math.max(1, g(tipoAn, "new") + g(tipoAn, "returning"))}
          formato="pct"
        />
        <Kpi rotulo="Celular" valor={num((r.dispositivo ?? []).find((l) => l.deviceCategory === "mobile")?.activeUsers) / Math.max(1, soma(r.dispositivo, "activeUsers"))} formato="pct" />
      </Kpis>
      <Section title="Leitores por hora do dia" subtitle="Horário de Brasília">
        <div className="p-4"><Serie dados={horas} series={[{ chave: "leitores", nome: "Leitores" }]} /></div>
      </Section>
      <Grade>
        <Section title="Cidade do leitor"><div className="p-4">
          <Barras itens={(r.cidade ?? []).filter((l) => !VAZIO(l.city)).slice(0, 15).map((l) => ({ rotulo: `${l.city}${/paran/i.test(String(l.region)) ? "" : ` (${l.region})`}`, valor: num(l.activeUsers), detalhe: `engaj. ${pct(num(l.engagementRate))}` }))} />
        </div></Section>
        <Section title="Estado"><div className="p-4">
          <Barras itens={(r.estado ?? []).map((l) => ({ rotulo: VAZIO(l.region) ? "(não identificado)" : String(l.region), valor: num(l.activeUsers) }))} />
        </div></Section>
        <Section title="Dispositivo"><div className="p-4">
          <Tabela
            linhas={r.dispositivo ?? []}
            colunas={[
              { rotulo: "Dispositivo", valor: (l) => dispositivoPt(String(l.deviceCategory)) },
              { rotulo: "Leitores", num: true, valor: (l) => inteiro(num(l.activeUsers)) },
              { rotulo: "Engajamento", num: true, valor: (l) => pct(num(l.engagementRate)) },
              { rotulo: "Duração", num: true, valor: (l) => duracao(num(l.averageSessionDuration)) },
            ]}
          />
        </div></Section>
        <Section title="Dia da semana"><div className="p-4">
          <Barras itens={(r.diaSemana ?? []).map((l) => ({ rotulo: DIA_SEMANA[Number(l.dayOfWeek)] ?? String(l.dayOfWeek), valor: num(l.activeUsers) }))} />
        </div></Section>
        <Section title="Sistema"><div className="p-4">
          <Barras itens={(r.sistema ?? []).map((l) => ({ rotulo: String(l.operatingSystem), valor: num(l.activeUsers) }))} />
        </div></Section>
        <Section title="Navegador"><div className="p-4">
          <Barras itens={(r.navegador ?? []).map((l) => ({ rotulo: String(l.browser), valor: num(l.activeUsers) }))} />
        </div></Section>
      </Grade>
    </>
  );
}

function AbaConteudo({ r }: { r: Relatorios }) {
  const ev = eventosPor(r.conclusao, "pagePath");
  const aut = eventosPor(r.autoria, "customEvent:autoria");
  const AUTORIA: Record<string, string> = { ia: "IA", redacao: "Redação", imprensa: "Portal da Imprensa" };
  const autoriaLinhas = Object.entries(aut).filter(([k]) => !VAZIO(k)).map(([k, e]) => ({ k, pv: e.page_view ?? 0, lc: e.leitura_completa ?? 0, sh: e.share ?? 0 }));
  return (
    <>
      <Section title="Matérias e páginas" subtitle="Visualizações, tempo de leitura e quanto do público chega ao fim (75% do texto)">
        <div className="p-4">
          <Tabela
            linhas={r.paginas ?? []}
            colunas={[
              { rotulo: "Página", valor: (l) => <span title={String(l.pagePath)}>{titulo(l.pageTitle) || String(l.pagePath)}</span> },
              { rotulo: "Visualiz.", num: true, valor: (l) => inteiro(num(l.screenPageViews)) },
              { rotulo: "Leitores", num: true, valor: (l) => inteiro(num(l.activeUsers)) },
              { rotulo: "Tempo/leitor", num: true, valor: (l) => duracao(num(l.userEngagementDuration) / Math.max(1, num(l.activeUsers))) },
              { rotulo: "Leitura completa", num: true, valor: (l) => {
                const e = ev[String(l.pagePath)];
                return e?.page_view ? pct((e.leitura_completa ?? 0) / e.page_view) : "—";
              } },
              { rotulo: "Compart.", num: true, valor: (l) => inteiro(ev[String(l.pagePath)]?.share ?? 0) },
            ]}
          />
        </div>
      </Section>
      <Grade>
        <Section title="Autoria" subtitle="Só matérias">
          <div className="p-4">
            <Tabela
              linhas={autoriaLinhas as unknown as Linha[]}
              vazio="Sem matérias com autoria medida."
              colunas={[
                { rotulo: "Autoria", valor: (l) => AUTORIA[String(l.k)] ?? String(l.k) },
                { rotulo: "Visualiz.", num: true, valor: (l) => inteiro(num(l.pv)) },
                { rotulo: "Leitura completa", num: true, valor: (l) => (num(l.pv) ? pct(num(l.lc) / num(l.pv)) : "—") },
                { rotulo: "Compart.", num: true, valor: (l) => inteiro(num(l.sh)) },
              ]}
            />
          </div>
        </Section>
        <Section title="Tipo de página"><div className="p-4">
          <Barras itens={(r.tipo ?? []).map((l) => ({ rotulo: rotuloSlug(l["customEvent:tipo_conteudo"]), valor: num(l.screenPageViews), detalhe: duracao(num(l.userEngagementDuration) / Math.max(1, num(l.activeUsers))) }))} />
        </div></Section>
        <Section title="Idade da matéria lida" subtitle="Dias entre a publicação e a leitura"><div className="p-4">
          <Barras itens={faixasDeIdade(r.frescor ?? [])} />
        </div></Section>
      </Grade>
    </>
  );
}

function faixasDeIdade(linhas: Linha[]) {
  const faixas = [
    { rotulo: "Mesmo dia", ate: 1 }, { rotulo: "1 a 2 dias", ate: 3 }, { rotulo: "3 a 7 dias", ate: 8 },
    { rotulo: "8 a 30 dias", ate: 31 }, { rotulo: "Mais de 30 dias", ate: Infinity },
  ].map((f) => ({ ...f, valor: 0 }));
  const hoje = Date.now();
  for (const l of linhas) {
    const d = new Date(String(l["customEvent:data_publicacao"]));
    if (Number.isNaN(d.getTime())) continue;
    const idade = (hoje - d.getTime()) / 86_400_000;
    const f = faixas.find((x) => idade < x.ate);
    if (f) f.valor += num(l.screenPageViews);
  }
  return faixas.filter((f) => f.valor > 0).map(({ rotulo, valor }) => ({ rotulo, valor }));
}

function AbaSegmento({ r, dim, nome, producao, cidades }: {
  r: Relatorios; dim: string; nome: string; producao?: Record<string, number>; cidades?: boolean;
}) {
  const at = periodo(r.audiencia, "atual").filter((l) => !VAZIO(l[dim]));
  const an = periodo(r.audiencia, "anterior");
  const ev = eventosPor(r.eventos, dim);
  const totPv = soma(at, "screenPageViews");
  const totProd = Object.values(producao ?? {}).reduce((a, b) => a + b, 0);
  const chaves = new Set([...at.map((l) => String(l[dim])), ...Object.keys(producao ?? {})]);
  const linhas: Linha[] = [...chaves].map((k) => {
    const l = at.find((x) => String(x[dim]) === k) ?? {};
    const e = ev[k] ?? {};
    const pv = num(l.screenPageViews);
    return {
      k, pv, usuarios: num(l.activeUsers), tempo: num(l.userEngagementDuration) / Math.max(1, num(l.activeUsers)),
      ant: num(an.find((x) => String(x[dim]) === k)?.screenPageViews),
      lc: (e.leitura_completa ?? 0) / Math.max(1, e.page_view ?? pv), sh: e.share ?? 0,
      conv: (e.generate_lead ?? 0) + (e.clique_whatsapp ?? 0) + (e.comentario_enviado ?? 0),
      prod: producao?.[k] ?? 0,
    };
  }).sort((a, b) => num(b.pv) - num(a.pv));
  // Canal por segmento: os 3 maiores canais de cada um.
  const canais: Record<string, Array<[string, number]>> = {};
  for (const l of r.canais ?? []) {
    const k = String(l[dim]);
    if (VAZIO(k)) continue;
    (canais[k] ??= []).push([canalPt(String(l.sessionDefaultChannelGroup)), num(l.screenPageViews)]);
  }
  return (
    <>
      <Section title={`${nome}: audiência × produção`} subtitle="Produção = matérias publicadas no período (banco do Vozes). Visualizações por matéria mostram o rendimento de cada pauta.">
        <div className="p-4">
          <Tabela
            linhas={linhas}
            colunas={[
              { rotulo: nome, valor: (l) => rotuloSlug(l.k) },
              { rotulo: "Visualiz.", num: true, valor: (l) => inteiro(num(l.pv)) },
              { rotulo: "vs. anterior", num: true, valor: (l) => pctTexto(variacao(num(l.pv), num(l.ant))) },
              { rotulo: "% audiência", num: true, valor: (l) => (totPv ? pct(num(l.pv) / totPv) : "—") },
              { rotulo: "Matérias", num: true, valor: (l) => inteiro(num(l.prod)) },
              { rotulo: "% produção", num: true, valor: (l) => (totProd ? pct(num(l.prod) / totProd) : "—") },
              { rotulo: "Visualiz./matéria", num: true, valor: (l) => (num(l.prod) ? (num(l.pv) / num(l.prod)).toFixed(1).replace(".", ",") : "—") },
              { rotulo: "Leitura completa", num: true, valor: (l) => (num(l.pv) ? pct(num(l.lc)) : "—") },
              { rotulo: "Tempo/leitor", num: true, valor: (l) => duracao(num(l.tempo)) },
              { rotulo: "Compart.", num: true, valor: (l) => inteiro(num(l.sh)) },
              { rotulo: "Conv.", num: true, valor: (l) => inteiro(num(l.conv)) },
            ]}
          />
        </div>
      </Section>
      <Grade>
        <Section title={`Por onde chega cada ${nome.toLowerCase()}`}><div className="p-4">
          <Tabela
            linhas={linhas.filter((l) => canais[String(l.k)]).slice(0, 12)}
            colunas={[
              { rotulo: nome, valor: (l) => rotuloSlug(l.k) },
              { rotulo: "Principais canais", valor: (l) => (canais[String(l.k)] ?? []).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c} ${inteiro(v)}`).join(" · ") },
            ]}
          />
        </div></Section>
        {cidades ? (
          <>
            <Section title="Cidade da matéria" subtitle="Cidade principal das matérias lidas"><div className="p-4">
              <Barras itens={(r.cidades ?? []).filter((l) => !VAZIO(l["customEvent:cidade"])).slice(0, 20).map((l) => ({ rotulo: rotuloSlug(l["customEvent:cidade"]), valor: num(l.screenPageViews) }))} />
            </div></Section>
            <Section title="Cidade de quem lê" subtitle="Localização do leitor (GA)"><div className="p-4">
              <Barras itens={(r.leitores ?? []).filter((l) => !VAZIO(l.city)).slice(0, 20).map((l) => ({ rotulo: String(l.city), valor: num(l.activeUsers) }))} />
            </div></Section>
          </>
        ) : (
          <Section title="Rendimento por matéria" subtitle="Visualizações por matéria publicada"><div className="p-4">
            <Barras itens={linhas.filter((l) => num(l.prod) > 0).map((l) => ({ rotulo: rotuloSlug(l.k), valor: num(l.pv) / num(l.prod) })).sort((a, b) => b.valor - a.valor)} formato={(v) => v.toFixed(1).replace(".", ",")} />
          </div></Section>
        )}
      </Grade>
    </>
  );
}

const EVENTO_PT: Record<string, string> = {
  page_view: "Visualização de página", session_start: "Início de sessão", first_visit: "Primeira visita",
  user_engagement: "Engajamento", scroll: "Rolagem até 90%", click: "Clique para fora", leitura_completa: "Leitura completa (75%)",
  share: "Compartilhamento", clique_relacionada: "Clique em relacionada", generate_lead: "Lead",
  clique_whatsapp: "Clique de WhatsApp", comentario_enviado: "Comentário", view_search_results: "Busca no site",
  file_download: "Download", form_start: "Formulário iniciado", form_submit: "Formulário enviado", video_start: "Vídeo iniciado",
  link_copiado: "Link copiado", compartilhamento_nativo: "Compartilhar do celular",
};

function AbaEngajamento({ r }: { r: Relatorios }) {
  const at = periodo(r.metricas, "atual")[0] ?? {};
  const an = periodo(r.metricas, "anterior")[0] ?? {};
  const ev = agrupar(periodo(r.eventos, "atual"), "eventName", "eventCount");
  const evAn = agrupar(periodo(r.eventos, "anterior"), "eventName", "eventCount");
  const pv = ev.page_view ?? 0;
  const pvAn = evAn.page_view ?? 0;
  const taxa = (e: Record<string, number>, n: string, base: number) => (base ? (e[n] ?? 0) / base : 0);
  return (
    <>
      <Kpis>
        <Kpi rotulo="Taxa de engajamento" valor={num(at.engagementRate)} anterior={num(an.engagementRate)} formato="pct" />
        <Kpi rotulo="Páginas por sessão" valor={num(at.screenPageViewsPerSession)} anterior={num(an.screenPageViewsPerSession)} formato="decimal" />
        <Kpi rotulo="Tempo de engajamento por leitor" valor={num(at.userEngagementDuration) / Math.max(1, num(at.activeUsers))} anterior={num(an.userEngagementDuration) / Math.max(1, num(an.activeUsers))} formato="duracao" />
        <Kpi rotulo="Leitura completa / visualização" valor={taxa(ev, "leitura_completa", pv)} anterior={taxa(evAn, "leitura_completa", pvAn)} formato="pct" />
        <Kpi rotulo="Compartilhamento / visualização" valor={taxa(ev, "share", pv)} anterior={taxa(evAn, "share", pvAn)} formato="pct" />
        <Kpi rotulo="Clique em relacionada / visualização" valor={taxa(ev, "clique_relacionada", pv)} anterior={taxa(evAn, "clique_relacionada", pvAn)} formato="pct" />
      </Kpis>
      <Section title="Todos os eventos">
        <div className="p-4">
          <Tabela
            linhas={periodo(r.eventos, "atual")}
            colunas={[
              { rotulo: "Evento", valor: (l) => EVENTO_PT[String(l.eventName)] ?? String(l.eventName) },
              { rotulo: "Nome técnico", valor: (l) => <code className="text-xs text-slate-500">{String(l.eventName)}</code> },
              { rotulo: "Vezes", num: true, valor: (l) => inteiro(num(l.eventCount)) },
              { rotulo: "vs. anterior", num: true, valor: (l) => pctTexto(variacao(num(l.eventCount), evAn[String(l.eventName)] ?? 0)) },
              { rotulo: "Leitores", num: true, valor: (l) => inteiro(num(l.totalUsers)) },
            ]}
          />
        </div>
      </Section>
      <Grade>
        <Section title="Blocos de relacionadas clicados"><div className="p-4">
          <Barras itens={(r.blocos ?? []).filter((l) => !VAZIO(l["customEvent:bloco"])).map((l) => ({ rotulo: rotuloSlug(l["customEvent:bloco"]), valor: num(l.eventCount) }))} vazio="Sem cliques em relacionadas no período (a dimensão foi criada em 30/10)." />
        </div></Section>
        <Section title="Matérias mais compartilhadas"><div className="p-4">
          <Barras itens={(r.compartilhadas ?? []).map((l) => ({ rotulo: titulo(l.pageTitle), valor: num(l.eventCount) }))} vazio="Nenhum compartilhamento no período." />
        </div></Section>
      </Grade>
    </>
  );
}

const LEAD_PT: Record<string, string> = {
  contato: "Contato", portal_imprensa: "Portal da Imprensa", newsletter_whatsapp: "Newsletter WhatsApp",
  classificado: "Classificado", vitrine_pessoal: "Vitrine Pessoal", publieditorial: "Publieditorial", chat_anuncios: "Chat de anúncios",
};

function AbaConversoes({ r }: { r: Relatorios }) {
  const at = agrupar(periodo(r.totais, "atual"), "eventName", "eventCount");
  const an = agrupar(periodo(r.totais, "anterior"), "eventName", "eventCount");
  const sess = num(periodo(r.sessoes, "atual")[0]?.sessions);
  const sessAn = num(periodo(r.sessoes, "anterior")[0]?.sessions);
  const porFonte: Record<string, Record<string, number>> = eventosPor(r.fonte, "sessionSourceMedium");
  const porPagina: Record<string, Record<string, number>> = eventosPor(r.pagina, "pagePath");
  const tabelaEventos = (m: Record<string, Record<string, number>>) =>
    Object.entries(m).map(([k, e]) => ({ k, lead: e.generate_lead ?? 0, wpp: e.clique_whatsapp ?? 0, com: e.comentario_enviado ?? 0 }))
      .sort((a, b) => b.lead + b.wpp + b.com - (a.lead + a.wpp + a.com)) as unknown as Linha[];
  const colunasEv = (rotulo: string): Coluna[] => [
    { rotulo, valor: (l) => String(l.k) },
    { rotulo: "Leads", num: true, valor: (l) => inteiro(num(l.lead)) },
    { rotulo: "WhatsApp", num: true, valor: (l) => inteiro(num(l.wpp)) },
    { rotulo: "Coment.", num: true, valor: (l) => inteiro(num(l.com)) },
  ];
  return (
    <>
      <Kpis>
        <Kpi rotulo="Leads" valor={at.generate_lead ?? 0} anterior={an.generate_lead ?? 0} />
        <Kpi rotulo="Leads por mil sessões" valor={sess ? ((at.generate_lead ?? 0) / sess) * 1000 : 0} anterior={sessAn ? ((an.generate_lead ?? 0) / sessAn) * 1000 : 0} formato="decimal" />
        <Kpi rotulo="Cliques de WhatsApp" valor={at.clique_whatsapp ?? 0} anterior={an.clique_whatsapp ?? 0} />
        <Kpi rotulo="Comentários" valor={at.comentario_enviado ?? 0} anterior={an.comentario_enviado ?? 0} />
      </Kpis>
      <Grade>
        <Section title="Leads por produto"><div className="p-4">
          <Barras itens={(r.leadTipo ?? []).filter((l) => !VAZIO(l["customEvent:lead_tipo"])).map((l) => ({ rotulo: LEAD_PT[String(l["customEvent:lead_tipo"])] ?? String(l["customEvent:lead_tipo"]), valor: num(l.eventCount) }))} vazio="Nenhum lead no período (os eventos de conversão entram com a publicação de 30/10)." />
        </div></Section>
        <Section title="WhatsApp: comunidade × comercial"><div className="p-4">
          <Barras itens={(r.whatsapp ?? []).filter((l) => !VAZIO(l["customEvent:destino"])).map((l) => ({ rotulo: rotuloSlug(l["customEvent:destino"]), valor: num(l.eventCount) }))} vazio="Nenhum clique de WhatsApp no período." />
        </div></Section>
        <Section title="Conversões por fonte / mídia"><div className="p-4">
          <Tabela linhas={tabelaEventos(porFonte)} colunas={colunasEv("Fonte / mídia")} vazio="Sem conversões no período." />
        </div></Section>
        <Section title="Conversões por página"><div className="p-4">
          <Tabela linhas={tabelaEventos(porPagina)} colunas={colunasEv("Página")} vazio="Sem conversões no período." />
        </div></Section>
      </Grade>
    </>
  );
}

function AbaBusca({ r }: { r: Relatorios }) {
  const serie = (r.serie ?? []).map((l) => ({ rotulo: dataGA(String(l.date)), buscas: num(l.eventCount) }));
  return (
    <>
      <Kpis>
        <Kpi rotulo="Buscas no período" valor={soma(r.termos, "eventCount")} />
        <Kpi rotulo="Termos diferentes" valor={(r.termos ?? []).filter((l) => !VAZIO(l.searchTerm)).length} />
      </Kpis>
      <Section title="Buscas por dia"><div className="p-4"><Serie dados={serie} series={[{ chave: "buscas", nome: "Buscas" }]} /></div></Section>
      <Section title="Termos buscados" subtitle="Termo frequente é pauta ou atalho que falta"><div className="p-4">
        <Tabela
          linhas={(r.termos ?? []).filter((l) => !VAZIO(l.searchTerm))}
          vazio="Nenhuma busca registrada ainda (a página /busca entra no ar com a publicação de 30/10)."
          colunas={[
            { rotulo: "Termo", valor: (l) => String(l.searchTerm) },
            { rotulo: "Buscas", num: true, valor: (l) => inteiro(num(l.eventCount)) },
            { rotulo: "Leitores", num: true, valor: (l) => inteiro(num(l.totalUsers)) },
            { rotulo: "", valor: (l) => <a className="text-xs text-[#B5651D] underline" href={`/busca?q=${encodeURIComponent(String(l.searchTerm))}`} target="_blank" rel="noreferrer">ver resultado</a> },
          ]}
        />
      </div></Section>
    </>
  );
}

function AbaQualidade({ r, ex, dias }: { r: Relatorios; ex: Extras; dias: number }) {
  const c = ex.consentimento;
  const pv = num(r.pageviews?.[0]?.screenPageViews);
  const vaziaPct = (rel: string, dim: string) => {
    const t = soma(r[rel], "screenPageViews");
    return t ? soma((r[rel] ?? []).filter((l) => VAZIO(l[dim])), "screenPageViews") / t : 0;
  };
  return (
    <>
      <Kpis>
        <Kpi rotulo="Banner de cookies exibido" valor={c?.exibido ?? 0} />
        <Kpi rotulo="Aceitaram" valor={c && c.exibido ? c.aceito / c.exibido : 0} formato="pct" />
        <Kpi rotulo="Recusaram" valor={c && c.exibido ? c.recusado / c.exibido : 0} formato="pct" />
        <Kpi rotulo="Não responderam" valor={c && c.exibido ? Math.max(0, c.exibido - c.aceito - c.recusado) / c.exibido : 0} formato="pct" />
        <Kpi rotulo="Visualizações no GA4" valor={pv} />
        <Kpi rotulo="Visualizações na base própria" valor={ex.pageviewsBase ?? 0} />
        <Kpi rotulo="Visualizações sem editoria" valor={vaziaPct("editoriaVazia", "customEvent:editoria")} formato="pct" />
        <Kpi rotulo="Visualizações sem região" valor={vaziaPct("regiaoVazia", "customEvent:regiao")} formato="pct" />
      </Kpis>
      <Section title="Como ler os números deste painel">
        <ul className="list-disc space-y-1.5 p-5 pl-9 text-sm text-slate-600">
          <li>O GA4 roda com Consent Mode: sem "Aceitar", o Google recebe só um sinal sem cookie e <strong>não conta o leitor</strong>. Os números são a fração que aceitou ({c && c.exibido ? pct(c.aceito / c.exibido) : "medição começando"} nos últimos {dias} dias).</li>
          <li>A modelagem do Google, que estimaria quem recusou, só liga com cerca de mil leitores por dia que aceitam.</li>
          <li>Visualizações sem editoria/região são da home, busca e páginas institucionais — normal.</li>
          <li>Páginas do /admin nunca entram nos relatórios. O navegador da equipe é marcado como tráfego interno; enquanto o filtro do GA estiver em "Teste", ele ainda soma nos totais.</li>
        </ul>
      </Section>
    </>
  );
}
