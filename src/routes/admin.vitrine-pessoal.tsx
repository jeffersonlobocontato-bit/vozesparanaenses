import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, refreshBtnClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/vitrine-pessoal")({
  component: AdminVitrinePessoal,
});

type Pedido = {
  id: string; token: string; nome_cliente: string; contato: string; profissao: string; valor: number;
  status: string; motivo_recusa: string | null; criado_em: string;
  imagens: Array<{ url: string; name: string; path: string }> | null;
  generated_article: { titulo: string; corpo: string; slug: string } | { titulo: string; corpo: string; slug: string }[] | null;
};

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function AdminVitrinePessoal() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
    await sb.from("vitrine_pessoal_pedidos").update({ status: "aprovado", aprovado_em: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    load();
  }

  async function recusar(id: string) {
    const motivo = prompt("Motivo da recusa (o cliente vai ver essa mensagem):");
    if (motivo === null) return;
    setBusy(id);
    const sb = await getExternalBrowser();
    await sb.from("vitrine_pessoal_pedidos").update({ status: "recusado", motivo_recusa: motivo }).eq("id", id);
    setBusy(null);
    load();
  }

  async function confirmarPagamento(id: string) {
    if (!confirm("Confirma que o Pix de R$ 199 caiu na conta? Isso libera o botão de publicar pro cliente.")) return;
    setBusy(id);
    const sb = await getExternalBrowser();
    await sb.from("vitrine_pessoal_pedidos").update({
      status: "pago", pago_em: new Date().toISOString(),
    }).eq("id", id);
    setBusy(null);
    load();
  }

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
        actions={<button onClick={load} className={refreshBtnClass()}>Atualizar</button>}
      />

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!pedidos && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {pedidos && pedidos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}

      <ul className="space-y-3">
        {pedidos?.map((p) => {
          const art = first(p.generated_article);
          return (
            <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.nome_cliente} — <span className="text-muted-foreground">{p.profissao}</span></p>
                  <p className="text-xs text-muted-foreground">{p.contato} · R$ {p.valor.toFixed(2).replace(".", ",")}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                  {p.status.replace(/_/g, " ")}
                </span>
              </div>

              {art && (
                <div className="mt-3">
                  <button onClick={() => setExpandido(expandido === p.id ? null : p.id)} className="text-xs font-semibold text-[#0066CC] hover:underline">
                    {expandido === p.id ? "Ocultar texto" : `Ver texto: "${art.titulo}"`}
                  </button>
                  {expandido === p.id && (
                    <div className="mt-2 max-h-64 overflow-y-auto rounded border bg-muted p-3 text-xs whitespace-pre-wrap">{art.corpo}</div>
                  )}
                </div>
              )}

              {p.status === "recusado" && p.motivo_recusa && (
                <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">Motivo da recusa: {p.motivo_recusa}</p>
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
                          <span className="absolute left-0 top-0 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold uppercase text-white">Capa</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                {p.status === "enviado_para_aprovacao" && (
                  <>
                    <button disabled={busy === p.id} onClick={() => aprovar(p.id)}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Aprovar texto</button>
                    <button disabled={busy === p.id} onClick={() => recusar(p.id)}
                      className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Recusar</button>
                  </>
                )}
                {p.status === "aprovado" && (
                  <>
                    {waLink(p, msgAprovado(p)) && (
                      <a href={waLink(p, msgAprovado(p))!} target="_blank" rel="noreferrer"
                        className="rounded bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95">
                        Avisar cliente (WhatsApp)
                      </a>
                    )}
                    <button disabled={busy === p.id} onClick={() => confirmarPagamento(p.id)}
                      className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                      Confirmar Pix recebido
                    </button>
                  </>
                )}
                {p.status === "pago" && waLink(p, msgPago(p)) && (
                  <a href={waLink(p, msgPago(p))!} target="_blank" rel="noreferrer"
                    className="rounded bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95">
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
