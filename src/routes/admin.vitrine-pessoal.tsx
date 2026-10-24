import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  PageHeader,
  Tabs,
  StatusPill,
  ConfirmButton,
  EmptyState,
  ErrorBanner,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/vitrine-pessoal")({
  component: AdminVitrinePessoal,
});

type Pedido = {
  id: string; token: string; nome_cliente: string; contato: string; profissao: string; valor: number;
  status: string; motivo_recusa: string | null; criado_em: string;
  imagens: Array<{ url: string; name: string; path: string }> | null;
  generated_article: { titulo: string; corpo: string; slug: string } | { titulo: string; corpo: string; slug: string }[] | null;
};

const ROTULO_STATUS: Record<string, string> = {
  entrevistando: "Em entrevista",
  gerando: "Gerando texto",
  aguardando_edicao: "Cliente editando",
  enviado_para_aprovacao: "Aguardando aprovação",
  erro: "Erro",
  aprovado: "Aprovado",
  recusado: "Recusado",
  pago: "Pago",
  publicado: "Publicado",
};

// Cor da etiqueta: reaproveita os tons do kit pelo significado.
const TOM_STATUS: Record<string, string> = {
  enviado_para_aprovacao: "pendente",
  aguardando_edicao: "aguardando",
  erro: "rejeitado",
};

