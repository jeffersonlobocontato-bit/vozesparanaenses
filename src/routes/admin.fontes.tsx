import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { displayRegionName } from "@/lib/region-labels";
import {
  PageHeader,
  Section,
  btn,
  ConfirmButton,
  StatusPill,
  FilterBar,
  campoClass,
  rotuloClass,
  EmptyState,
  ErrorBanner,
  Aviso,
  Tabs,
} from "@/components/admin/ui";
import { FichaFonte } from "@/components/admin/FichaFonte";

export const Route = createFileRoute("/admin/fontes")({
  component: AdminFontes,
});

type Regiao = { id: string; slug: string; nome: string };
type Estat = {
  fonte_id: string;
  coletadas: number;
  materias_publicadas: number;
  materias_total: number;
  notas_publicadas: number;
  ultima_publicacao_em: string | null;
};
type Fonte = {
  id: string;
  nome: string;
  url_base: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  frequencia_horas: number | null;
  ativo: boolean;
  ultimo_scrape_em: string | null;
  regiao_id: string | null;
  regiao: { slug: string; nome: string } | null;
  tipo: "veiculo" | "prefeitura";
  email_imprensa: string | null;
};

const empty: {
  nome: string;
  url_base: string;
  regiao_id: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  // Vazio = segue os ciclos fixos (portais 10h/16h/21h, prefeituras 12h/18h). Só fontes de curadoria usam
  // frequência própria — preencher aqui tira a fonte dos ciclos.
  frequencia_horas: string;
  ativo: boolean;
  email_imprensa: string;
} = {
  nome: "",
  url_base: "",
  regiao_id: "",
  tipo_renderizacao: "estatico",
  protecao_antibot: false,
  frequencia_horas: "",
  ativo: true,
  email_imprensa: "",
};

