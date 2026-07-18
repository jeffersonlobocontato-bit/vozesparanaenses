import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";
import { ArticleImageEditor } from "@/components/admin/ArticleImageEditor";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { ArticleVideoEditor } from "@/components/admin/ArticleVideoEditor";
import { displayRegionName } from "@/lib/region-labels";
import { ManualWriterBox } from "@/components/admin/ManualWriterBox";
import { PageHeader, primaryBtnClass, tabPillsWrapClass, tabPillClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/")({
  component: AdminQueue,
});

type Draft = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  corpo: string | null;
  seo_title: string | null;
  seo_description: string | null;
  editor_responsavel: string | null;
  status: "rascunho" | "aprovado" | "rejeitado" | "publicado" | "expirado";
  gerado_em: string;
  imagem_capa_url: string | null;
  imagem_credito: string | null;
  imagem_original_url: string | null;
  video_embed_url: string | null;
  publicado_automaticamente: boolean;
  fixado_posicao: number | null;
  fixado_escopo: "estado" | "regiao" | "cidades" | null;
  fixado_regioes: string[] | null;
  fixado_cidades: string[] | null;
  regiao_id: string | null;
  categoria_id: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
};

const STATUS_TABS: Draft["status"][] = ["rascunho", "aprovado", "publicado", "expirado", "rejeitado"];

