import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/clusters")({
  component: AdminClusters,
});

type Cluster = {
  id: string;
  status: "novo" | "selecionado_cota" | "descartado";
  prioridade_score: number;
  criado_em: string;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
  fontes: number;
  artigos: { titulo: string | null; url: string; fonte: string | null }[];
};

function AdminClusters() {
  const [items, setItems] = useState<Cluster[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("article_clusters")
        .select("id, status, prioridade_score, criado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome), cluster_articles(raw_article:raw_articles(titulo, url, fonte:fontes(nome)))")
        .order("prioridade_score", { ascending: false })
        .limit(80);
      if (error) throw error;
      type Row = {
        id: string; status: Cluster["status"]; prioridade_score: number; criado_em: string;
        regiao: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        categoria: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        cluster_articles: {
          raw_article: {
            titulo: string | null;
            url: string;
            fonte: { nome: string } | { nome: string }[] | null;
          } | { titulo: string | null; url: string; fonte: { nome: string } | { nome: string }[] | null }[] | null;
        }[] | null;
      };
      const first = <T,>(v: T | T[] | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v;
      const mapped: Cluster[] = ((data ?? []) as unknown as Row[]).map((r) => {
        const artigos = (r.cluster_articles ?? [])
          .map((ca) => first(ca.raw_article))
          .filter((a): a is { titulo: string | null; url: string; fonte: { nome: string } | { nome: string }[] | null } => !!a)
          .map((a) => ({ titulo: a.titulo, url: a.url, fonte: first(a.fonte)?.nome ?? null }));
        return {
          id: r.id, status: r.status, prioridade_score: r.prioridade_score, criado_em: r.criado_em,
          regiao: first(r.regiao), categoria: first(r.categoria),
          fontes: artigos.length,
          artigos,
        };
      });
      setItems(mapped);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate(id: string) {
    setBusyId(id); setMsg(null);
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
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pautas (clusters)</h1>
        <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
      </div>
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cluster. Rode o scrape + clustering.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {items?.map((c) => (
          <li key={c.id} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              {c.regiao && <span className="rounded bg-[#0A2540] px-2 py-0.5 font-semibold text-white">{c.regiao.nome}</span>}
              {c.categoria && <span className="rounded bg-[#0066CC] px-2 py-0.5 font-semibold text-white">{c.categoria.nome}</span>}
              <span className="text-muted-foreground">score {c.prioridade_score.toFixed(1)}</span>
              <span className="text-muted-foreground">· {c.fontes} fonte(s)</span>
              <span className="text-muted-foreground">· {c.status}</span>
            </div>
            <div className="text-xs text-muted-foreground">{new Date(c.criado_em).toLocaleString("pt-BR")}</div>
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
              <button disabled={busyId === c.id} onClick={() => generate(c.id)}
                className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
                {busyId === c.id ? "Gerando…" : "Gerar matéria"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}