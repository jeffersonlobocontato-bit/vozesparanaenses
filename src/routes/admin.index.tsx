import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { ArticleImageEditor } from "@/components/admin/ArticleImageEditor";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { ArticleVideoEditor } from "@/components/admin/ArticleVideoEditor";
import { displayRegionName } from "@/lib/region-labels";
import { NovaMateria } from "@/components/admin/NovaMateria";
import {
  PageHeader, Section, btn, ConfirmButton, StatusPill, FilterBar, campoClass, rotuloClass,
  EmptyState, ErrorBanner, Tabs,
} from "@/components/admin/ui";
import { ChevronDown, ExternalLink, Pencil, Pin, Plus, Trash2, X, Zap } from "lucide-react";

type AdminQueueSearch = { edit?: string };

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): AdminQueueSearch => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
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
  publicado_em: string | null;
  imagem_capa_url: string | null;
  imagem_credito: string | null;
  imagem_legenda: string | null;
  imagem_original_url: string | null;
 imagem_galeria: { url: string; legenda?: string | null; credito?: string | null }[] | null;
  video_embed_url: string | null;
  video_legenda: string | null;
  video_credito: string | null;
  publicado_automaticamente: boolean;
  fixado_posicao: number | null;
  fixado_escopo: "estado" | "regiao" | "cidades" | null;
  fixado_regioes: string[] | null;
  fixado_cidades: string[] | null;
  regiao_id: string | null;
  categoria_id: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
  tldr: string | null;
  fatos_5w1h: {
    quem?: string | null;
    o_que?: string | null;
    quando?: string | null;
    onde?: string | null;
    por_que?: string | null;
    como?: string | null;
  } | null;
  faq: Array<{ pergunta: string; resposta: string }> | null;
  // Agente de criticidade (067) — por que a matéria ficou na fila.
  criticidade_nivel?: "baixo" | "medio" | "alto" | "critico" | null;
  criticidade_motivos?: string[] | null;
  foto_origem?: string | null;
};

// "aprovado" não é mais usado: o fluxo automático publica direto ou deixa
// em revisão (rascunho) pela criticidade.
const STATUS_TABS: Draft["status"][] = ["rascunho", "publicado", "expirado", "rejeitado"];
const STATUS_ROTULO: Record<Draft["status"], string> = {
  rascunho: "Em revisão",
  aprovado: "Aprovadas",
  publicado: "Publicadas",
  expirado: "Expiradas",
  rejeitado: "Rejeitadas",
};
type AbaEdicao = "texto" | "imagem" | "video";

