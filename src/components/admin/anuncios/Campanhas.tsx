import { useEffect, useState, type FormEvent } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Section, btn, ConfirmButton, StatusPill, campoClass, rotuloClass, EmptyState } from "@/components/admin/ui";
import {
  type Advertiser, type Campaign, type CampaignStatus, type Toast,
  EDITORIAS_PADRAO, ROTULO_STATUS_CAMPANHA, listaDeSlugs, dataBR,
  tabelaClass, theadClass, thClass, trClass, tdClass,
} from "./tipos";

type Editoria = { slug: string; nome: string };

/** Lê as editorias de `editorial_categories`; se falhar, usa a lista fixa. */
function useEditorias(): Editoria[] {
  const [editorias, setEditorias] = useState<Editoria[]>(EDITORIAS_PADRAO);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const { data, error } = await sb.from("editorial_categories").select("slug, nome").order("nome");
        if (!error && data && data.length && vivo) setEditorias(data as Editoria[]);
      } catch { /* fica com a lista fixa */ }
    })();
    return () => { vivo = false; };
  }, []);
  return editorias;
}

/** Campo de editorias: texto com slugs separados por vírgula + atalhos clicáveis. */
function CampoEditorias({ value, onChange, editorias, compacto }: {
  value: string; onChange: (v: string) => void; editorias: Editoria[]; compacto?: boolean;
}) {
  const escolhidos = listaDeSlugs(value);
  const validos = new Set(editorias.map((e) => e.slug));
  const invalidos = escolhidos.filter((s) => !validos.has(s));
  function alternar(slug: string) {
    const nova = escolhidos.includes(slug) ? escolhidos.filter((s) => s !== slug) : [...escolhidos, slug];
    onChange(nova.join(", "));
  }
  return (
    <div className="space-y-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Vazio = todas as editorias" className={`${campoClass} w-full`} />
      <div className="flex flex-wrap gap-1">
        {editorias.map((e) => {
          const ativo = escolhidos.includes(e.slug);
          return (
            <button
              key={e.slug}
              type="button"
              onClick={() => alternar(e.slug)}
              aria-pressed={ativo}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                ativo ? "border-[#12201E] bg-[#12201E] text-white" : "border-slate-300 bg-white text-slate-600 hover:border-[#12201E] hover:text-[#12201E]"
              }`}
            >
              {compacto ? e.slug : e.nome}
            </button>
          );
        })}
      </div>
      {invalidos.length > 0 && (
        <p className="text-[11px] font-semibold text-red-700">
          Editoria inexistente: {invalidos.join(", ")}. O anúncio não vai aparecer nessas páginas.
        </p>
      )}
    </div>
  );
}

export function Campanhas({ campaigns, advertisers, reload, onToast }: {
  campaigns: Campaign[]; advertisers: Advertiser[]; reload: () => void; onToast: Toast;
}) {
  const editorias = useEditorias();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    advertiser_id: "", nome: "", data_inicio: today, data_fim: in30, editorias: "", observacoes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    advertiser_id: "", nome: "", data_inicio: "", data_fim: "", editorias: "", observacoes: "",
  });

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    setEdit({
      advertiser_id: c.advertiser_id,
      nome: c.nome,
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      editorias: (c.editorias ?? []).join(", "),
      observacoes: c.observacoes ?? "",
    });
  }

  async function saveEdit(c: Campaign) {
    if (!edit.nome.trim() || !edit.advertiser_id) return onToast("Preencha anunciante e nome.");
    const sb = await getExternalBrowser();
    const { error } = await sb.from("ad_campaigns").update({
      advertiser_id: edit.advertiser_id,
      nome: edit.nome.trim(),
      data_inicio: edit.data_inicio,
      data_fim: edit.data_fim,
      editorias: listaDeSlugs(edit.editorias),
      observacoes: edit.observacoes || null,
    }).eq("id", c.id);
    if (error) return onToast("Erro: " + error.message);
    setEditingId(null);
    onToast("Campanha atualizada.");
    reload();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.advertiser_id) return onToast("Selecione um anunciante.");
    const sb = await getExternalBrowser();
    const { error } = await sb.from("ad_campaigns").insert({
      advertiser_id: form.advertiser_id,
      nome: form.nome,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      editorias: listaDeSlugs(form.editorias),
      observacoes: form.observacoes || null,
    });
    if (error) return onToast("Erro: " + error.message);
    onToast("Campanha criada."); reload();
    setForm({ ...form, nome: "", editorias: "", observacoes: "" });
  }

  async function updateStatus(c: Campaign, status: CampaignStatus) {
    const sb = await getExternalBrowser();
    await sb.from("ad_campaigns").update({ status }).eq("id", c.id);
    reload();
  }

  async function remove(c: Campaign) {
    const sb = await getExternalBrowser();
    await sb.from("ad_campaigns").delete().eq("id", c.id);
    reload();
  }

  const nomeEditoria = (slug: string) => editorias.find((e) => e.slug === slug)?.nome ?? slug;

  return (
    <div className="space-y-4">
      <Section title="Nova campanha">
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className={`${rotuloClass} md:col-span-2`}>
            Anunciante
            <select required value={form.advertiser_id} onChange={(e) => setForm({ ...form, advertiser_id: e.target.value })} className={campoClass}>
              <option value="">Selecione…</option>
              {advertisers.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
          <label className={`${rotuloClass} md:col-span-2`}>
            Nome da campanha
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Início
            <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Fim
            <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} className={campoClass} />
          </label>
          <label className={`${rotuloClass} md:col-span-2`}>
            Observações
            <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className={campoClass} />
          </label>
          <div className={`${rotuloClass} md:col-span-4`}>
            Editorias
            <span className="font-normal text-slate-500">
              Deixe vazio para o anúncio aparecer em qualquer página. Clique numa editoria para incluir ou tirar.
            </span>
            <CampoEditorias value={form.editorias} onChange={(v) => setForm({ ...form, editorias: v })} editorias={editorias} />
          </div>
          <div className="md:col-span-4">
            <button type="submit" className={btn("primary")}>Criar campanha</button>
          </div>
        </form>
      </Section>

      {campaigns.length === 0 ? (
        <EmptyState title="Nenhuma campanha ainda">Crie a primeira no formulário acima.</EmptyState>
      ) : (
        <Section title="Campanhas" subtitle={`${campaigns.length} campanha(s)`} padded={false}>
          <div className="overflow-x-auto">
            <table className={tabelaClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Campanha</th>
                  <th className={thClass}>Anunciante</th>
                  <th className={thClass}>Período</th>
                  <th className={thClass}>Editorias</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const adv = advertisers.find((a) => a.id === c.advertiser_id);
                  if (editingId === c.id) {
                    return (
                      <tr key={c.id} className={`${trClass} bg-slate-50`}>
                        <td className={tdClass}>
                          <input aria-label="Nome da campanha" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} className={`${campoClass} w-full`} />
                        </td>
                        <td className={tdClass}>
                          <select aria-label="Anunciante" value={edit.advertiser_id} onChange={(e) => setEdit({ ...edit, advertiser_id: e.target.value })} className={`${campoClass} w-full`}>
                            {advertisers.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-col gap-1">
                            <input aria-label="Início" type="date" value={edit.data_inicio} onChange={(e) => setEdit({ ...edit, data_inicio: e.target.value })} className={campoClass} />
                            <input aria-label="Fim" type="date" value={edit.data_fim} onChange={(e) => setEdit({ ...edit, data_fim: e.target.value })} className={campoClass} />
                          </div>
                        </td>
                        <td className={`${tdClass} min-w-[260px]`}>
                          <CampoEditorias value={edit.editorias} onChange={(v) => setEdit({ ...edit, editorias: v })} editorias={editorias} compacto />
                          <input aria-label="Observações" value={edit.observacoes} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })} placeholder="Observações" className={`${campoClass} mt-2 w-full`} />
                        </td>
                        <td className={tdClass}>
                          <StatusPill status={c.status} label={ROTULO_STATUS_CAMPANHA[c.status]} />
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => saveEdit(c)} className={btn("primary", "sm")}>Salvar</button>
                            <button type="button" onClick={() => setEditingId(null)} className={btn("ghost", "sm")}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id} className={trClass}>
                      <td className={`${tdClass} font-semibold text-[#12201E]`}>{c.nome}</td>
                      <td className={`${tdClass} text-slate-600`}>{adv?.nome ?? "—"}</td>
                      <td className={`${tdClass} whitespace-nowrap text-xs text-slate-600`}>{dataBR(c.data_inicio)} a {dataBR(c.data_fim)}</td>
                      <td className={`${tdClass} text-xs`}>
                        {c.editorias.length ? c.editorias.map(nomeEditoria).join(", ") : <span className="text-slate-400">Todas</span>}
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill status={c.status} label={ROTULO_STATUS_CAMPANHA[c.status]} />
                          <select
                            aria-label={`Mudar status de ${c.nome}`}
                            value={c.status}
                            onChange={(e) => updateStatus(c, e.target.value as CampaignStatus)}
                            className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:border-[#12201E] focus:outline-none"
                          >
                            {(Object.keys(ROTULO_STATUS_CAMPANHA) as CampaignStatus[]).map((s) => (
                              <option key={s} value={s}>{ROTULO_STATUS_CAMPANHA[s]}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => startEdit(c)} className={btn("secondary", "sm")}>Editar</button>
                          <ConfirmButton onConfirm={() => remove(c)} confirmLabel="Excluir com criativos e segmentação">
                            Excluir
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
