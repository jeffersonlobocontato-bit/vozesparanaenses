import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";
import { BLOCOS, blocoDoHorario, horaSaoPaulo } from "@/lib/pauta-blocos";
import { displayRegionName } from "@/lib/region-labels";

export const Route = createFileRoute("/admin/clusters")({
  component: AdminClusters,
});

type Cluster = {
  id: string;
  status: "novo" | "selecionado_cota" | "fatos_extraidos" | "descartado" | "rascunho_gerado";
  prioridade_score: number;
  interesse_score: number | null;
  curadoria_nacional: boolean;
  criado_em: string;
  fatos_extraidos_em: string | null;
  grupo_estadual_id: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
  cidade: string;
  fontes: number;
  fontesNomes: string[];
  quem: string | null;
  o_que: string | null;
  artigos: { titulo: string | null; url: string; fonte: string | null }[];
};

function escalaInteresse(score: number | null): { label: string; chamas: number; cor: string } {
  const s = score ?? 0;
  if (s >= 3.5) return { label: "Muito alto", chamas: 4, cor: "#B42318" };
  if (s >= 2) return { label: "Alto", chamas: 3, cor: "#C4650A" };
  if (s >= 1) return { label: "Médio", chamas: 2, cor: "#946800" };
  return { label: "Baixo", chamas: 1, cor: "#5B6470" };
}

function Chamas({ n, cor }: { n: number; cor: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} style={{ color: i < n ? cor : "#D9DEE3" }}>●</span>
      ))}
    </span>
  );
}

