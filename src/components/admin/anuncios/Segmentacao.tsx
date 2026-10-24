import { useState, type FormEvent } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Section, btn, ConfirmButton, campoClass, rotuloClass, EmptyState } from "@/components/admin/ui";
import { type Campaign, type Target, type Toast, slugify, tabelaClass, theadClass, thClass, trClass, tdClass } from "./tipos";

const ROTULO_ESCOPO: Record<Target["escopo"], string> = {
  cidade: "Cidade",
  regiao: "Região",
  estado: "Estado (PR)",
};

export function Segmentacao({ targets, campaigns, reload, onToast }: {
  targets: Target[]; campaigns: Campaign[]; reload: () => void; onToast: Toast;
}) {
  const [form, setForm] = useState({
    campaign_id: "", escopo: "cidade" as Target["escopo"], valor: "", regiao_slug: "", cap: 500,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.campaign_id) return onToast("Selecione uma campanha.");
    if (form.escopo !== "estado" && !form.valor) return onToast("Preencha a cidade ou a região.");
    const sb = await getExternalBrowser();
    const valor = form.escopo === "cidade" ? slugify(form.valor)
      : form.escopo === "estado" ? "pr" : slugify(form.valor);
    const { error } = await sb.from("ad_targets").insert({
      campaign_id: form.campaign_id,
      escopo: form.escopo,
      valor,
      regiao_slug: form.regiao_slug || null,
      cap_impressoes_dia: form.cap,
    });
    if (error) return onToast("Erro: " + error.message);
    onToast("Segmentação adicionada.");
    setForm({ ...form, valor: "", regiao_slug: "" });
    reload();
  }

  async function remove(t: Target) {
    const sb = await getExternalBrowser();
    await sb.from("ad_targets").delete().eq("id", t.id);
    reload();
  }

  return (
    <div className="space-y-4">
      <Section title="Nova segmentação" subtitle="Onde a campanha aparece e quantas vezes por dia, no máximo, em cada local.">
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <label className={`${rotuloClass} md:col-span-2`}>
            Campanha
            <select required value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} className={campoClass}>
              <option value="">Selecione…</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className={rotuloClass}>
            Alcance
            <select value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value as Target["escopo"] })} className={campoClass}>
              {(Object.keys(ROTULO_ESCOPO) as Target["escopo"][]).map((k) => <option key={k} value={k}>{ROTULO_ESCOPO[k]}</option>)}
            </select>
          </label>
          <label className={rotuloClass}>
            {form.escopo === "regiao" ? "Região" : "Cidade"}
            <input
              disabled={form.escopo === "estado"}
              placeholder={form.escopo === "estado" ? "pr" : "Nome ou slug"}
              value={form.escopo === "estado" ? "pr" : form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className={`${campoClass} disabled:bg-slate-100`}
            />
          </label>
          <label className={rotuloClass}>
            Região da cidade (opcional)
            <input placeholder="slug" value={form.regiao_slug} onChange={(e) => setForm({ ...form, regiao_slug: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Limite de impressões por dia
            <input type="number" min={1} value={form.cap} onChange={(e) => setForm({ ...form, cap: Number(e.target.value) })} className={campoClass} />
          </label>
          <div className="flex items-end md:col-span-4">
            <button type="submit" className={btn("primary")}>Adicionar segmentação</button>
          </div>
        </form>
      </Section>

      {targets.length === 0 ? (
        <EmptyState title="Nenhuma segmentação configurada">
          Campanha sem segmentação não é veiculada. Adicione ao menos uma acima.
        </EmptyState>
      ) : (
        <Section title="Segmentações" subtitle={`${targets.length} regra(s)`} padded={false}>
          <div className="overflow-x-auto">
            <table className={tabelaClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Campanha</th>
                  <th className={thClass}>Alcance</th>
                  <th className={thClass}>Local</th>
                  <th className={thClass}>Região</th>
                  <th className={`${thClass} text-right`}>Limite/dia</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const camp = campaigns.find((c) => c.id === t.campaign_id);
                  return (
                    <tr key={t.id} className={trClass}>
                      <td className={`${tdClass} font-semibold text-[#12201E]`}>{camp?.nome ?? "—"}</td>
                      <td className={`${tdClass} text-xs`}>{ROTULO_ESCOPO[t.escopo] ?? t.escopo}</td>
                      <td className={tdClass}>{t.valor}</td>
                      <td className={`${tdClass} text-xs text-slate-500`}>{t.regiao_slug ?? "—"}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{t.cap_impressoes_dia}</td>
                      <td className={`${tdClass} text-right`}>
                        <ConfirmButton onConfirm={() => remove(t)} confirmLabel="Remover segmentação">Remover</ConfirmButton>
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
