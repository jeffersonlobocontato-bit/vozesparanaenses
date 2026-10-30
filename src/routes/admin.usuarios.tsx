import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, ShieldCheck, PenLine, Eye } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { invokeImprensa } from "@/lib/imprensa-invoke";
import { PAPEIS, type Papel } from "@/lib/papeis";
import { PageHeader, Section, EmptyState, ErrorBanner, Aviso, ConfirmButton, btn, campoClass, rotuloClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsuarios,
});

type Membro = { user_id: string; email: string; nome: string; papeis: string[]; criado_em: string; ultimo_acesso: string | null };
type Criado = { ok: true; user_id: string; nova_conta: boolean; senha_temporaria: string | null; aviso: string };

const ICONE: Record<Papel, typeof Eye> = { admin: ShieldCheck, editor: PenLine, viewer: Eye };
const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");
const papelDe = (m: Membro): Papel => (m.papeis.includes("admin") ? "admin" : m.papeis.includes("editor") ? "editor" : "viewer");

function AdminUsuarios() {
  const [lista, setLista] = useState<Membro[]>([]);
  const [eu, setEu] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("viewer");
  const [salvando, setSalvando] = useState(false);
  const [criado, setCriado] = useState<(Criado & { email: string }) | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const sb = await getExternalBrowser();
      const [{ data: sess }, { data: rows, error }] = await Promise.all([sb.auth.getSession(), sb.rpc("equipe_listar")]);
      if (error) throw error;
      setEu(sess.session?.user.id ?? null);
      setLista((rows ?? []) as Membro[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a equipe.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCriado(null);
    setSalvando(true);
    try {
      const r = await invokeImprensa<Criado>("equipe-criar-usuario", { nome, email, papel });
      setCriado({ ...r, email: email.trim().toLowerCase() });
      setNome("");
      setEmail("");
      await carregar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível cadastrar." });
    } finally {
      setSalvando(false);
    }
  }

  async function trocarPapel(m: Membro, novo: Papel) {
    setMsg(null);
    const sb = await getExternalBrowser();
    const { error } = await sb.rpc("equipe_definir_papel", { p_user: m.user_id, p_papel: novo });
    if (error) { setMsg({ tipo: "erro", texto: `Não foi possível alterar: ${error.message}` }); return; }
    setMsg({ tipo: "ok", texto: `${m.nome || m.email} agora é ${PAPEIS[novo].rotulo}.` });
    await carregar();
  }

  async function remover(m: Membro) {
    setMsg(null);
    const sb = await getExternalBrowser();
    const { error } = await sb.rpc("equipe_remover", { p_user: m.user_id });
    if (error) { setMsg({ tipo: "erro", texto: `Não foi possível remover: ${error.message}` }); return; }
    setMsg({ tipo: "ok", texto: `${m.nome || m.email} não tem mais acesso ao painel.` });
    await carregar();
  }

  async function copiarAcesso() {
    if (!criado?.senha_temporaria) return;
    const txt = `Acesso ao painel Vozes Paranaenses\nEndereço: ${window.location.origin}/admin/login\nE-mail: ${criado.email}\nSenha temporária: ${criado.senha_temporaria}\nNo primeiro acesso, troque a senha em "Senha".`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem área de transferência */ }
  }

  const contagem = (p: Papel) => lista.filter((m) => papelDe(m) === p).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conta"
        title="Usuários"
        subtitle="Quem entra no painel e o que pode fazer. Só administradores veem esta página."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(PAPEIS) as Papel[]).map((p) => {
          const Icon = ICONE[p];
          return (
            <div key={p} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#12201E]"><Icon className="h-4 w-4" /> {PAPEIS[p].rotulo}</span>
                <span className="text-2xl font-bold tabular-nums text-[#12201E]">{contagem(p)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{PAPEIS[p].descricao}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Section title="Cadastrar usuário" subtitle="A pessoa recebe uma senha temporária e troca no primeiro acesso.">
          <form onSubmit={cadastrar} className="space-y-4">
            <label className={rotuloClass}>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} className={campoClass} autoComplete="off" /></label>
            <label className={rotuloClass}>E-mail<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campoClass} autoComplete="off" /></label>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-600">Acesso</legend>
              {(Object.keys(PAPEIS) as Papel[]).map((p) => (
                <label key={p} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${papel === p ? "border-[#12201E] ring-1 ring-[#12201E]" : "border-slate-200"}`}>
                  <input type="radio" name="papel" value={p} checked={papel === p} onChange={() => setPapel(p)} className="mt-0.5" />
                  <span><span className="font-semibold text-[#12201E]">{PAPEIS[p].rotulo}</span><span className="block text-xs text-slate-500">{PAPEIS[p].descricao}</span></span>
                </label>
              ))}
            </fieldset>
            <button type="submit" disabled={salvando} className={`${btn("primary")} w-full`}>{salvando ? "Cadastrando…" : "Cadastrar"}</button>
          </form>

          {criado && (
            <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-900">{criado.nova_conta ? "Usuário criado." : "Papel atualizado."}</p>
              {criado.senha_temporaria ? (
                <>
                  <p className="text-emerald-900">E-mail: <b>{criado.email}</b><br />Senha temporária: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{criado.senha_temporaria}</code></p>
                  <button type="button" onClick={copiarAcesso} className={btn("secondary", "sm")}><Copy className="h-3.5 w-3.5" /> {copiado ? "Copiado" : "Copiar dados de acesso"}</button>
                </>
              ) : null}
              <p className="text-xs text-emerald-800">{criado.aviso}</p>
            </div>
          )}
        </Section>

        <Section title={`Equipe (${lista.length})`} subtitle="Trocar o papel ou tirar o acesso vale no próximo carregamento do painel da pessoa. Você não altera o próprio acesso." padded={false}>
          {erro && <div className="p-4"><ErrorBanner>Não foi possível carregar: {erro}. Confira se a migração 097 foi aplicada.</ErrorBanner></div>}
          {msg && <div className="p-4 pb-0"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
          {carregando && !lista.length ? (
            <p className="p-5 text-sm text-slate-500">Carregando…</p>
          ) : !lista.length ? (
            !erro && <div className="p-4"><EmptyState title="Ninguém cadastrado ainda." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5">Pessoa</th><th className="px-4 py-2.5">Acesso</th><th className="px-4 py-2.5">Último acesso</th><th className="px-4 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((m) => {
                    const p = papelDe(m);
                    const souEu = m.user_id === eu;
                    return (
                      <tr key={m.user_id}>
                        <td className="px-4 py-2.5">
                          <span className="block font-semibold text-[#12201E]">{m.nome || "—"}{souEu && <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#B5651D]">você</span>}</span>
                          <span className="block text-xs text-slate-500">{m.email}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {souEu ? (
                            <span className="text-slate-700">{PAPEIS[p].rotulo}</span>
                          ) : (
                            <select value={p} onChange={(e) => void trocarPapel(m, e.target.value as Papel)} className={campoClass} aria-label={`Acesso de ${m.email}`}>
                              {(Object.keys(PAPEIS) as Papel[]).map((x) => <option key={x} value={x}>{PAPEIS[x].rotulo}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-600">{data(m.ultimo_acesso)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {!souEu && <ConfirmButton onConfirm={() => remover(m)} confirmLabel="Tirar acesso">Remover</ConfirmButton>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