function AdminQueue() {
  const [tab, setTab] = useState<Draft["status"]>("rascunho");
  const [items, setItems] = useState<Draft[] | null>(null);
  const [pinned, setPinned] = useState<Draft[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unpinBusyId, setUnpinBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const fullSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, imagem_capa_url, imagem_credito, imagem_original_url, video_embed_url, publicado_automaticamente, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const pinBasicSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, imagem_capa_url, imagem_credito, imagem_original_url, publicado_automaticamente, fixado_posicao, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const midSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, imagem_capa_url, imagem_credito, imagem_original_url, publicado_automaticamente, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const fallbackSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, status, gerado_em, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const run = (sel: string) =>
        sb.from("generated_articles")
          .select(sel)
          .eq("status", tab)
          .order("gerado_em", { ascending: false })
          .limit(50);
      let res = await run(fullSelect);
      if (res.error && /fixado_(escopo|regioes|cidades)|video_embed_url/i.test(res.error.message)) {
        res = await run(pinBasicSelect);
      }
      if (res.error && /fixado_posicao/i.test(res.error.message)) {
        res = await run(midSelect);
      }
      if (res.error && /column .* does not exist|imagem_|editor_responsavel|video_embed_url/i.test(res.error.message)) {
        res = await run(fallbackSelect);
      }
      if (res.error) throw res.error;
      setItems((res.data ?? []) as unknown as Draft[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [tab]);

  const loadPinned = useCallback(async () => {
    try {
      const sb = await getExternalBrowser();
      const sel = "id, slug, titulo, status, gerado_em, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const { data, error } = await sb.from("generated_articles")
        .select(sel)
        .eq("status", "publicado")
        .not("fixado_posicao", "is", null)
        .order("fixado_posicao", { ascending: true })
        .limit(50);
      if (error) {
        // Coluna pode não existir ainda em ambientes antigos; ignora.
        setPinned([]);
        return;
      }
      setPinned((data ?? []) as unknown as Draft[]);
    } catch {
      setPinned([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPinned(); }, [loadPinned]);

  async function unpin(id: string) {
    if (!confirm("Desfixar esta matéria?")) return;
    setUnpinBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles")
        .update({ fixado_posicao: null, fixado_escopo: null, fixado_regioes: null, fixado_cidades: null })
        .eq("id", id);
      if (error) throw error;
      await Promise.all([loadPinned(), load()]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao desfixar");
    } finally {
      setUnpinBusyId(null);
    }
  }

  async function runPipeline() {
    setPipelineBusy(true);
    setPipelineLog([
      "Rodando pipeline completo…",
      "  · scrape-source → cluster-articles → classify-and-quota → process-pending-clusters",
    ]);
    const steps: Array<{ name: string; body?: Record<string, unknown> }> = [
      // sync:true força cada função a rodar até o fim antes de devolver a
      // resposta — sem isso o scrape-source volta na hora (background) e os
      // passos seguintes rodam em cima de raw_articles ainda vazia, então
      // nenhuma matéria é redigida e tudo fica parado em "pautas / clusters".
      { name: "scrape-source", body: { force: true, sync: true } },
      { name: "cluster-articles", body: { sync: true } },
      { name: "classify-and-quota", body: { sync: true } },
      { name: "process-pending-clusters", body: { limit: 50, sync: true } },
    ];
    for (const step of steps) {
      setPipelineLog((l) => [...l, `→ ${step.name}…`]);
      try {
        const { data, error } = await supabase.functions.invoke(step.name, { body: step.body ?? {} });
        if (error) throw error;
        const summary = data && typeof data === "object" ? JSON.stringify(data).slice(0, 240) : "ok";
        setPipelineLog((l) => [...l, `  ✓ ${summary}`]);
      } catch (e: unknown) {
        setPipelineLog((l) => [...l, `  ✗ ${e instanceof Error ? e.message : "erro"}`]);
        break;
      }
    }
    setPipelineBusy(false);
    await load();
  }

  async function updateStatus(id: string, next: Draft["status"]) {
    setBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const patch: Record<string, unknown> = { status: next };
      if (next === "publicado") patch.publicado_em = new Date().toISOString();
      const { error } = await sb.from("generated_articles").update(patch).eq("id", id);
      if (error) throw error;
      await Promise.all([load(), loadPinned()]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Apagar esta matéria definitivamente? Esta ação não pode ser desfeita.")) return;
    setDeleteBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles").delete().eq("id", id);
      if (error) throw error;
      await Promise.all([load(), loadPinned()]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao apagar");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function deleteAllInTab() {
    if (!items || items.length === 0) return;
    if (tab === "publicado") {
      alert("Não é possível apagar em massa matérias publicadas. Despublique antes.");
      return;
    }
    if (!confirm(`Apagar TODAS as ${items.length} matérias em «${tab}»? Esta ação não pode ser desfeita.`)) return;
    setBulkBusy(true);
    try {
      const sb = await getExternalBrowser();
      const ids = items.map((i) => i.id);
      const { error } = await sb.from("generated_articles").delete().in("id", ids);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Falha ao apagar em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fila"
        title="Fila editorial"
        subtitle="Rascunhos, aprovações e matérias publicadas."
        actions={
          <>
            <button onClick={runPipeline} disabled={pipelineBusy} className={primaryBtnClass()}>
              {pipelineBusy ? "Rodando pipeline…" : "▶ Rodar pipeline agora"}
            </button>
            <div className={tabPillsWrapClass()}>
              {STATUS_TABS.map((s) => (
                <button key={s} onClick={() => setTab(s)} className={`capitalize ${tabPillClass(tab === s)}`}>
                  {s}
                </button>
              ))}
            </div>
          </>
        }
      />

      {pipelineLog.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
          <div className="mb-2 text-xs font-semibold text-emerald-400">Log do pipeline</div>
          <pre className="max-h-48 overflow-auto text-[11px] leading-tight text-emerald-200/90">
{pipelineLog.join("\n")}
          </pre>
        </div>
      )}

      <ManualWriterBox onCreated={load} />

      <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-amber-900">📌 Matérias fixadas ({pinned?.length ?? 0})</h2>
          <span className="text-[11px] text-amber-800">Publicadas em destaque na home</span>
        </div>
        {pinned === null && <p className="text-xs text-amber-800">Carregando…</p>}
        {pinned && pinned.length === 0 && (
          <p className="text-xs text-amber-800">
            Nenhuma matéria fixada. Abra uma matéria publicada, clique em «✎ Editar matéria» e escolha a posição de fixação (Manchete ou Lateral).
          </p>
        )}
        {pinned && pinned.length > 0 && (
          <ul className="space-y-1.5">
            {pinned.map((p) => {
              const esc = p.fixado_escopo ?? "estado";
              const escLabel = esc === "estado"
                ? "Estado"
                : esc === "regiao"
                ? `Regiões: ${(p.fixado_regioes ?? []).slice(0, 2).join(", ") || "—"}${(p.fixado_regioes ?? []).length > 2 ? ` (+${(p.fixado_regioes ?? []).length - 2})` : ""}`
                : `Cidades: ${(p.fixado_cidades ?? []).slice(0, 2).join(", ") || "—"}${(p.fixado_cidades ?? []).length > 2 ? ` (+${(p.fixado_cidades ?? []).length - 2})` : ""}`;
              return (
                <li key={p.id} className="flex items-center gap-2 rounded border border-amber-200 bg-white px-2 py-1.5 text-sm">
                  <span className="shrink-0 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {p.fixado_posicao === 0 ? "Manchete" : `Lateral ${p.fixado_posicao}`}
                  </span>
                  <span className="shrink-0 text-[11px] text-amber-900">{escLabel}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.titulo}</span>
                  {p.regiao && (
                    <a href={`/${p.regiao.slug}/${p.slug}`} target="_blank" rel="noreferrer"
                      className="shrink-0 rounded border px-2 py-0.5 text-[11px] hover:bg-accent">Ver</a>
                  )}
                  <button
                    disabled={unpinBusyId === p.id}
                    onClick={() => unpin(p.id)}
                    className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                    {unpinBusyId === p.id ? "…" : "✕ Desfixar"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {err && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-slate-500">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-slate-500">Nada em «{tab}».</p>}

      {items && items.length > 0 && tab !== "publicado" && (
        <div className="flex justify-end">
          <button
            onClick={deleteAllInTab}
            disabled={bulkBusy}
            className="rounded-full border border-red-300 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {bulkBusy ? "Apagando…" : `🗑 Apagar todas as ${items.length} em «${tab}»`}
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {items?.map((it) => (
          <li key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {it.regiao && <span className="rounded bg-[#0A2540] px-2 py-0.5 font-semibold text-white">{displayRegionName(it.regiao.slug, it.regiao.nome)}</span>}
              {it.categoria && <span className="rounded bg-[#0066CC] px-2 py-0.5 font-semibold text-white">{it.categoria.nome}</span>}
              {it.publicado_automaticamente && (
                <span className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white" title="Sem foto real da fonte e interesse alto o bastante — publicou sozinha, sem espera por decisão">
                  ⚡ Publicação automática
                </span>
              )}
              {typeof it.fixado_posicao === "number" && it.fixado_posicao !== null && (
                <span className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-white">
                  📌 {it.fixado_posicao === 0 ? "Manchete" : `Lateral ${it.fixado_posicao}`}
                  {" · "}
                  {(() => {
                    const esc = it.fixado_escopo ?? "estado";
                    if (esc === "estado") return "Estado";
                    if (esc === "regiao") {
                      const list = it.fixado_regioes ?? [];
                      if (list.length === 0) return "Regiões";
                      const first = list.slice(0, 2).join(", ");
                      const extra = list.length > 2 ? ` (+${list.length - 2})` : "";
                      return `Regiões: ${first}${extra}`;
                    }
                    const list = it.fixado_cidades ?? [];
                    if (list.length === 0) return "Cidades";
                    const first = list.slice(0, 2).join(", ");
                    const extra = list.length > 2 ? ` (+${list.length - 2})` : "";
                    return `Cidades: ${first}${extra}`;
                  })()}
                </span>
              )}
              <span>{new Date(it.gerado_em).toLocaleString("pt-BR")}</span>
            </div>
            <h2 className="text-lg font-semibold leading-snug">{it.titulo}</h2>
            {it.subtitulo && <p className="mt-1 text-sm text-muted-foreground">{it.subtitulo}</p>}
            {it.resumo && <p className="mt-2 text-sm">{it.resumo}</p>}
            <ArticleImageEditor
              articleId={it.id}
              currentUrl={it.imagem_capa_url}
              originalUrl={it.imagem_original_url}
              currentCredito={it.imagem_credito}
              onUpdated={load}
            />
            <ArticleVideoEditor
              articleId={it.id}
              currentUrl={it.video_embed_url}
              onUpdated={load}
            />
            {editingId === it.id ? (
              <ArticleEditor
                articleId={it.id}
                initial={{
                  titulo: it.titulo,
                  subtitulo: it.subtitulo,
                  resumo: it.resumo,
                  corpo: it.corpo,
                  slug: it.slug,
                  seo_title: it.seo_title,
                  seo_description: it.seo_description,
                  editor_responsavel: it.editor_responsavel,
                  fixado_posicao: it.fixado_posicao ?? null,
                  fixado_escopo: it.fixado_escopo ?? null,
                  fixado_regioes: it.fixado_regioes ?? null,
                  fixado_cidades: it.fixado_cidades ?? null,
                  regiao_id: it.regiao_id ?? null,
                  categoria_id: it.categoria_id ?? null,
                }}
                onSaved={() => { setEditingId(null); load(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setEditingId(editingId === it.id ? null : it.id)}
                className="rounded border px-3 py-1 text-xs font-semibold hover:bg-accent">
                {editingId === it.id ? "Fechar editor" : "✎ Editar matéria"}
              </button>
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
              {it.status !== "publicado" && (
                <button
                  disabled={deleteBusyId === it.id}
                  onClick={() => deleteOne(it.id)}
                  className="ml-auto rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  title="Apagar definitivamente"
                >
                  {deleteBusyId === it.id ? "Apagando…" : "🗑 Apagar"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}