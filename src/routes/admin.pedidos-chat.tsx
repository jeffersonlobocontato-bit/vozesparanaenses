import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, refreshBtnClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/pedidos-chat")({
  component: AdminPedidosChat,
});

type Pedido = {
  id: string; descricao_produto: string; tipo_produto: string;
  regiao_slug: string | null; abrangencia: string | null; periodicidade: string | null;
  valor_total: number; nome_cliente: string | null; contato: string | null; origem: string;
  status: string; metodo_pagamento: string; criado_em: string;
};

function AdminPedidosChat() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("pedidos_chatbot")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setPedidos((data ?? []) as Pedido[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmarPagamento(id: string) {
    if (!confirm("Confirma que o Pix caiu na conta pra este pedido?")) return;
    setBusy(id);
    try {
      const sb = await getExternalBrowser();
      const { data: sess } = await sb.auth.getSession();
      const doze_horas = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      await sb.from("pedidos_chatbot").update({
        status: "pago",
        pago_em: new Date().toISOString(),
        anuncio_vinculado_ate: doze_horas,
        confirmado_por: sess.session?.user.id,
      }).eq("id", id);
    } finally {
      setBusy(null);
      load();
    }
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar este pedido?")) return;
    setBusy(id);
    const sb = await getExternalBrowser();
    await sb.from("pedidos_chatbot").update({ status: "cancelado" }).eq("id", id);
    setBusy(null);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chat de vendas"
        title="Pedidos (carrinho)"
        subtitle="Confirmação manual de Pix. Ao confirmar, monte a campanha correspondente em /admin/anuncios dentro de 12h."
        actions={<button onClick={load} className={refreshBtnClass()}>Atualizar</button>}
      />

      <p className="rounded border bg-amber-50 p-3 text-xs text-amber-900">
        Confirmar aqui só marca o pagamento — <strong>ainda não cria a campanha sozinho</strong>. Depois de
        confirmar, cadastre o anunciante/campanha/criativo em <code>/admin/anuncios</code> normalmente,
        usando os dados deste pedido.
      </p>

      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!pedidos && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {pedidos && pedidos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}

      <ul className="space-y-3">
        {pedidos?.map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.descricao_produto}</p>
                <p className="text-xs text-muted-foreground">
                  {p.nome_cliente ?? "—"} · {p.contato ?? "sem contato"} · R$ {p.valor_total.toFixed(2).replace(".", ",")}
                  {p.regiao_slug && ` · ${p.regiao_slug}`}
                  {p.abrangencia && ` · ${p.abrangencia}`}
                  {p.periodicidade && ` · ${p.periodicidade}`}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                p.status === "pago" ? "bg-emerald-100 text-emerald-800"
                : p.status === "cancelado" ? "bg-slate-200 text-slate-600"
                : "bg-amber-100 text-amber-800"
              }`}>
                {p.status.replace(/_/g, " ")}
              </span>
            </div>

            {p.status === "pendente_pagamento" && (
              <div className="mt-3 flex gap-2">
                <button disabled={busy === p.id} onClick={() => confirmarPagamento(p.id)}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  Confirmar Pix recebido
                </button>
                <button disabled={busy === p.id} onClick={() => cancelar(p.id)}
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  Cancelar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