function AdminQueue() {
  const editSlug = Route.useSearch({ select: (s) => s.edit });
  const [tab, setTab] = useState<Draft["status"]>(editSlug ? "publicado" : "rascunho");
  const [items, setItems] = useState<Draft[] | null>(null);
  const [pinned, setPinned] = useState<Draft[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unpinBusyId, setUnpinBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [abaEdicao, setAbaEdicao] = useState<AbaEdicao>("texto");
  const [novaAberta, setNovaAberta] = useState(false);
  const [fixadasAbertas, setFixadasAbertas] = useState(false);
  // Filtros da lista (aplicados no banco, não só nas 50 carregadas).
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroRegiao, setFiltroRegiao] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [opcoes, setOpcoes] = useState<{ categorias: { id: string; nome: string }[]; regioes: { id: string; nome: string; slug: string }[] }>({ categorias: [], regioes: [] });
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => {
    (async () => {
      const sb = await getExternalBrowser();
      const [c, r] = await Promise.all([
        sb.from("editorial_categories").select("id, nome").order("nome"),
        sb.from("regioes").select("id, nome, slug").order("nome"),
      ]);
      setOpcoes({
        categorias: (c.data ?? []) as { id: string; nome: string }[],
        regioes: ((r.data ?? []) as { id: string; nome: string; slug: string }[]).map((x) => ({ ...x, nome: displayRegionName(x.slug, x.nome) })),
      });
    })();
  }, []);
  const filtrando = !!(filtroCategoria || filtroRegiao || buscaAplicada);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setItems(null);
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const fullSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, publicado_em, imagem_capa_url, imagem_credito, imagem_legenda, imagem_original_url, imagem_galeria, video_embed_url, video_legenda, video_credito, publicado_automaticamente, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades, regiao_id, categoria_id, tldr, fatos_5w1h, faq, criticidade_nivel, criticidade_motivos, foto_origem, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const semCriticidadeSelect = fullSelect.replace(", criticidade_nivel, criticidade_motivos, foto_origem", "");
      const pinBasicSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, publicado_em, imagem_capa_url, imagem_credito, imagem_legenda, imagem_original_url, publicado_automaticamente, fixado_posicao, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const midSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, editor_responsavel, status, gerado_em, publicado_em, imagem_capa_url, imagem_credito, imagem_legenda, imagem_original_url, publicado_automaticamente, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const fallbackSelect = "id, slug, titulo, subtitulo, resumo, corpo, seo_title, seo_description, status, gerado_em, publicado_em, regiao_id, categoria_id, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";
      const run = (sel: string) => {
        let q = sb.from("generated_articles").select(sel).eq("status", tab);
        if (filtroCategoria) q = q.eq("categoria_id", filtroCategoria);
        if (filtroRegiao) q = q.eq("regiao_id", filtroRegiao);
        if (buscaAplicada) q = q.ilike("titulo", `%${buscaAplicada.replace(/[%_]/g, "")}%`);
        // Publicadas: as mais recentes no ar primeiro.
        return q
          .order(tab === "publicado" ? "publicado_em" : "gerado_em", { ascending: false, nullsFirst: false })
          .limit(filtroCategoria || filtroRegiao || buscaAplicada ? 200 : 50);
      };
      let res = await run(fullSelect);
      if (res.error && /criticidade_|foto_origem/i.test(res.error.message)) {
        res = await run(semCriticidadeSelect);
      }
      if (res.error && /fixado_(escopo|regioes|cidades)|video_embed_url|video_legenda|video_credito|imagem_legenda|imagem_galeria|tldr|fatos_5w1h|faq/i.test(res.error.message)) {
        res = await run(pinBasicSelect);
      }
      if (res.error && /fixado_posicao/i.test(res.error.message)) {
        res = await run(midSelect);
      }
      if (res.error && /column .* does not exist|imagem_|editor_responsavel|video_/i.test(res.error.message)) {
        res = await run(fallbackSelect);
      }
      if (res.error) throw res.error;
      setItems((res.data ?? []) as unknown as Draft[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, [tab, filtroCategoria, filtroRegiao, buscaAplicada]);

  // Salvar dentro do editor não deve fechar o editor nem jogar a página para
  // outro ponto: recarrega a lista sem esvaziá-la (silent) e restaura o scroll.
  const saveAndStay = useCallback(async () => {
    const y = typeof window !== "undefined" ? window.scrollY : 0;
    await load({ silent: true });
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
  }, [load]);

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

  // Deep-link vindo do site público (botão flutuante "Editar esta matéria"):
  // troca para a aba «publicado» e abre o editor da matéria correspondente
  // ao slug assim que a lista termina de carregar.
  useEffect(() => {
    if (!editSlug || !items) return;
    const found = items.find((it) => it.slug === editSlug);
    if (found) setEditingId(found.id);
  }, [editSlug, items]);

  async function unpin(id: string) {
    setUnpinBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles")
        .update({ fixado_posicao: null, fixado_escopo: null, fixado_regioes: null, fixado_cidades: null })
        .eq("id", id);
      if (error) throw error;
      await Promise.all([loadPinned(), load()]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao desfixar");
    } finally {
      setUnpinBusyId(null);
    }
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
      setErr(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOne(id: string) {
    setDeleteBusyId(id);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles").delete().eq("id", id);
      if (error) throw error;
      await Promise.all([load(), loadPinned()]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao apagar");
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function deleteAllInTab() {
    if (!items || items.length === 0) return;
    if (tab === "publicado") {
      setErr("Não é possível apagar em massa matérias publicadas. Despublique antes.");
      return;
    }
    setBulkBusy(true);
    try {
      const sb = await getExternalBrowser();
      const ids = items.map((i) => i.id);
      const { error } = await sb.from("generated_articles").delete().in("id", ids);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao apagar em massa");
    } finally {
      setBulkBusy(false);
    }
  }

  function abrirEditor(id: string) {
    if (editingId === id) {
      setEditingId(null);
    } else {
      setEditingId(id);
      setAbaEdicao("texto");
    }
  }

  const rotuloTab = STATUS_ROTULO[tab] ?? tab;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Redação"
        title="Matérias"
        subtitle="O que a criticidade segurou para revisão e o que já está no ar."
        actions={
          <>
            <Tabs<Draft["status"]>
              value={tab}
              onChange={setTab}
              items={STATUS_TABS.map((s) => ({ value: s, label: STATUS_ROTULO[s] ?? s }))}
            />
            <button type="button" onClick={() => setNovaAberta((v) => !v)} className={btn("primary")} aria-expanded={novaAberta}>
              {novaAberta ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {novaAberta ? "Fechar" : "Nova matéria"}
            </button>
          </>
        }
      />

      {novaAberta && (
        <Section title="Nova matéria" subtitle="Fora do pipeline automático: a IA redige a partir de uma fonte, ou você publica o seu texto.">
          <NovaMateria onCreated={load} />
        </Section>
      )}

      <Section
        title={`Fixadas na home (${pinned?.length ?? 0})`}
        padded={fixadasAbertas}
        aside={
          <button type="button" onClick={() => setFixadasAbertas((v) => !v)} className={btn("ghost", "sm")} aria-expanded={fixadasAbertas}>
            <ChevronDown className={`h-3.5 w-3.5 transition ${fixadasAbertas ? "rotate-180" : ""}`} />
            {fixadasAbertas ? "Recolher" : "Mostrar"}
          </button>
        }
      >
        {fixadasAbertas && (
          <>
            {pinned === null && <p className="text-xs text-slate-500">Carregando…</p>}
            {pinned && pinned.length === 0 && (
              <p className="text-xs text-slate-500">
                Nenhuma matéria fixada. Abra uma matéria publicada, clique em «Editar», vá na aba «Fixação» e escolha Manchete ou Lateral.
              </p>
            )}
            {pinned && pinned.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {pinned.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E29F65]/20 px-2 py-0.5 text-[11px] font-semibold text-[#12201E]">
                      <Pin className="h-3 w-3" />
                      {p.fixado_posicao === 0 ? "Manchete" : `Lateral ${p.fixado_posicao}`}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500">{escopoFixacao(p)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[#12201E]">{p.titulo}</span>
                    {p.regiao && (
                      <a href={`/${p.regiao.slug}/${p.slug}`} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
                        <ExternalLink className="h-3.5 w-3.5" /> Ver
                      </a>
                    )}
                    <ConfirmButton
                      onConfirm={() => unpin(p.id)}
                      disabled={unpinBusyId === p.id}
                      confirmLabel="Desfixar"
                    >
                      {unpinBusyId === p.id ? "Desfixando…" : "Desfixar"}
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <FilterBar
        resumo={items && (
          <>
            {items.length} matéria{items.length === 1 ? "" : "s"} em «{rotuloTab}»{filtrando ? " com esses filtros" : " (as 50 mais recentes)"}
          </>
        )}
      >
        <label className={`${rotuloClass} min-w-[180px] flex-1`} htmlFor="filtro-busca">
          Buscar no título
          <input
            id="filtro-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: Cascavel, vacinação, PUC-PR…"
            className={`${campoClass} font-normal`}
          />
        </label>
        <label className={`${rotuloClass} min-w-[160px]`} htmlFor="filtro-editoria">
          Editoria
          <select
            id="filtro-editoria"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className={`${campoClass} font-normal`}
          >
            <option value="">Todas</option>
            {opcoes.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className={`${rotuloClass} min-w-[160px]`} htmlFor="filtro-regiao">
          Região
          <select
            id="filtro-regiao"
            value={filtroRegiao}
            onChange={(e) => setFiltroRegiao(e.target.value)}
            className={`${campoClass} font-normal`}
          >
            <option value="">Todas</option>
            {opcoes.regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        {filtrando && (
          <button
            type="button"
            onClick={() => { setFiltroCategoria(""); setFiltroRegiao(""); setBusca(""); }}
            className={btn("ghost")}
          >
            Limpar filtros
          </button>
        )}
      </FilterBar>

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!items && !err && <p className="text-sm text-slate-500">Carregando…</p>}
      {items && items.length === 0 && (
        <EmptyState title={filtrando ? "Nenhuma matéria com esses filtros." : `Nenhuma matéria em «${rotuloTab}».`}>
          {filtrando ? "Mude ou limpe os filtros para ver mais." : null}
        </EmptyState>
      )}

      {items && items.length > 0 && tab !== "publicado" && (
        <div className="flex justify-end">
          <ConfirmButton
            onConfirm={deleteAllInTab}
            disabled={bulkBusy}
            confirmLabel={`Sim, apagar ${items.length} definitivamente`}
            title="Apaga só as matérias que aparecem na lista abaixo. Não pode ser desfeito."
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkBusy
              ? "Apagando…"
              : `Apagar as ${items.length} matérias desta lista (${rotuloTab}${filtrando ? ", com os filtros atuais" : ""})`}
          </ConfirmButton>
        </div>
      )}

      <ul className="space-y-3">
        {items?.map((it) => {
          const editando = editingId === it.id;
          const quando = it.status === "publicado" && it.publicado_em
            ? `Publicada em ${new Date(it.publicado_em).toLocaleString("pt-BR")}`
            : `Gerada em ${new Date(it.gerado_em).toLocaleString("pt-BR")}`;
          return (
            <li key={it.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${editando ? "border-[#12201E]" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusPill status={it.status} />
                {it.regiao && <span className="font-semibold text-[#12201E]">{displayRegionName(it.regiao.slug, it.regiao.nome)}</span>}
                {it.categoria && <span className="rounded-full bg-[#E29F65]/20 px-2 py-0.5 font-semibold text-[#12201E]">{it.categoria.nome}</span>}
                {it.publicado_automaticamente && (
                  <span className="inline-flex items-center gap-1 text-emerald-700" title="Sem foto real da fonte e interesse alto o bastante: publicou sozinha, sem esperar decisão">
                    <Zap className="h-3 w-3" /> Publicação automática
                  </span>
                )}
                {typeof it.fixado_posicao === "number" && it.fixado_posicao !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E29F65]/20 px-2 py-0.5 font-semibold text-[#12201E]">
                    <Pin className="h-3 w-3" />
                    {it.fixado_posicao === 0 ? "Manchete" : `Lateral ${it.fixado_posicao}`}
                    {" · "}
                    {escopoFixacao(it)}
                  </span>
                )}
                <span className="ml-auto">{quando}</span>
              </div>
              <h2 className="mt-1.5 text-base font-semibold leading-snug text-[#12201E]">{it.titulo}</h2>
              <CriticidadeAviso nivel={it.criticidade_nivel} motivos={it.criticidade_motivos} />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => abrirEditor(it.id)} className={btn("secondary", "sm")} aria-expanded={editando}>
                  {editando ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {editando ? "Fechar editor" : "Editar"}
                </button>
                {it.status === "publicado" && it.regiao && (
                  <a href={`/${it.regiao.slug}/${it.slug}`} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
                    <ExternalLink className="h-3.5 w-3.5" /> Ver no site
                  </a>
                )}
                {it.status !== "publicado" && (
                  <ConfirmButton
                    variante="success"
                    confirmLabel="Publicar agora"
                    disabled={busyId === it.id}
                    onConfirm={() => updateStatus(it.id, "publicado")}
                  >
                    Publicar
                  </ConfirmButton>
                )}
                {it.status !== "rejeitado" && it.status !== "publicado" && (
                  <ConfirmButton
                    confirmLabel="Rejeitar matéria"
                    disabled={busyId === it.id}
                    onConfirm={() => updateStatus(it.id, "rejeitado")}
                  >
                    Rejeitar
                  </ConfirmButton>
                )}
                {it.status === "publicado" && (
                  <ConfirmButton
                    confirmLabel="Tirar do ar"
                    disabled={busyId === it.id}
                    onConfirm={() => updateStatus(it.id, "rascunho")}
                    title="Volta a matéria para «Em revisão»"
                  >
                    Despublicar
                  </ConfirmButton>
                )}
                {it.status !== "publicado" && (
                  <span className="ml-auto">
                    <ConfirmButton
                      confirmLabel="Apagar definitivamente"
                      disabled={deleteBusyId === it.id}
                      onConfirm={() => deleteOne(it.id)}
                      title="Apagar definitivamente. Não pode ser desfeito."
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleteBusyId === it.id ? "Apagando…" : "Apagar"}
                    </ConfirmButton>
                  </span>
                )}
              </div>

              {editando && (
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <Tabs<AbaEdicao>
                    value={abaEdicao}
                    onChange={setAbaEdicao}
                    items={[
                      { value: "texto", label: "Texto" },
                      { value: "imagem", label: "Imagem" },
                      { value: "video", label: "Vídeo" },
                    ]}
                  />
                  {abaEdicao === "texto" && (
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
                        tldr: it.tldr ?? null,
                        fatos_5w1h: it.fatos_5w1h ?? null,
                        faq: it.faq ?? null,
                        publicado_em: it.publicado_em ?? null,
                      }}
                      onSaved={() => { saveAndStay(); }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                  {abaEdicao === "imagem" && (
                    <ArticleImageEditor
                      articleId={it.id}
                      currentUrl={it.imagem_capa_url}
                      originalUrl={it.imagem_original_url}
                      currentCredito={it.imagem_credito}
                      currentLegenda={it.imagem_legenda}
                      currentGaleria={it.imagem_galeria}
                      onUpdated={saveAndStay}
                    />
                  )}
                  {abaEdicao === "video" && (
                    <ArticleVideoEditor
                      articleId={it.id}
                      currentUrl={it.video_embed_url}
                      currentLegenda={it.video_legenda}
                      currentCredito={it.video_credito}
                      onUpdated={saveAndStay}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Texto curto do escopo de uma fixação (estado, regiões ou cidades).
function escopoFixacao(p: Pick<Draft, "fixado_escopo" | "fixado_regioes" | "fixado_cidades">): string {
  const esc = p.fixado_escopo ?? "estado";
  if (esc === "estado") return "Estado";
  const list = (esc === "regiao" ? p.fixado_regioes : p.fixado_cidades) ?? [];
  const nome = esc === "regiao" ? "Regiões" : "Cidades";
  if (list.length === 0) return nome;
  const extra = list.length > 2 ? ` (+${list.length - 2})` : "";
  return `${nome}: ${list.slice(0, 2).join(", ")}${extra}`;
}

// Por que o agente de criticidade segurou a matéria (só aparece se houver risco).
function CriticidadeAviso({ nivel, motivos }: { nivel?: Draft["criticidade_nivel"]; motivos?: string[] | null }) {
  if (!nivel || nivel === "baixo") return null;
  const cor =
    nivel === "critico" ? "border-red-300 bg-red-50 text-red-800"
    : nivel === "alto" ? "border-orange-300 bg-orange-50 text-orange-800"
    : "border-amber-300 bg-amber-50 text-amber-800";
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${cor}`}>
      <span className="font-bold uppercase tracking-wide">Criticidade {nivel}</span>
      {motivos?.length ? (
        <ul className="mt-1 list-disc pl-4">
          {motivos.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
