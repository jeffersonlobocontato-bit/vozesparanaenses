import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Lightbulb } from "lucide-react";
import { PageHeader, Section, Tabs, ErrorBanner, EmptyState, campoClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

type EventoRow = {
  ts: string;
  pagina: string | null;
  origem_trafego: string | null;
  cidade_leitor: string | null;
  categoria: string | null;
  regiao: { nome: string; slug: string } | { nome: string; slug: string }[] | null;
};

type ArtigoRow = {
  slug: string;
  titulo: string;
  regiao: { slug: string } | { slug: string }[] | null;
  categoria: { nome: string } | { nome: string }[] | null;
};

// Paleta dos gráficos: cores da marca, nomeadas, em vez de hex soltos.
const PALETA = {
  tinta: "#12201E",
  verde: "#1E5B45",
  laranja: "#E29F65",
  azul: "#1B5E9A",
  ardosia: "#64748B",
} as const;
// Ordem das fatias da pizza de origem (repete se houver mais categorias).
const CORES = [PALETA.tinta, PALETA.laranja, PALETA.verde, PALETA.azul, PALETA.ardosia];
const GRADE = "#E2E8F0";
const PERIODOS = [
  { label: "Hoje", dias: 1 },
  { label: "Últimos 7 dias", dias: 7 },
  { label: "Últimos 30 dias", dias: 30 },
] as const;

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function pct(atual: number, anterior: number): { valor: number; texto: string; positivo: boolean } {
  if (anterior === 0) {
    if (atual === 0) return { valor: 0, texto: "—", positivo: true };
    return { valor: 100, texto: "novo", positivo: true };
  }
  const v = ((atual - anterior) / anterior) * 100;
  return { valor: v, texto: `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`, positivo: v >= 0 };
}

function AdminAnalytics() {
  const [periodo, setPeriodo] = useState<number>(7);
  // "publico" = acessos de leitores nas páginas do site; "admin" = acessos
  // internos dentro do /admin (nós mesmos usando o painel); "tudo" = soma
  // dos dois. Sem essa separação, o volume de uso interno inflava o total
  // de "pageviews" e distorcia todos os cruzamentos (região, editoria etc.).
  const [segmento, setSegmento] = useState<"publico" | "admin" | "tudo">("publico");
  const [rows, setRows] = useState<EventoRow[] | null>(null);
  const [rowsAnterior, setRowsAnterior] = useState<EventoRow[] | null>(null);
  const [artigos, setArtigos] = useState<ArtigoRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (dias: number) => {
    setRows(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const agora = Date.now();
      const since = new Date(agora - dias * 24 * 3600 * 1000).toISOString();
      const sincePrev = new Date(agora - dias * 2 * 24 * 3600 * 1000).toISOString();

      // PostgREST corta em 1000 linhas por request independentemente do
      // .limit() — precisamos paginar com .range() pra não subcontar
      // pageviews depois que o site passa dos mil acessos no período.
      const PAGE = 1000;
      const MAX_PAGES = 50; // teto de segurança: 50k eventos por janela
      async function fetchAllPageviews(gte: string, lt?: string) {
        const acc: EventoRow[] = [];
        for (let i = 0; i < MAX_PAGES; i++) {
          let q = sb.from("analytics_events")
            .select("ts, pagina, origem_trafego, cidade_leitor, categoria, regiao:regioes(nome, slug)")
            .eq("tipo_evento", "pageview")
            .gte("ts", gte)
            .order("ts", { ascending: false })
            .range(i * PAGE, i * PAGE + PAGE - 1);
          if (lt) q = q.lt("ts", lt);
          const { data, error } = await q;
          if (error) throw error;
          const batch = (data ?? []) as unknown as EventoRow[];
          acc.push(...batch);
          if (batch.length < PAGE) break;
        }
        return acc;
      }

      const [atual, anterior, artigosRes] = await Promise.all([
        fetchAllPageviews(since),
        fetchAllPageviews(sincePrev, since),
        sb.from("generated_articles")
          .select("slug, titulo, regiao:regioes(slug), categoria:editorial_categories(nome)")
          .eq("status", "publicado").order("publicado_em", { ascending: false }).limit(1000),
      ]);
      if (artigosRes.error) throw artigosRes.error;
      setRows(atual);
      setRowsAnterior(anterior);
      setArtigos((artigosRes.data ?? []) as unknown as ArtigoRow[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar analytics");
    }
  }, []);

  useEffect(() => { load(periodo); }, [load, periodo]);

  // Filtra por segmento em memória — a coleta do tracker cobre tudo, então
  // basta separar aqui pelo prefixo /admin da URL registrada em `pagina`.
  function ehAdmin(p: string | null): boolean {
    return !!p && p.startsWith("/admin");
  }
  const rowsFiltradas = useMemo(() => {
    if (!rows) return null;
    if (segmento === "tudo") return rows;
    if (segmento === "admin") return rows.filter((r) => ehAdmin(r.pagina));
    return rows.filter((r) => !ehAdmin(r.pagina));
  }, [rows, segmento]);
  const rowsAnteriorFiltradas = useMemo(() => {
    if (!rowsAnterior) return null;
    if (segmento === "tudo") return rowsAnterior;
    if (segmento === "admin") return rowsAnterior.filter((r) => ehAdmin(r.pagina));
    return rowsAnterior.filter((r) => !ehAdmin(r.pagina));
  }, [rowsAnterior, segmento]);
  const totalAdmin = useMemo(() => (rows ?? []).filter((r) => ehAdmin(r.pagina)).length, [rows]);
  const totalPublico = useMemo(() => (rows ?? []).filter((r) => !ehAdmin(r.pagina)).length, [rows]);

  // Mapa pagina ("/regiao/slug") -> {titulo, categoria} pra virar ranking
  // de matéria de verdade, não só a URL crua — é a diferença entre uma
  // lista de links e um "top conteúdo" de verdade, como no GA.
  const tituloPorPagina = useMemo(() => {
    const m = new Map<string, { titulo: string; categoria: string | null }>();
    for (const a of artigos) {
      const regiaoSlug = first(a.regiao)?.slug;
      if (!regiaoSlug) continue;
      m.set(`/${regiaoSlug}/${a.slug}`, { titulo: a.titulo, categoria: first(a.categoria)?.nome ?? null });
    }
    return m;
  }, [artigos]);

  const porRegiao = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      const nome = first(r.regiao)?.nome ?? "Sem região";
      m.set(nome, (m.get(nome) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [rowsFiltradas]);

  const porOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      const o = r.origem_trafego ?? "outro";
      m.set(o, (m.get(o) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([origem, total]) => ({ origem, total })).sort((a, b) => b.total - a.total);
  }, [rowsFiltradas]);

  const porEditoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      const c = r.categoria ?? "sem editoria";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
  }, [rowsFiltradas]);

  const porEditoriaAnterior = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsAnteriorFiltradas ?? []) {
      const c = r.categoria ?? "sem editoria";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [rowsAnteriorFiltradas]);

  const porPagina = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      if (!r.pagina) continue;
      m.set(r.pagina, (m.get(r.pagina) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([pagina, total]) => ({ pagina, total, meta: tituloPorPagina.get(pagina) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [rowsFiltradas, tituloPorPagina]);

  const porCidadeLeitor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      if (!r.cidade_leitor) continue;
      m.set(r.cidade_leitor, (m.get(r.cidade_leitor) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([cidade, total]) => ({ cidade, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rowsFiltradas]);

  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas ?? []) {
      const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(r.ts));
      m.set(dia, (m.get(dia) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([dia, total]) => ({ dia, total })).reverse();
  }, [rowsFiltradas]);

  const totalIA = porOrigem.find((o) => o.origem === "ia")?.total ?? 0;
  const total = rowsFiltradas?.length ?? 0;
  const totalAnterior = rowsAnteriorFiltradas?.length ?? 0;
  const variacaoTotal = pct(total, totalAnterior);
  const regioesComTrafego = porRegiao.length;

  // Insights automáticos — a editoria que mais cresceu, a região líder, o
  // canal que mais trouxe leitor. É o que transforma número solto em
  // leitura de tendência, sem o usuário precisar cruzar os gráficos na mão.
  const insights = useMemo(() => {
    const lista: string[] = [];
    if (!rowsFiltradas || total === 0) return lista;

    let melhorEditoria: { nome: string; variacao: ReturnType<typeof pct> } | null = null;
    for (const e of porEditoria) {
      if (e.total < 3) continue; // ignora ruído de volume muito baixo
      const anterior = porEditoriaAnterior.get(e.categoria) ?? 0;
      const variacao = pct(e.total, anterior);
      if (!melhorEditoria || variacao.valor > melhorEditoria.variacao.valor) {
        melhorEditoria = { nome: e.categoria, variacao };
      }
    }
    if (melhorEditoria && melhorEditoria.variacao.valor > 15) {
      lista.push(`"${cap(melhorEditoria.nome)}" foi a editoria com maior crescimento no período (${melhorEditoria.variacao.texto} vs. período anterior).`);
    }

    if (porRegiao.length > 0) {
      const lider = porRegiao[0];
      const participacao = total ? Math.round((lider.total / total) * 100) : 0;
      if (participacao >= 30) {
        lista.push(`A região ${lider.nome} concentra ${participacao}% do tráfego total — vale checar se as outras regiões precisam de mais publicações.`);
      }
    }

    if (totalIA > 0) {
      const participacaoIA = Math.round((totalIA / total) * 100);
      if (participacaoIA >= 10) {
        lista.push(`${participacaoIA}% dos acessos vieram de assistentes de IA (ChatGPT, Perplexity, Gemini) — sinal de que o conteúdo está sendo bem indexado por essas fontes.`);
      }
    }

    if (porCidadeLeitor.length > 0) {
      lista.push(`${cap(porCidadeLeitor[0].cidade)} é a cidade com mais leitores no período (${porCidadeLeitor[0].total} acessos).`);
    }

    return lista;
  }, [rowsFiltradas, total, porEditoria, porEditoriaAnterior, porRegiao, totalIA, porCidadeLeitor]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Painel de Analytics"
        subtitle="Tráfego cruzado das 10 regiões — página, editoria, origem e tendência, com comparação ao período anterior."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs<"publico" | "admin" | "tudo">
              value={segmento}
              onChange={setSegmento}
              items={[
                { value: "publico", label: "Leitores" },
                { value: "admin", label: "Uso interno" },
                { value: "tudo", label: "Tudo" },
              ]}
            />
            <select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className={campoClass}>
              {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
            </select>
          </div>
        }
      />

      {err && <ErrorBanner>{err}</ErrorBanner>}
      <TaxaDeAceite dias={periodo} />
      {!rows && !err && <p className="text-sm text-slate-500">Carregando…</p>}

      {rows && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm">
            No período: <strong className="text-slate-900">{totalPublico}</strong> acessos de leitores no site
            {" · "}<strong className="text-slate-900">{totalAdmin}</strong> acessos internos dentro do /admin
            {" · "}total <strong className="text-slate-900">{totalPublico + totalAdmin}</strong>.
            {segmento !== "tudo" && (
              <> Mostrando apenas <strong>{segmento === "admin" ? "acessos internos" : "acessos de leitores"}</strong>.</>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Acessos no período" valor={total} variacao={variacaoTotal} />
            <KpiCard label="Regiões com tráfego" valor={regioesComTrafego} variacao={pct(regioesComTrafego, porRegiaoAnteriorCount(rowsAnteriorFiltradas))} />
            <KpiCard label="Editorias com tráfego" valor={porEditoria.length} variacao={{ valor: 0, texto: "", positivo: true }} semComparacao />
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500">Vindos de IA (ChatGPT, Perplexity, Gemini)</p>
              <p className="text-3xl font-bold" style={{ color: PALETA.azul }}>{totalIA} <span className="text-sm font-normal text-slate-500">({total ? Math.round((totalIA / total) * 100) : 0}%)</span></p>
            </div>
          </div>

          {total === 0 && (
            <EmptyState title="Nenhum acesso registrado neste período">
              É normal se o portal for novo ou tiver pouco tráfego. O rastreamento registra cada página visitada no site público.
            </EmptyState>
          )}

          {insights.length > 0 && (
            <section className="rounded-2xl border border-[#E29F65]/40 bg-[#E29F65]/10 p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[#12201E]">
                <Lightbulb className="h-4 w-4 text-[#B5651D]" aria-hidden />
                Destaques do período
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#12201E]">
                {insights.map((texto, i) => <li key={i}>{texto}</li>)}
              </ul>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Acessos por dia">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
                  <XAxis dataKey="dia" fontSize={11} stroke={PALETA.ardosia} />
                  <YAxis fontSize={11} allowDecimals={false} stroke={PALETA.ardosia} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" name="Acessos" stroke={PALETA.laranja} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Acessos por editoria">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porEditoria} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} stroke={PALETA.ardosia} />
                  <YAxis dataKey="categoria" type="category" fontSize={11} width={100} tickFormatter={cap} stroke={PALETA.ardosia} />
                  <Tooltip />
                  <Bar dataKey="total" name="Acessos" fill={PALETA.verde} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Acessos por região">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porRegiao} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} stroke={PALETA.ardosia} />
                  <YAxis dataKey="nome" type="category" fontSize={11} width={110} stroke={PALETA.ardosia} />
                  <Tooltip />
                  <Bar dataKey="total" name="Acessos" fill={PALETA.tinta} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Origem do tráfego">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porOrigem} dataKey="total" nameKey="origem" cx="50%" cy="50%" outerRadius={80} label>
                    {porOrigem.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Matérias mais acessadas" subtitle="Ranking do período." className="lg:col-span-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-8 py-1.5 font-medium">#</th>
                    <th className="py-1.5 font-medium">Matéria</th>
                    <th className="py-1.5 font-medium">Editoria</th>
                    <th className="py-1.5 text-right font-medium">Acessos</th>
                  </tr>
                </thead>
                <tbody>
                  {porPagina.map((p, i) => (
                    <tr key={p.pagina} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 text-slate-500">{i + 1}</td>
                      <td className="py-1.5">
                        {p.meta ? (
                          <a href={p.pagina} target="_blank" rel="noreferrer" className="font-medium text-[#12201E] underline-offset-2 hover:underline">{p.meta.titulo}</a>
                        ) : (
                          <span className="truncate text-slate-500">{p.pagina}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{p.meta?.categoria ?? "—"}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{p.total}</td>
                    </tr>
                  ))}
                  {porPagina.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-slate-500">Sem acessos a matérias no período.</td></tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section
              title="De onde vêm os leitores"
              subtitle="Cidade aproximada pela geolocalização do IP. O IP nunca é armazenado, só a cidade."
              className="lg:col-span-2"
            >
              <div className="grid gap-x-6 sm:grid-cols-2">
                <ul className="space-y-1 text-sm">
                  {porCidadeLeitor.slice(0, 5).map((c, i) => (
                    <li key={c.cidade} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                      <span className="truncate text-slate-600">{i + 1}. {c.cidade}</span>
                      <span className="font-semibold tabular-nums">{c.total}</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-1 text-sm">
                  {porCidadeLeitor.slice(5, 10).map((c, i) => (
                    <li key={c.cidade} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                      <span className="truncate text-slate-600">{i + 6}. {c.cidade}</span>
                      <span className="font-semibold tabular-nums">{c.total}</span>
                    </li>
                  ))}
                </ul>
                {porCidadeLeitor.length === 0 && <p className="text-sm text-slate-500">Sem cidade identificada no período.</p>}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function porRegiaoAnteriorCount(rowsAnterior: EventoRow[] | null): number {
  const s = new Set<string>();
  for (const r of rowsAnterior ?? []) {
    const nome = first(r.regiao)?.nome;
    if (nome) s.add(nome);
  }
  return s.size;
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function KpiCard({ label, valor, variacao, semComparacao }: {
  label: string; valor: number; variacao: { valor: number; texto: string; positivo: boolean }; semComparacao?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-[#12201E]">{valor}</p>
        {!semComparacao && variacao.texto && (
          <span className={`text-xs font-semibold ${variacao.positivo ? "text-emerald-700" : "text-red-700"}`}>
            {variacao.texto}
          </span>
        )}
      </div>
      {!semComparacao && <p className="text-[10px] text-slate-500">em relação ao período anterior</p>}
    </div>
  );
}

// Taxa de aceite do banner de cookies (contagem anônima, migração 098):
// é a fração dos leitores que o GA4 e o nosso analytics_events enxergam.
type LinhaConsent = { dia: string; exibido: number; aceito: number; recusado: number };

function TaxaDeAceite({ dias }: { dias: number }) {
  const [linhas, setLinhas] = useState<LinhaConsent[] | null>(null);
  useEffect(() => {
    let vivo = true;
    getExternalBrowser()
      .then((sb) => sb.rpc("consentimento_resumo", { p_dias: dias }))
      .then(({ data, error }) => { if (vivo) setLinhas(error ? null : ((data ?? []) as LinhaConsent[])); });
    return () => { vivo = false; };
  }, [dias]);
  if (!linhas) return null;
  const soma = linhas.reduce(
    (a, l) => ({ exibido: a.exibido + l.exibido, aceito: a.aceito + l.aceito, recusado: a.recusado + l.recusado }),
    { exibido: 0, aceito: 0, recusado: 0 },
  );
  const semResposta = Math.max(0, soma.exibido - soma.aceito - soma.recusado);
  const p = (n: number) => (soma.exibido ? `${Math.round((n / soma.exibido) * 100)}%` : "—");
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
      <strong className="text-slate-900">Banner de cookies no período:</strong>{" "}
      exibido a <strong className="text-slate-900">{soma.exibido}</strong> leitores
      {" · "}aceitaram <strong className="text-[#B5651D]">{soma.aceito} ({p(soma.aceito)})</strong>
      {" · "}recusaram <strong className="text-slate-900">{soma.recusado} ({p(soma.recusado)})</strong>
      {" · "}não responderam <strong className="text-slate-900">{semResposta} ({p(semResposta)})</strong>.
      {" "}Só quem aceita entra nos números abaixo e no GA4 — leia os totais como uma amostra.
      {soma.exibido === 0 && " (A contagem começa a partir da publicação do site com a migração 098.)"}
    </div>
  );
}