function AdminFontes() {
  const [items, setItems] = useState<Fonte[] | null>(null);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"veiculo" | "prefeitura">("veiculo");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"todas" | "ativas" | "inativas">("todas");
  const [estat, setEstat] = useState<Map<string, Estat> | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const fecharFicha = useCallback(() => setFichaId(null), []);

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const [{ data: fontes, error: e1 }, { data: regs, error: e2 }] = await Promise.all([
        sb.from("fontes").select("id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ativo, ultimo_scrape_em, regiao_id, regiao:regioes(slug, nome), tipo, email_imprensa").order("nome"),
        sb.from("regioes").select("id, slug, nome").order("nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setItems((fontes ?? []) as unknown as Fonte[]);
      setRegioes((regs ?? []) as Regiao[]);
      // Notícias por fonte (074). Sem a função no banco, a coluna mostra "—".
      const { data: est, error: e3 } = await sb.rpc("fontes_estatisticas");
      setEstat(e3 ? null : new Map(((est ?? []) as Estat[]).map((r) => [r.fonte_id, r])));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(f: Fonte) {
    setEditingId(f.id);
    setTab(f.tipo ?? "veiculo");
    setForm({
      nome: f.nome,
      url_base: f.url_base,
      regiao_id: f.regiao_id ?? "",
      tipo_renderizacao: f.tipo_renderizacao,
      protecao_antibot: f.protecao_antibot,
      frequencia_horas: f.frequencia_horas == null ? "" : String(f.frequencia_horas),
      ativo: f.ativo,
      email_imprensa: f.email_imprensa ?? "",
    });
    setMsg(null);
    setFormAberto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function novaFonte() {
    setEditingId(null);
    setForm(empty);
    setMsg(null);
    setFormAberto(true);
  }

  function resetForm() { setEditingId(null); setForm(empty); setFormAberto(false); }

  function trocarAba(t: "veiculo" | "prefeitura") {
    setTab(t);
    resetForm();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const payload = {
        nome: form.nome.trim(),
        url_base: form.url_base.trim(),
        regiao_id: form.regiao_id || null,
        tipo_renderizacao: form.tipo_renderizacao,
        protecao_antibot: form.protecao_antibot,
        // Vazio = ciclos fixos (null). Antes o formulário gravava 6h em toda
        // fonte salva e tirava a fonte dos ciclos sem ninguém perceber.
        frequencia_horas: form.frequencia_horas.trim() ? Math.max(1, Number(form.frequencia_horas) || 1) : null,
        ativo: form.ativo,
        tipo: tab,
        email_imprensa: tab === "prefeitura" ? (form.email_imprensa.trim() || null) : null,
      };
      const { error } = editingId
        ? await sb.from("fontes").update(payload).eq("id", editingId)
        : await sb.from("fontes").insert(payload);
      if (error) throw error;
      setMsg(editingId ? "Fonte atualizada." : "Fonte criada.");
      resetForm();
      await load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAtivo(f: Fonte) {
    const sb = await getExternalBrowser();
    await sb.from("fontes").update({ ativo: !f.ativo }).eq("id", f.id);
    load();
  }

  async function remove(f: Fonte) {
    const sb = await getExternalBrowser();
    const { error } = await sb.from("fontes").delete().eq("id", f.id);
    if (error) { setMsg("Falha: " + error.message); return; }
    load();
  }

  const contagem = useMemo(() => {
    const c = { veiculo: 0, prefeitura: 0 };
    for (const f of items ?? []) c[(f.tipo ?? "veiculo") as "veiculo" | "prefeitura"]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = busca.trim().toLowerCase();
    return items.filter((f) => {
      if ((f.tipo ?? "veiculo") !== tab) return false;
      if (situacao === "ativas" && !f.ativo) return false;
      if (situacao === "inativas" && f.ativo) return false;
      if (q && !f.nome.toLowerCase().includes(q) && !f.url_base.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, tab, busca, situacao]);

  const totalAba = tab === "prefeitura" ? contagem.prefeitura : contagem.veiculo;
  const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const td = "px-4 py-2.5 align-top";
  const ehPref = tab === "prefeitura";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coleta"
        title="Fontes"
        subtitle="Veículos de imprensa e assessorias oficiais das prefeituras que o robô lê."
        actions={
          <>
            <button type="button" onClick={load} className={btn("secondary")}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
            </button>
            <button type="button" onClick={novaFonte} className={btn("primary")}>
              <Plus className="h-4 w-4" aria-hidden /> {ehPref ? "Nova prefeitura" : "Nova fonte"}
            </button>
          </>
        }
      />

      {/* Módulos separados de propósito — scraping, cadastro e critério de
          relevância são diferentes entre veículo de imprensa e assessoria
          de prefeitura (ver 024_fontes_prefeitura.sql). */}
      <Tabs
        value={tab}
        onChange={trocarAba}
        items={[
          { value: "veiculo", label: "Veículos", count: items ? contagem.veiculo : undefined },
          { value: "prefeitura", label: "Prefeituras", count: items ? contagem.prefeitura : undefined },
        ]}
      />
      {ehPref && (
        <p className="text-xs text-slate-500">
          Fonte oficial e primária: coletada pela função <code>scrape-prefeitura</code> e elegível mesmo sem outro veículo cobrindo o fato.
        </p>
      )}

      {formAberto && (
        <Section
          title={editingId ? "Editar fonte" : ehPref ? "Nova prefeitura" : "Nova fonte"}
          aside={
            <button type="button" onClick={resetForm} className={btn("ghost", "sm")}>
              <X className="h-3.5 w-3.5" aria-hidden /> Cancelar
            </button>
          }
        >
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <label className={rotuloClass}>
              Nome
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className={campoClass} placeholder={ehPref ? "Ex: Prefeitura de Cascavel" : "Ex: Catve"} />
            </label>
            <label className={rotuloClass}>
              URL base (RSS ou página de notícias)
              <input required type="url" value={form.url_base} onChange={(e) => setForm({ ...form, url_base: e.target.value })}
                className={campoClass} placeholder={ehPref ? "https://cidade.pr.gov.br/noticias/" : "https://catve.com/rss"} />
            </label>
            <label className={rotuloClass}>
              Região
              <select value={form.regiao_id} onChange={(e) => setForm({ ...form, regiao_id: e.target.value })} className={campoClass}>
                <option value="">Sem região</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>
            <label className={rotuloClass}>
              Renderização
              <select value={form.tipo_renderizacao} onChange={(e) => setForm({ ...form, tipo_renderizacao: e.target.value as "estatico" | "spa_js" })} className={campoClass}>
                <option value="estatico">Estático (RSS/HTML)</option>
                <option value="spa_js">SPA com JavaScript</option>
              </select>
            </label>
            {ehPref && (
              <label className={rotuloClass}>
                E-mail da assessoria de imprensa
                <input type="email" value={form.email_imprensa} onChange={(e) => setForm({ ...form, email_imprensa: e.target.value })}
                  className={campoClass} placeholder="imprensa@cidade.pr.gov.br" />
              </label>
            )}
            <div className="flex items-center gap-6 text-sm text-slate-700 md:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativa
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.protecao_antibot} onChange={(e) => setForm({ ...form, protecao_antibot: e.target.checked })} />
                Proteção antibot
              </label>
            </div>
            <details className="rounded-lg border border-slate-200 px-3 py-2 md:col-span-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">Avançado</summary>
              <label className={rotuloClass + " mt-3 max-w-xs"}>
                Frequência própria (horas)
                <input type="number" min={1} value={form.frequencia_horas} placeholder="Ciclos fixos"
                  onChange={(e) => setForm({ ...form, frequencia_horas: e.target.value })} className={campoClass} />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                A coleta agora roda em ciclos fixos. Deixe vazio; preencher tira a fonte dos ciclos e só faz sentido para fontes de curadoria.
              </p>
            </details>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button type="submit" disabled={busy} className={btn("primary")}>
                {busy ? "Salvando…" : editingId ? "Salvar alterações" : ehPref ? "Adicionar prefeitura" : "Adicionar fonte"}
              </button>
              <button type="button" onClick={resetForm} className={btn("ghost")}>Cancelar</button>
            </div>
          </form>
        </Section>
      )}

      {msg && <Aviso tipo={msg.startsWith("Falha") ? "erro" : "ok"}>{msg}</Aviso>}

      <FilterBar resumo={filtered ? `${filtered.length} de ${totalAba}` : undefined}>
        <label className={rotuloClass}>
          Buscar
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou URL" className={campoClass + " w-64"} />
        </label>
        <label className={rotuloClass}>
          Situação
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as "todas" | "ativas" | "inativas")} className={campoClass}>
            <option value="todas">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </label>
      </FilterBar>

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!items && !err && <p className="text-sm text-slate-500">Carregando…</p>}

      {filtered && filtered.length === 0 && (
        <EmptyState title={totalAba === 0 ? (ehPref ? "Nenhuma prefeitura cadastrada" : "Nenhuma fonte cadastrada") : "Nenhuma fonte encontrada"}>
          {totalAba === 0 ? "Use “" + (ehPref ? "Nova prefeitura" : "Nova fonte") + "” para cadastrar." : "Ajuste a busca ou a situação."}
        </EmptyState>
      )}

      {filtered && filtered.length > 0 && (
        <Section padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Fonte</th>
                  <th className={th}>Região</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Freq.</th>
                  <th className={th + " text-right"} title="Matérias + notas publicadas geradas desta fonte">Notícias</th>
                  <th className={th}>Última coleta</th>
                  {ehPref && <th className={th}>E-mail imprensa</th>}
                  <th className={th}>Status</th>
                  <th className={th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className={td}>
                      <button type="button" onClick={() => setFichaId(f.id)} className="block text-left font-semibold text-[#12201E] underline-offset-2 hover:underline" title="Abrir ficha da fonte">
                        {f.nome}
                      </button>
                      <a href={f.url_base} target="_blank" rel="noreferrer" className="break-all text-xs text-slate-500 hover:underline">{f.url_base}</a>
                    </td>
                    <td className={td + " text-xs text-slate-700"}>{f.regiao ? displayRegionName(f.regiao.slug, f.regiao.nome) : "—"}</td>
                    <td className={td + " text-xs text-slate-700"}>{f.tipo_renderizacao === "spa_js" ? "SPA" : "Estático"}{f.protecao_antibot ? " · antibot" : ""}</td>
                    <td className={td + " text-xs text-slate-700"}>{f.frequencia_horas == null ? "ciclos" : `${f.frequencia_horas}h`}</td>
                    <td className={td + " text-right"}>
                      {(() => {
                        const e = estat?.get(f.id);
                        if (!e) return <span className="text-xs text-slate-400">—</span>;
                        const total = e.materias_publicadas + e.notas_publicadas;
                        return (
                          <button type="button" onClick={() => setFichaId(f.id)} className="text-right" title={`${e.materias_publicadas} matérias · ${e.notas_publicadas} notas · ${e.coletadas} coletadas`}>
                            <div className="font-semibold tabular-nums text-[#12201E]">{total}</div>
                            <div className="text-[10px] tabular-nums text-slate-500">{e.coletadas} coletadas</div>
                          </button>
                        );
                      })()}
                    </td>
                    <td className={td + " text-xs text-slate-700"}>{f.ultimo_scrape_em ? new Date(f.ultimo_scrape_em).toLocaleString("pt-BR") : "nunca"}</td>
                    {ehPref && <td className={td + " text-xs text-slate-700"}>{f.email_imprensa ?? "—"}</td>}
                    <td className={td}>
                      <button type="button" onClick={() => toggleAtivo(f)} title={f.ativo ? "Clique para desativar" : "Clique para ativar"}>
                        <StatusPill status={f.ativo ? "ativa" : "inativa"} />
                      </button>
                    </td>
                    <td className={td + " whitespace-nowrap text-right"}>
                      <span className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => startEdit(f)} className={btn("ghost", "sm")}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
                        </button>
                        <ConfirmButton
                          onConfirm={() => remove(f)}
                          confirmLabel="Excluir fonte e coletas"
                          title="Apaga também os artigos brutos coletados desta fonte"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
                        </ConfirmButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {fichaId && <FichaFonte fonteId={fichaId} onClose={fecharFicha} />}
    </div>
  );
}
