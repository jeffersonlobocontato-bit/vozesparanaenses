import { useState, type FormEvent } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Section, btn, ConfirmButton, StatusPill, campoClass, rotuloClass, EmptyState } from "@/components/admin/ui";
import { type Advertiser, type Toast, tabelaClass, theadClass, thClass, trClass, tdClass } from "./tipos";

const VAZIO = { nome: "", cnpj: "", email: "", telefone: "", cidade: "", regiao_slug: "" };

export function Anunciantes({ advertisers, reload, onToast }: {
  advertisers: Advertiser[]; reload: () => void; onToast: Toast;
}) {
  const [form, setForm] = useState(VAZIO);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const sb = await getExternalBrowser();
    const { error } = await sb.from("advertisers").insert({
      nome: form.nome,
      cnpj: form.cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      cidade: form.cidade || null,
      regiao_slug: form.regiao_slug || null,
    });
    if (error) { onToast("Erro: " + error.message); return; }
    setForm(VAZIO);
    onToast("Anunciante criado."); reload();
  }

  async function toggle(a: Advertiser) {
    const sb = await getExternalBrowser();
    await sb.from("advertisers").update({ ativo: !a.ativo }).eq("id", a.id);
    reload();
  }

  return (
    <div className="space-y-4">
      <Section title="Novo anunciante">
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <label className={`${rotuloClass} md:col-span-2`}>
            Nome
            <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            CNPJ
            <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            E-mail
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Telefone
            <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Cidade
            <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className={campoClass} />
          </label>
          <label className={rotuloClass}>
            Região (slug)
            <input value={form.regiao_slug} onChange={(e) => setForm({ ...form, regiao_slug: e.target.value })} placeholder="ex.: curitiba" className={campoClass} />
          </label>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className={btn("primary")}>Criar anunciante</button>
          </div>
        </form>
      </Section>

      {advertisers.length === 0 ? (
        <EmptyState title="Nenhum anunciante cadastrado">Cadastre o primeiro no formulário acima.</EmptyState>
      ) : (
        <Section title="Anunciantes" subtitle={`${advertisers.length} cadastrado(s)`} padded={false}>
          <div className="overflow-x-auto">
            <table className={tabelaClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Nome</th>
                  <th className={thClass}>Cidade</th>
                  <th className={thClass}>Contato</th>
                  <th className={thClass}>Situação</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {advertisers.map((a) => (
                  <tr key={a.id} className={trClass}>
                    <td className={`${tdClass} font-semibold text-[#12201E]`}>{a.nome}</td>
                    <td className={`${tdClass} text-slate-600`}>
                      {a.cidade ?? "—"} {a.regiao_slug && <span className="text-xs text-slate-400">/{a.regiao_slug}</span>}
                    </td>
                    <td className={`${tdClass} text-xs text-slate-600`}>{a.email ?? "—"} · {a.telefone ?? "—"}</td>
                    <td className={tdClass}><StatusPill status={a.ativo ? "ativo" : "inativo"} /></td>
                    <td className={`${tdClass} text-right`}>
                      {a.ativo ? (
                        <ConfirmButton onConfirm={() => toggle(a)} variante="secondary" confirmLabel="Desativar">
                          Desativar
                        </ConfirmButton>
                      ) : (
                        <button type="button" onClick={() => toggle(a)} className={btn("secondary", "sm")}>Reativar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
