import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

type EventoRow = {
  ts: string;
  pagina: string | null;
  origem_trafego: string | null;
  cidade_leitor: string | null;
  regiao: { nome: string } | { nome: string }[] | null;
};

const CORES = ["#0A2540", "#0066CC", "#B42318", "#C4650A", "#5B2A86", "#0F766E", "#946800"];
const PERIODOS = [
  { label: "Hoje", dias: 1 },
  { label: "Últimos 7 dias", dias: 7 },
  { label: "Últimos 30 dias", dias: 30 },
] as const;

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function AdminAnalytics() {
  const [periodo, setPeriodo] = useState<number>(7);
  const [rows, setRows] = useState<EventoRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (dias: number) => {
    setRows(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const since = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
      const { data, error } = await sb
        .from("analytics_events")
        .select("ts, pagina, origem_trafego, cidade_leitor, regiao:regioes(nome)")
        .eq("tipo_evento", "pageview")
        .gte("ts", since)
        .order("ts", { ascending: false })
        .limit(5000);
      if (error) throw error;
      setRows((data ?? []) as unknown as EventoRow[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar analytics");
    }
  }, []);

  useEffect(() => { load(periodo); }, [load, periodo]);

  const porRegiao = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const nome = first(r.regiao)?.nome ?? "Sem região";
      m.set(nome, (m.get(nome) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const porOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const o = r.origem_trafego ?? "outro";
      m.set(o, (m.get(o) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([origem, total]) => ({ origem, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const porPagina = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.pagina) continue;
      m.set(r.pagina, (m.get(r.pagina) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([pagina, total]) => ({ pagina, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rows]);

  const porCidadeLeitor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.cidade_leitor) continue;
      m.set(r.cidade_leitor, (m.get(r.cidade_leitor) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([cidade, total]) => ({ cidade, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rows]);

  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(r.ts));
      m.set(dia, (m.get(dia) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([dia, total]) => ({ dia, total })).reverse();
  }, [rows]);

  const totalIA = porOrigem.find((o) => o.origem === "ia")?.total ?? 0;
  const total = rows?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Painel de Analytics"
        subtitle="Tráfego cruzado das 10 regiões — página, origem e tendência."
        actions={
          <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm">
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
          </select>
        }
      />

      {err && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!rows && !err && <p className="text-sm text-slate-500">Carregando…</p>}

      {rows && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-muted-foreground">Pageviews no período</p>
              <p className="text-3xl font-bold text-[#0A2540]">{total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-muted-foreground">Regiões com tráfego</p>
              <p className="text-3xl font-bold text-[#0A2540]">{porRegiao.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-muted-foreground">Vindos de IA (ChatGPT/Perplexity/Gemini)</p>
              <p className="text-3xl font-bold text-[#5B2A86]">{totalIA} <span className="text-sm font-normal text-muted-foreground">({total ? Math.round((totalIA / total) * 100) : 0}%)</span></p>
            </div>
          </div>

          {total === 0 && (
            <p className="rounded border bg-muted p-3 text-sm text-muted-foreground">
              Nenhum evento registrado ainda neste período — normal se o portal for novo ou tiver pouco tráfego.
              O rastreamento dispara automaticamente a cada página visitada no site público.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h2 className="mb-3 text-sm font-semibold">Pageviews por dia</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={porDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#0066CC" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h2 className="mb-3 text-sm font-semibold">Pageviews por região</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={porRegiao} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="nome" type="category" fontSize={11} width={110} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0A2540" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h2 className="mb-3 text-sm font-semibold">Origem do tráfego</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porOrigem} dataKey="total" nameKey="origem" cx="50%" cy="50%" outerRadius={80} label>
                    {porOrigem.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h2 className="mb-3 text-sm font-semibold">Páginas mais vistas</h2>
              <ul className="space-y-1 text-sm">
                {porPagina.map((p) => (
                  <li key={p.pagina} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                    <span className="truncate text-muted-foreground">{p.pagina}</span>
                    <span className="font-semibold">{p.total}</span>
                  </li>
                ))}
                {porPagina.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
              <h2 className="mb-3 text-sm font-semibold">De onde vêm os leitores (cidade)</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Aproximado por geolocalização de IP — o IP em si nunca é armazenado, só a cidade resultante.
              </p>
              <ul className="space-y-1 text-sm">
                {porCidadeLeitor.map((c) => (
                  <li key={c.cidade} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                    <span className="truncate text-muted-foreground">{c.cidade}</span>
                    <span className="font-semibold">{c.total}</span>
                  </li>
                ))}
                {porCidadeLeitor.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
