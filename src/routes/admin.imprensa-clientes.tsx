import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { invokeImprensa } from "@/lib/imprensa-invoke";
import { PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/imprensa-clientes")({
  component: AdminImprensaClientes,
});

type Cliente = {
  id: string;
  nome_empresa: string;
  nome_contato: string;
  email: string;
  slug: string;
  ativo: boolean;
  criado_em: string;
};

function AdminImprensaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ultimaSenha, setUltimaSenha] = useState<{ email: string; senha: string; link: string } | null>(null);

  const load = useCallback(async () => {
    setCarregando(true);
    const sb = await getExternalBrowser();
    const { data } = await sb
      .from("clientes_imprensa")
      .select("id, nome_empresa, nome_contato, email, slug, ativo, criado_em")
      .order("criado_em", { ascending: false });
    setClientes((data ?? []) as Cliente[]);
    setCarregando(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function criarCliente() {
    if (!nomeEmpresa.trim() || !nomeContato.trim() || !email.trim()) {
      setMsg("Preencha empresa, contato e e-mail.");
      return;
    }
    setCriando(true);
    setMsg(null);
    setUltimaSenha(null);
    try {
      const res = await invokeImprensa<{ ok: true; cliente: Cliente; senha_temporaria: string; link_acesso: string }>(
        "imprensa-criar-cliente",
        {
          nome_empresa: nomeEmpresa.trim(),
          nome_contato: nomeContato.trim(),
          email: email.trim(),
          slug: slug.trim() || undefined,
        },
      );
      setUltimaSenha({ email: res.cliente.email, senha: res.senha_temporaria, link: res.link_acesso });
      setNomeEmpresa("");
      setNomeContato("");
      setEmail("");
      setSlug("");
      await load();
    } catch (e: unknown) {
      const detail = (e as { context?: { body?: { detail?: string; error?: string } } })?.context?.body;
      setMsg(detail?.detail ?? detail?.error ?? (e instanceof Error ? e.message : "Erro ao criar cliente."));
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portal da Imprensa"
        title="Clientes"
        subtitle="Crie o acesso de login de cada assessoria/empresa. O cliente usa e-mail e senha pra entrar no próprio chat de geração de conteúdo."
      />

      {ultimaSenha && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-emerald-900">Acesso criado — repasse por canal seguro, só aparece agora:</p>
          <p className="mt-1 text-emerald-800">
            E-mail: <strong>{ultimaSenha.email}</strong><br />
            Senha temporária: <strong className="font-mono">{ultimaSenha.senha}</strong><br />
            Link de acesso: <strong>{ultimaSenha.link}</strong>
          </p>
        </div>
      )}

      {msg && <p className="rounded border bg-red-50 p-2 text-xs text-red-700">{msg}</p>}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nome da empresa</span>
          <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nome do contato</span>
          <input value={nomeContato} onChange={(e) => setNomeContato(e.target.value)} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">E-mail (login)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Slug customizado (opcional — gerado do nome se vazio)</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex.: fiep, prefeitura-cascavel" className="w-full rounded border px-3 py-2" />
        </label>
        <div className="sm:col-span-2">
          <button onClick={criarCliente} disabled={criando} className="rounded bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {criando ? "Criando…" : "Criar acesso do cliente"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold">Clientes cadastrados ({clientes.length})</p>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-2">
            {clientes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{c.nome_empresa} — {c.nome_contato}</p>
                  <p className="text-xs text-muted-foreground">{c.email} · /imprensa/{c.slug}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${c.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {c.ativo ? "ativo" : "inativo"}
                </span>
              </div>
            ))}
            {clientes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