function AdminClusters() {
  const [items, setItems] = useState<Cluster[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const markBusy = useCallback((id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const [cleaning, setCleaning] = useState(false);
  const [coletando, setColetando] = useState(false);
  const [coletaLog, setColetaLog] = useState<string[]>([]);
  const [fRegiao, setFRegiao] = useState<string>("");
  const [fCategoria, setFCategoria] = useState<string>("");
  const [fFonte, setFFonte] = useState<string>("");

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("article_clusters")
        .select("id, status, prioridade_score, interesse_score, curadoria_nacional, criado_em, fatos_extraidos_em, grupo_estadual_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome), cluster_articles(raw_article:raw_articles(titulo, url, fonte:fontes(nome))), extracted_facts(onde, quem, o_que)")
        .eq("curadoria_nacional", true)
        .in("status", ["novo", "selecionado_cota", "fatos_extraidos", "descartado"])
        .order("criado_em", { ascending: false })
        .limit(120);
      if (error) throw error;
      type Row = {
        id: string; status: Cluster["status"]; prioridade_score: number; interesse_score: number | null; curadoria_nacional: boolean; criado_em: string;
        fatos_extraidos_em: string | null; grupo_estadual_id: string | null;
        regiao: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        categoria: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        cluster_articles: {
          raw_article: {
            titulo: string | null;
            url: string;
            fonte: { nome: string } | { nome: string }[] | null;
          } | { titulo: string | null; url: string; fonte: { nome: string } | { nome: string }[] | null }[] | null;
        }[] | null;
        extracted_facts: { onde: string | null; quem: string | null; o_que: string | null }[] | null;
      };
      const first = <T,>(v: T | T[] | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v;
      const mapped: Cluster[] = ((data ?? []) as unknown as Row[]).map((r) => {
        const artigos = (r.cluster_articles ?? [])
          .map((ca) => first(ca.raw_article))
          .filter((a): a is { titulo: string | null; url: string; fonte: { nome: string } | { nome: string }[] | null } => !!a)
          .map((a) => ({ titulo: a.titulo, url: a.url, fonte: first(a.fonte)?.nome ?? null }));
        const rawRegiao = first(r.regiao);
        const regiao = rawRegiao
          ? { slug: rawRegiao.slug, nome: displayRegionName(rawRegiao.slug, rawRegiao.nome) }
          : null;
        const fatos = (r.extracted_facts ?? [])[0] ?? null;
        const onde = fatos?.onde ?? null;
        const cidade = (onde && onde.trim()) || regiao?.nome || "Sem localidade";
        const fontesNomes = Array.from(new Set(artigos.map((a) => a.fonte).filter((n): n is string => !!n)));
        return {
          id: r.id, status: r.status, prioridade_score: r.prioridade_score,
          interesse_score: r.interesse_score, curadoria_nacional: r.curadoria_nacional, criado_em: r.criado_em,
          fatos_extraidos_em: r.fatos_extraidos_em, grupo_estadual_id: r.grupo_estadual_id,
          regiao, categoria: first(r.categoria), cidade,
          fontes: artigos.length,
          fontesNomes,
          quem: fatos?.quem ?? null,
          o_que: fatos?.o_que ?? null,
          artigos,
        };
      });
      setItems(mapped);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function limparHistorico() {
    const ok = window.confirm(
      "Excluir todas as pautas não publicadas com scraping há mais de 24h? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
    setCleaning(true); setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const corte = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await sb
        .from("article_clusters")
        .delete()
        .lt("criado_em", corte)
        .in("status", ["novo", "selecionado_cota", "fatos_extraidos", "descartado", "rascunho_gerado"])
        .select("id");
      if (error) throw error;
      setMsg(`Histórico limpo: ${data?.length ?? 0} pauta(s) removida(s).`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha ao limpar histórico: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setCleaning(false);
    }
  }

  async function apagarTodas() {
    const total = items?.length ?? 0;
    const ok = window.confirm(
      `Apagar TODAS as ${total} pauta(s) listadas (rascunho, selecionadas, fatos extraídos e descartadas)? Matérias já publicadas não são afetadas. Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setCleaning(true); setMsg(null);
    try {
      // Usa edge function com service role — a tabela article_clusters não
      // tem policy de DELETE para o usuário autenticado, então via cliente
      // browser a exclusão volta 0 linhas em silêncio.
      const { data, error } = await supabase.functions.invoke("delete-clusters", {
        body: { statuses: ["novo", "selecionado_cota", "fatos_extraidos", "descartado"] },
      });
      if (error) throw error;
      setMsg(`${(data as { deleted?: number })?.deleted ?? 0} pauta(s) removida(s).`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha ao apagar pautas: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setCleaning(false);
    }
  }

  async function rodarColetaCuradoria(editorias: string[], rotulo: string) {
    setColetando(true);
    setColetaLog([`Coletando fontes de curadoria (${rotulo})…`]);
    try {
      setColetaLog((l) => [...l, "→ scrape-source…"]);
      const scrape = await supabase.functions.invoke("scrape-source", { body: { force: true, sync: true, curadoria_editorias: editorias } });
      if (scrape.error) throw scrape.error;
      const sd = (scrape.data ?? {}) as { report?: Array<{ inserted?: number; inserted_id?: string | null }> };
      const insertedIds = (sd.report ?? [])
        .filter((row) => (row.inserted ?? 0) > 0 && row.inserted_id)
        .map((row) => row.inserted_id as string);
      setColetaLog((l) => [...l, `  ✓ ${JSON.stringify(scrape.data).slice(0, 240)}`]);
      if (!insertedIds.length) {
        setColetaLog((l) => [...l, "  • Nenhuma matéria nova foi coletada neste ciclo; não vou reaproveitar pauta antiga/backlog."]);
        return;
      }
      setColetaLog((l) => [...l, "→ cluster-articles…"]);
      const cluster = await supabase.functions.invoke("cluster-articles", { body: { sync: true, curadoria_editorias: editorias, raw_article_ids: insertedIds } });
      if (cluster.error) throw cluster.error;
      setColetaLog((l) => [...l, `  ✓ ${JSON.stringify(cluster.data).slice(0, 240)}`]);
      setColetaLog((l) => [...l, "→ classify-and-quota…"]);
      const classify = await supabase.functions.invoke("classify-and-quota", { body: { sync: true } });
      if (classify.error) throw classify.error;
      setColetaLog((l) => [...l, `  ✓ ${JSON.stringify(classify.data).slice(0, 240)}`]);
    } catch (e: unknown) {
      setColetaLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
    } finally {
      setColetando(false);
      await load();
    }
  }

  async function extractFacts(id: string) {
    markBusy(id, true); setMsg(null);
    try {
      const { error } = await supabase.functions.invoke("extract-facts", {
        body: { cluster_id: id },
      });
      if (error) throw error;
      setMsg(`Fatos extraídos (${id.slice(0, 6)}). Gerando matéria…`);
      const { data: gen, error: gErr } = await supabase.functions.invoke("generate-article", {
        body: { cluster_id: id },
      });
      if (gErr) throw gErr;
      setMsg(`Rascunho criado: ${(gen as { titulo?: string })?.titulo ?? "ok"}`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha no pipeline: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      markBusy(id, false);
    }
  }

  async function generate(id: string) {
    markBusy(id, true); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-article", {
        body: { cluster_id: id },
      });
      if (error) throw error;
      setMsg(`Rascunho criado: ${(data as { titulo?: string })?.titulo ?? "ok"}`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      markBusy(id, false);
    }
  }

  const regioesOpts = useMemo(
    () => Array.from(new Set((items ?? []).map((i) => i.regiao?.nome).filter((n): n is string => !!n))).sort(),
    [items],
  );
  const categoriasOpts = useMemo(
    () => Array.from(new Set((items ?? []).map((i) => i.categoria?.nome).filter((n): n is string => !!n))).sort(),
    [items],
  );
  const fontesOpts = useMemo(
    () => Array.from(new Set((items ?? []).flatMap((i) => i.fontesNomes))).sort(),
    [items],
  );

  const filtrados = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (!fRegiao || i.regiao?.nome === fRegiao) &&
          (!fCategoria || i.categoria?.nome === fCategoria) &&
          (!fFonte || i.fontesNomes.includes(fFonte)),
      ),
    [items, fRegiao, fCategoria, fFonte],
  );

  const nacionaisSegurancaEsporte = useMemo(
    () => filtrados.filter((i) => i.curadoria_nacional && (i.categoria?.slug === "seguranca" || i.categoria?.slug === "esportes"))
      .sort((a, b) => b.prioridade_score - a.prioridade_score),
    [filtrados],
  );
  const nacionaisGeral = useMemo(
    () => filtrados.filter((i) => i.curadoria_nacional && i.categoria?.slug !== "seguranca" && i.categoria?.slug !== "esportes")
      .sort((a, b) => b.prioridade_score - a.prioridade_score),
    [filtrados],
  );
  const paranaenses = useMemo(() => filtrados.filter((i) => !i.curadoria_nacional), [filtrados]);

  const agrupado = useMemo(() => {
    if (!items) return [];
    // Faixa → Editoria → Cidade → clusters[]
    type Grupo = {
      bloco: string;
      inicio: number; fim: number;
      maisRecente: string; // ISO
      total: number;
      editorias: {
        nome: string;
        score: number;
        cidades: { nome: string; score: number; clusters: Cluster[] }[];
      }[];
    };
    const porBloco = new Map<string, Cluster[]>();
    for (const b of BLOCOS) porBloco.set(b.label, []);
    for (const c of paranaenses) porBloco.get(blocoDoHorario(c.criado_em).label)!.push(c);

    const grupos: Grupo[] = BLOCOS.map((b) => {
      const clusters = porBloco.get(b.label) ?? [];
      const porEd = new Map<string, Cluster[]>();
      for (const c of clusters) {
        const ed = c.categoria?.nome ?? "Sem editoria";
        if (!porEd.has(ed)) porEd.set(ed, []);
        porEd.get(ed)!.push(c);
      }
      const editorias = Array.from(porEd.entries()).map(([nome, cs]) => {
        const porCidade = new Map<string, Cluster[]>();
        for (const c of cs) {
          if (!porCidade.has(c.cidade)) porCidade.set(c.cidade, []);
          porCidade.get(c.cidade)!.push(c);
        }
        const cidades = Array.from(porCidade.entries()).map(([cnome, cls]) => {
          const ordenados = [...cls].sort(
            (a, b) => (b.interesse_score ?? b.prioridade_score) - (a.interesse_score ?? a.prioridade_score),
          );
          const score = ordenados.reduce((s, c) => s + (c.interesse_score ?? c.prioridade_score), 0);
          return { nome: cnome, score, clusters: ordenados };
        }).sort((a, b) => b.score - a.score);
        const score = cidades.reduce((s, c) => s + c.score, 0);
        return { nome, score, cidades };
      }).sort((a, b) => b.score - a.score);
      const maisRecente = clusters.reduce<string>(
        (m, c) => (c.criado_em > m ? c.criado_em : m),
        "",
      );
      return { bloco: b.label, inicio: b.ini, fim: b.fim, maisRecente, total: clusters.length, editorias };
    }).filter((g) => g.total > 0);

    // Faixas mais recentes primeiro
    grupos.sort((a, b) => (b.maisRecente > a.maisRecente ? 1 : -1));
    return grupos;
  }, [items, filtrados]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Curadoria Nacional — Segurança &amp; Esporte / Geral</h1>
        <div className="flex gap-2">
          <button
            onClick={rodarColetaCuradoria}
            disabled={coletando}
            className="rounded bg-[#0066CC] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {coletando ? "Coletando…" : "▶ Rodar coleta (curadoria)"}
          </button>
          <button
            onClick={apagarTodas}
            disabled={cleaning || !items?.length}
            className="rounded border border-red-400 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            title="Apaga todas as pautas listadas, independente da idade"
          >
            🗑 Apagar todas ({items?.length ?? 0})
          </button>
          <button
            onClick={limparHistorico}
            disabled={cleaning}
            className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            title="Remove pautas não publicadas com scraping há mais de 24h"
          >
            {cleaning ? "Limpando…" : "🧹 Limpar histórico (>24h)"}
          </button>
          <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
        </div>
      </div>
      {coletaLog.length > 0 && (
        <pre className="rounded-xl bg-slate-900 p-3 text-xs text-emerald-300 overflow-x-auto">{coletaLog.join("\n")}</pre>
      )}
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cluster. Rode o scrape + clustering.</p>}
      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select value={fRegiao} onChange={(e) => setFRegiao(e.target.value)} className="rounded border px-2 py-1 text-xs">
            <option value="">Todas as regiões</option>
            {regioesOpts.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className="rounded border px-2 py-1 text-xs">
            <option value="">Todas as editorias</option>
            {categoriasOpts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fFonte} onChange={(e) => setFFonte(e.target.value)} className="rounded border px-2 py-1 text-xs">
            <option value="">Todas as fontes</option>
            {fontesOpts.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {(fRegiao || fCategoria || fFonte) && (
            <button onClick={() => { setFRegiao(""); setFCategoria(""); setFFonte(""); }} className="rounded border px-2 py-1 text-xs hover:bg-accent">
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {nacionaisSegurancaEsporte.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-amber-900">
            🚨⚽ Segurança &amp; Esporte — Nacional/Internacional
          </h2>
          <p className="mb-3 text-xs text-amber-800">
            Formado só quando 2 ou mais fontes nacionais abertas (G1, Metrópoles, R7, CNN Brasil, ge,
            Lance!, ESPN, Gazeta Esportiva) cobriram o mesmo fato. Nunca escreve sozinho — decisão sua.
          </p>
          <div className="space-y-2">
            {nacionaisSegurancaEsporte.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {c.categoria?.nome ?? "—"}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{c.fontes} portal(is) cobrindo</span>
                  </div>
                  <p className="truncate font-medium">{c.artigos[0]?.titulo ?? c.o_que ?? "Sem título ainda"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.fontesNomes.join(" · ")}</p>
                </div>
                <button
                  onClick={() => extractFacts(c.id)}
                  disabled={busyIds.has(c.id)}
                  className="shrink-0 rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busyIds.has(c.id) ? "Escrevendo…" : "✎ Escrever agora"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {nacionaisGeral.length > 0 && (
        <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-sky-900">
            🌎 Nacional — Geral (política, economia, o que não for Segurança/Esporte)
          </h2>
          <p className="mb-3 text-xs text-sky-800">
            De G1, Metrópoles, R7 e CNN Brasil — classificado pela mesma IA que classifica o Paraná.
            Nunca escreve sozinho — decisão sua.
          </p>
          <div className="space-y-2">
            {nacionaisGeral.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white p-3 text-sm">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                      {c.categoria?.nome ?? "classificando…"}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{c.fontes} portal(is) cobrindo</span>
                  </div>
                  <p className="truncate font-medium">{c.artigos[0]?.titulo ?? c.o_que ?? "Sem título ainda"}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.fontesNomes.join(" · ")}</p>
                </div>
                <button
                  onClick={() => extractFacts(c.id)}
                  disabled={busyIds.has(c.id)}
                  className="shrink-0 rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busyIds.has(c.id) ? "Escrevendo…" : "✎ Escrever agora"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {agrupado.map((g, idx) => {
        const horaMaisRecente = g.maisRecente ? horaSaoPaulo(g.maisRecente) : g.fim;
        return (
          <section
            key={g.bloco + idx}
            className="rounded-xl border-2 border-[#0A2540]/20 bg-muted/30 p-4"
          >
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#0A2540]/20 pb-2">
              <h2 className="text-lg font-bold text-[#0A2540]">
                {idx === 0 ? "Último scraping · " : "Scraping anterior · "}
                {g.bloco}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({String(g.inicio).padStart(2, "0")}h–{String(g.fim).padStart(2, "0")}h)
                </span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {g.total} cluster(s) · mais recente às{" "}
                {String(horaMaisRecente).padStart(2, "0")}h
                {g.maisRecente && ` · ${new Date(g.maisRecente).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
              </span>
            </header>

            <div className="space-y-5">
              {g.editorias.map((ed) => (
                <div key={ed.nome}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#0066CC]">
                    {ed.nome}
                  </h3>
                  <div className="space-y-4 pl-2">
                    {ed.cidades.map((ci) => (
                      <div key={ci.nome}>
                        <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          {ci.nome} <span className="normal-case text-[10px]">· {ci.clusters.length} pauta(s)</span>
                        </h4>
                        <ul className="grid gap-3 md:grid-cols-2">
                          {ci.clusters.map((c) => (
                            <li key={c.id} className="rounded-lg border bg-card p-4">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                {c.regiao && <span className="rounded bg-[#0A2540] px-2 py-0.5 font-semibold text-white">{c.regiao.nome}</span>}
                                {c.categoria && <span className="rounded bg-[#0066CC] px-2 py-0.5 font-semibold text-white">{c.categoria.nome}</span>}
                                {(() => {
                                  const e = escalaInteresse(c.interesse_score);
                                  return (
                                    <span className="flex items-center gap-1" title={`Interesse: ${e.label}${c.interesse_score != null ? ` (${c.interesse_score.toFixed(1)})` : ""}`}>
                                      <Chamas n={e.chamas} cor={e.cor} />
                                      <span className="text-muted-foreground">{e.label}</span>
                                    </span>
                                  );
                                })()}
                                {c.grupo_estadual_id && (
                                  <span className="rounded bg-[#5B2A86] px-2 py-0.5 font-semibold text-white" title="Mesma notícia detectada em outra região">
                                    🔗 Cobertura estadual
                                  </span>
                                )}
                                <span className="text-muted-foreground">· score {c.prioridade_score.toFixed(1)}</span>
                                <span className="text-muted-foreground">· {c.fontes} fonte(s)</span>
                                <span className="text-muted-foreground">· {c.status}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{new Date(c.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
                              {(c.quem || c.o_que) && (
                                <div className="mt-2 border-t pt-2 text-xs leading-snug">
                                  {c.quem && <p><span className="font-semibold">Quem:</span> {c.quem}</p>}
                                  {c.o_que && <p><span className="font-semibold">O quê:</span> {c.o_que}</p>}
                                </div>
                              )}
                              {c.artigos.length > 0 && (
                                <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                                  {c.artigos.map((a, i) => (
                                    <li key={i} className="leading-snug">
                                      <a href={a.url} target="_blank" rel="noreferrer" className="font-medium text-[#0A2540] hover:underline">
                                        {a.titulo ?? a.url}
                                      </a>
                                      {a.fonte && <span className="ml-1 text-muted-foreground">· {a.fonte}</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="mt-3">
                                {c.status === "fatos_extraidos" ? (
                                  <button disabled={busyIds.has(c.id)} onClick={() => generate(c.id)}
                                    className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
                                    {busyIds.has(c.id) ? "Gerando…" : "Gerar matéria"}
                                  </button>
                                ) : (
                                  <button disabled={busyIds.has(c.id)} onClick={() => extractFacts(c.id)}
                                    className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60">
                                    {busyIds.has(c.id) ? "Processando…" : "Extrair fatos + gerar matéria"}
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}