function rotuloStatus(s: string) {
  return ROTULO_STATUS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function AdminVitrinePessoal() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("vitrine_pessoal_pedidos")
        .select("id, token, nome_cliente, contato, profissao, valor, status, motivo_recusa, criado_em, imagens, generated_article:generated_article_id(titulo, corpo, slug)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setPedidos((data ?? []) as unknown as Pedido[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function aprovar(id: string) {
    setBusy(id);
    const sb = await getExternalBrowser();
    const { error } = await sb.from("vitrine_pessoal_pedidos").update({ status: "aprovado", aprovado_em: new Date().toISOString() }).eq("id", id);
    if (error) setErr("Erro ao aprovar: " + error.message);
    setBusy(null);
    load();
  }

  async function recusar(id: string, motivoRecusa: string) {
    setBusy(id);
    const sb = await getExternalBrowser();
    const { error } = await sb.from("vitrine_pessoal_pedidos").update({ status: "recusado", motivo_recusa: motivoRecusa }).eq("id", id);
    if (error) setErr("Erro ao recusar: " + error.message);
    setBusy(null);
    setRecusandoId(null);
    setMotivo("");
    load();
  }

  async function confirmarPagamento(id: string) {
    setBusy(id);
    const sb = await getExternalBrowser();
    const { error } = await sb.from("vitrine_pessoal_pedidos").update({
      status: "pago", pago_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) setErr("Erro ao confirmar pagamento: " + error.message);
    setBusy(null);
    load();
  }

  const statusPresentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pedidos ?? []) m.set(p.status, (m.get(p.status) ?? 0) + 1);
    return Array.from(m.entries());
  }, [pedidos]);

  const visiveis = useMemo(
    () => (pedidos ?? []).filter((p) => filtro === "todos" || p.status === filtro),
    [pedidos, filtro],
  );

  function waLink(p: Pedido, texto: string) {
    const digitos = (p.contato || "").replace(/\D/g, "");
    if (!digitos) return null;
    const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  function linkVitrine(p: Pedido) {
    return `${window.location.origin}/vitrine/${p.token}`;
  }

  function msgAprovado(p: Pedido) {
    return `Olá, ${p.nome_cliente}! Sua matéria da Vitrine Pessoal foi aprovada 🎉\n\n`
      + `Para publicarmos, falta apenas o pagamento de R$ ${p.valor.toFixed(2).replace(".", ",")} via Pix.\n\n`
      + `Os dados do Pix e o botão de publicação estão nesta página:\n${linkVitrine(p)}\n\n`
      + `Depois de pagar, é só nos avisar por aqui que confirmamos e liberamos a publicação.`;
  }

  function msgPago(p: Pedido) {
    return `Olá, ${p.nome_cliente}! Recebemos seu Pix, obrigado 🙌\n\n`
      + `Sua matéria já pode ser publicada. Basta clicar em "Publicar minha matéria" nesta página:\n${linkVitrine(p)}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vitrine Pessoal"
        title="Pedidos"
        subtitle="Aprovação de texto e confirmação manual de pagamento (R$ 199 por matéria, via Pix)."
        actions={<button type="button" onClick={load} className={btn("secondary")}>Atualizar</button>}
      />

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!pedidos && !err && <p className="text-sm text-slate-500">Carregando…</p>}

      {pedidos && pedidos.length > 0 && (
        <Tabs
          value={filtro}
          onChange={setFiltro}
          items={[
            { value: "todos", label: "Todos", count: pedidos.length },
            ...statusPresentes.map(([s, n]) => ({ value: s, label: rotuloStatus(s), count: n })),
          ]}
        />
      )}

      {pedidos && pedidos.length === 0 && <EmptyState title="Nenhum pedido ainda." />}
      {pedidos && pedidos.length > 0 && visiveis.length === 0 && <EmptyState title="Nenhum pedido com esse status." />}

      <ul className="space-y-3">
        {visiveis.map((p) => {
          const art = first(p.generated_article);
          return (
            <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#12201E]">{p.nome_cliente} <span className="font-normal text-slate-500">· {p.profissao}</span></p>
                  <p className="text-xs text-slate-500">
                    {p.contato} · R$ {p.valor.toFixed(2).replace(".", ",")} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <StatusPill status={TOM_STATUS[p.status] ?? p.status} label={rotuloStatus(p.status)} />
              </div>

              {art && (
                <div className="mt-3">
                  <button type="button" onClick={() => setExpandido(expandido === p.id ? null : p.id)} className="text-xs font-semibold text-[#B5651D] hover:underline">
                    {expandido === p.id ? "Ocultar texto" : `Ver texto: "${art.titulo}"`}
                  </button>
                  {expandido === p.id && (
                    <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">{art.corpo}</div>
                  )}
                </div>
              )}

              {p.status === "recusado" && p.motivo_recusa && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Motivo da recusa: {p.motivo_recusa}</p>
              )}

              {p.imagens && p.imagens.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-slate-600">Fotos enviadas ({p.imagens.length})</p>
                  <ul className="flex flex-wrap gap-2">
                    {p.imagens.map((f, i) => (
                      <li key={f.path} className="relative">
                        <a href={f.url} target="_blank" rel="noreferrer">
                          <img src={f.url} alt={f.name} className="h-16 w-16 rounded border border-slate-200 object-cover" />
                        </a>
                        {i === 0 && (
                          <span className="absolute left-0 top-0 rounded bg-[#12201E] px-1 py-0.5 text-[9px] font-bold uppercase text-white">Capa</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.status === "enviado_para_aprovacao" && recusandoId !== p.id && (
                  <>
                    <ConfirmButton variante="success" confirmLabel="Confirmar aprovação" disabled={busy === p.id} onConfirm={() => aprovar(p.id)}>
                      Aprovar texto
                    </ConfirmButton>
                    <button type="button" disabled={busy === p.id} onClick={() => { setRecusandoId(p.id); setMotivo(""); }} className={btn("danger", "sm")}>
                      Recusar
                    </button>
                  </>
                )}
                {p.status === "enviado_para_aprovacao" && recusandoId === p.id && (
                  <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                    <label className={`${rotuloClass} min-w-0 flex-1`}>
                      Motivo da recusa (o cliente vai ver esta mensagem)
                      <input
                        autoFocus
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ex.: o texto cita um concorrente; ajuste e reenvie"
                        className={`${campoClass} w-full`}
                      />
                    </label>
                    <ConfirmButton
                      confirmLabel="Confirmar recusa"
                      disabled={busy === p.id || !motivo.trim()}
                      onConfirm={() => recusar(p.id, motivo.trim())}
                    >
                      Recusar pedido
                    </ConfirmButton>
                    <button type="button" onClick={() => { setRecusandoId(null); setMotivo(""); }} className={btn("ghost", "sm")}>
                      Voltar
                    </button>
                  </div>
                )}
                {p.status === "aprovado" && (
                  <>
                    {waLink(p, msgAprovado(p)) && (
                      <a href={waLink(p, msgAprovado(p))!} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
                        Avisar cliente (WhatsApp)
                      </a>
                    )}
                    <ConfirmButton
                      variante="primary"
                      confirmLabel="Sim, o Pix caiu"
                      title="Libera o botão de publicar para o cliente"
                      disabled={busy === p.id}
                      onConfirm={() => confirmarPagamento(p.id)}
                    >
                      Confirmar Pix recebido
                    </ConfirmButton>
                    <span className="text-xs text-slate-500">Confirmar libera o botão de publicar para o cliente.</span>
                  </>
                )}
                {p.status === "pago" && waLink(p, msgPago(p)) && (
                  <a href={waLink(p, msgPago(p))!} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
                    Avisar cliente (WhatsApp)
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
