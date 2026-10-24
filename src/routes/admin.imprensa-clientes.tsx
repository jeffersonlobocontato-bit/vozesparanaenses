import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { invokeImprensa } from "@/lib/imprensa-invoke";
import {
  PageHeader,
  Section,
  StatusPill,
  EmptyState,
  ErrorBanner,
  Aviso,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

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
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeContato, setNomeContato] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [criando, setCriando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ultimaSenha, setUltimaSenha] = useState<{ email: string; senha: string; link: string } | null>(null);

  const load = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("clientes_imprensa")
        .select("id, nome_empresa, nome_contato, email, slug, ativo, criado_em")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setClientes((data ?? []) as Cliente[]);
    } catch (e: unknown) {
      setErroLista(e instanceof Error ? e.message : "Erro ao carregar a lista de clientes.");
    } finally {
      setCarregando(false);
    }
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
    setCopiado(false);
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
      setFormAberto(false);
      await load();
    } catch (e: unknown) {
      const detail = (e as { context?: { body?: { detail?: string; error?: string } } })?.context?.body;
      setMsg(detail?.detail ?? detail?.error ?? (e instanceof Error ? e.message : "Erro ao criar cliente."));
    } finally {
      setCriando(false);
    }
  }

  async function copiarAcesso() {
    if (!ultimaSenha) return;
    const texto = `E-mail: ${ultimaSenha.email}\nSenha temporária: ${ultimaSenha.senha}\nLink de acesso: ${ultimaSenha.link}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setMsg("Não deu para copiar automaticamente. Selecione o texto e copie à mão.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portal da Imprensa"
        title="Clientes"
        subtitle="Crie o acesso de login de cada assessoria ou empresa. O cliente entra com e-mail e senha no próprio chat de geração de conteúdo."
        actions={
          !formAberto && (
            <button type="button" onClick={() => { setFormAberto(true); setMsg(null); }} className={btn("primary")}>
              Novo cliente
            </button>
          )
        }
      />

      {ultimaSenha && (
        <section className="rounded-2xl border border-[#E29F65] bg-[#E29F65]/10 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#12201E]">Acesso criado</h2>
              <p className="mt-0.5 text-xs text-slate-600">A senha só aparece agora. Repasse ao cliente por um canal seguro antes de sair desta página.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={copiarAcesso} className={btn("primary", "sm")}>
                {copiado ? "Copiado" : "Copiar dados de acesso"}
              </button>
              <button type="button" onClick={() => setUltimaSenha(null)} className={btn("ghost", "sm")}>Fechar</button>
            </div>
          </div>
          <dl className="mt-3 grid gap-1 text-sm text-[#12201E] sm:grid-cols-[160px_1fr]">
            <dt className="text-slate-500">E-mail</dt>
            <dd className="font-semibold">{ultimaSenha.email}</dd>
            <dt className="text-slate-500">Senha temporária</dt>
            <dd className="font-mono font-semibold">{ultimaSenha.senha}</dd>
            <dt className="text-slate-500">Link de acesso</dt>
            <dd className="break-all font-semibold">{ultimaSenha.link}</dd>
          </dl>
        </section>
      )}

      {msg && <Aviso tipo="erro">{msg}</Aviso>}

      {formAberto && (
        <Section
          title="Novo cliente"
          subtitle="O sistema gera uma senha temporária e mostra uma única vez."
          aside={<button type="button" onClick={() => setFormAberto(false)} className={btn("ghost", "sm")}>Cancelar</button>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotuloClass}>
              Nome da empresa
              <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} className={campoClass} />
            </label>
            <label className={rotuloClass}>
              Nome do contato
              <input value={nomeContato} onChange={(e) => setNomeContato(e.target.value)} className={campoClass} />
            </label>
            <label className={rotuloClass}>
              E-mail (login)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campoClass} />
            </label>
            <label className={rotuloClass}>
              Slug (opcional; se vazio, sai do nome da empresa)
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex.: fiep, prefeitura-cascavel" className={campoClass} />
            </label>
            <div className="sm:col-span-2">
              <button type="button" onClick={criarCliente} disabled={criando} className={btn("primary")}>
                {criando ? "Criando…" : "Criar acesso do cliente"}
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section
        title={`Clientes cadastrados (${clientes.length})`}
        aside={<button type="button" onClick={load} className={btn("ghost", "sm")}>Atualizar</button>}
      >
        {erroLista && <div className="mb-3"><ErrorBanner>Não foi possível carregar os clientes: {erroLista}</ErrorBanner></div>}
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : clientes.length === 0 ? (
          !erroLista && <EmptyState title="Nenhum cliente cadastrado ainda.">Use “Novo cliente” para criar o primeiro acesso.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-[#12201E]">{c.nome_empresa} <span className="font-normal text-slate-500">· {c.nome_contato}</span></p>
                  <p className="text-xs text-slate-500">{c.email} · /imprensa/{c.slug}</p>
                </div>
                <StatusPill status={c.ativo ? "ativo" : "inativo"} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
