import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";
import { ArticleImageEditor } from "@/components/admin/ArticleImageEditor";

export const Route = createFileRoute("/admin/")({
  component: AdminQueue,
});

type Draft = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  status: "rascunho" | "aprovado" | "rejeitado" | "publicado";
  gerado_em: string;
  imagem_capa_url: string | null;
  imagem_credito: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
};

const STATUS_TABS: Draft["status"][] = ["rascunho", "aprovado", "publicado", "rejeitado"];

function AdminQueue() {
  const [tab, setTab] = useState<Draft["status"]>("rascunho");
  const [items, setItems] = useState<Draft[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("generated_articles")
        .select("id, slug, titulo, subtitulo, resumo, status, gerado_em, imagem_capa_url, imagem_credito, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)")
        .eq("status", tab)
        .order("gerado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      setItems((data ?? []) as unknown as Draft[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function runPipeline() {
    setPipelineBusy(true);
    setPipelineLog(["Iniciando pipeline…"]);
    const steps: Array<{ name: string; fn: string }> = [
      { name: "1/3 Scrape de fontes ativas", fn: "scrape-source" },
      { name: "2/3 Clustering por similaridade", fn: "cluster-articles" },
      { name: "3/3 Classificação + cotas", fn: "classify-and-quota" },
    ];
    for (const s of steps) {
      setPipelineLog((l) => [...l, `${s.name}…`]);
      try {
        const { data, error } = await supabase.functions.invoke(s.fn, { body: {} });
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

  async function updateStatus(id: string, next: Draft["status"]) {
    setBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const patch: Record<string, unknown> = { status: next };
      if (next === "publicado") patch.publicado_em = new Date().toISOString();
      const { error } = await sb.from("generated_articles").update(patch).eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Fila editorial</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={runPipeline} disabled={pipelineBusy}
            className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60">
            {pipelineBusy ? "Rodando pipeline…" : "▶ Rodar pipeline agora"}
          </button>
          <div className="flex gap-1 rounded-md border bg-muted p-1 text-sm">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`rounded px-3 py-1 capitalize ${tab === s ? "bg-white shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
          </div>
        </div>
      </div>

      {pipelineLog.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded border bg-muted p-2 text-[11px] leading-tight">
          {pipelineLog.join("\n")}
        </pre>
      )}

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Nada em «{tab}».</p>}

      <ul className="space-y-3">
        {items?.map((it) => (
          <li key={it.id} className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {it.regiao && <span className="rounded bg-[#0A2540] px-2 py-0.5 font-semibold text-white">{it.regiao.nome}</span>}
              {it.categoria && <span className="rounded bg-[#0066CC] px-2 py-0.5 font-semibold text-white">{it.categoria.nome}</span>}
              <span>{new Date(it.gerado_em).toLocaleString("pt-BR")}</span>
            </div>
            <h2 className="text-lg font-semibold leading-snug">{it.titulo}</h2>
            {it.subtitulo && <p className="mt-1 text-sm text-muted-foreground">{it.subtitulo}</p>}
            {it.resumo && <p className="mt-2 text-sm">{it.resumo}</p>}
            <ArticleImageEditor
              articleId={it.id}
              currentUrl={it.imagem_capa_url}
              currentCredito={it.imagem_credito}
              onUpdated={load}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {it.status === "publicado" && it.regiao && (
                <a href={`/${it.regiao.slug}/${it.slug}`} target="_blank" rel="noreferrer"
                  className="rounded border px-3 py-1 text-xs hover:bg-accent">Ver no site</a>
              )}
              {it.status !== "publicado" && (
                <button disabled={busyId === it.id} onClick={() => updateStatus(it.id, "publicado")}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  Publicar
                </button>
              )}
              {it.status === "rascunho" && (
                <button disabled={busyId === it.id} onClick={() => updateStatus(it.id, "aprovado")}
                  className="rounded bg-[#0066CC] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
                  Aprovar
                </button>
              )}
              {it.status !== "rejeitado" && it.status !== "publicado" && (
                <button disabled={busyId === it.id} onClick={() => updateStatus(it.id, "rejeitado")}
                  className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60">
                  Rejeitar
                </button>
              )}
              {it.status === "publicado" && (
                <button disabled={busyId === it.id} onClick={() => updateStatus(it.id, "rascunho")}
                  className="rounded border px-3 py-1 text-xs hover:bg-accent disabled:opacity-60">
                  Despublicar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}