import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

export const Route = createFileRoute("/admin/fontes")({
  component: AdminFontes,
});

type Regiao = { id: string; slug: string; nome: string };
type Fonte = {
  id: string;
  nome: string;
  url_base: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  frequencia_horas: number;
  ativo: boolean;
  ultimo_scrape_em: string | null;
  regiao_id: string | null;
  regiao: { slug: string; nome: string } | null;
};

const empty: {
  nome: string;
  url_base: string;
  regiao_id: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  frequencia_horas: number;
  ativo: boolean;
} = {
  nome: "",
  url_base: "",
  regiao_id: "",
  tipo_renderizacao: "estatico",
  protecao_antibot: false,
  frequencia_horas: 6,
  ativo: true,
};

function AdminFontes() {
  const [items, setItems] = useState<Fonte[] | null>(null);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const [{ data: fontes, error: e1 }, { data: regs, error: e2 }] = await Promise.all([
        sb.from("fontes").select("id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ativo, ultimo_scrape_em, regiao_id, regiao:regioes(slug, nome)").order("nome"),
        sb.from("regioes").select("id, slug, nome").order("nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setItems((fontes ?? []) as unknown as Fonte[]);
      setRegioes((regs ?? []) as Regiao[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(f: Fonte) {
    setEditingId(f.id);
    setForm({
      nome: f.nome,
      url_base: f.url_base,
      regiao_id: f.regiao_id ?? "",
      tipo_renderizacao: f.tipo_renderizacao,
      protecao_antibot: f.protecao_antibot,
      frequencia_horas: f.frequencia_horas,
      ativo: f.ativo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() { setEditingId(null); setForm(empty); }

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
        frequencia_horas: Math.max(1, Number(form.frequencia_horas) || 6),
        ativo: form.ativo,
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
    if (!confirm(`Remover fonte "${f.nome}"? Isso apaga também os artigos brutos coletados dela.`)) return;
    const sb = await getExternalBrowser();
    const { error } = await sb.from("fontes").delete().eq("id", f.id);
    if (error) { alert(error.message); return; }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fontes monitoradas</h1>
        <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
      </div>

      <form onSubmit={save} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between">
          <h2 className="font-semibold">{editingId ? "Editar fonte" : "Nova fonte"}</h2>
          {editingId && <button type="button" onClick={resetForm} className="text-xs text-muted-foreground hover:underline">cancelar edição</button>}
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium">Nome</span>
          <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-full rounded border px-2 py-1.5" placeholder="Ex: Catve" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium">URL base (RSS ou home)</span>
          <input required type="url" value={form.url_base} onChange={(e) => setForm({ ...form, url_base: e.target.value })}
            className="w-full rounded border px-2 py-1.5" placeholder="https://catve.com/rss" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium">Região</span>
          <select value={form.regiao_id} onChange={(e) => setForm({ ...form, regiao_id: e.target.value })}
            className="w-full rounded border px-2 py-1.5">
            <option value="">— sem região —</option>
            {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium">Renderização</span>
          <select value={form.tipo_renderizacao} onChange={(e) => setForm({ ...form, tipo_renderizacao: e.target.value as "estatico" | "spa_js" })}
            className="w-full rounded border px-2 py-1.5">
            <option value="estatico">Estático (RSS/HTML)</option>
            <option value="spa_js">SPA com JS</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium">Frequência (horas)</span>
          <input type="number" min={1} value={form.frequencia_horas}
            onChange={(e) => setForm({ ...form, frequencia_horas: Number(e.target.value) })}
            className="w-full rounded border px-2 py-1.5" />
        </label>
        <div className="flex items-center gap-6 pt-4 md:pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.protecao_antibot} onChange={(e) => setForm({ ...form, protecao_antibot: e.target.checked })} />
            Proteção antibot
          </label>
        </div>
        <div className="md:col-span-2">
          <button disabled={busy} className="rounded bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
            {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar fonte"}
          </button>
          {msg && <span className="ml-3 text-xs text-muted-foreground">{msg}</span>}
        </div>
      </form>

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Fonte</th>
              <th className="px-3 py-2 text-left">Região</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Freq.</th>
              <th className="px-3 py-2 text-left">Último scrape</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items?.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{f.nome}</div>
                  <a href={f.url_base} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">{f.url_base}</a>
                </td>
                <td className="px-3 py-2 text-xs">{f.regiao ? displayRegionName(f.regiao.slug, f.regiao.nome) : "—"}</td>
                <td className="px-3 py-2 text-xs">{f.tipo_renderizacao === "spa_js" ? "SPA" : "Estático"}{f.protecao_antibot ? " · antibot" : ""}</td>
                <td className="px-3 py-2 text-xs">{f.frequencia_horas}h</td>
                <td className="px-3 py-2 text-xs">{f.ultimo_scrape_em ? new Date(f.ultimo_scrape_em).toLocaleString("pt-BR") : "nunca"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleAtivo(f)}
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${f.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                    {f.ativo ? "ativa" : "inativa"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => startEdit(f)} className="mr-2 text-xs text-[#0066CC] hover:underline">editar</button>
                  <button onClick={() => remove(f)} className="text-xs text-red-600 hover:underline">excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
