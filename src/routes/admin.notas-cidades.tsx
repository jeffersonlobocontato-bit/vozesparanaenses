import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader } from "@/components/admin/ui";

// Fila das notas das colunas "Vozes {Cidade}". O pipeline publica sozinho
// o que o agente de criticidade considera de risco baixo; o resto para aqui
// esperando aprovação humana.
export const Route = createFileRoute("/admin/notas-cidades")({
  component: AdminNotasCidades,
});

type Status = "revisao" | "publicado" | "rejeitado";

type NotaFila = {
  id: string;
  cidade_slug: string;
  titulo: string;
  corpo: string;
  fonte_nome: string | null;
  fonte_url: string | null;
  tema_crivo: string | null;
  status: Status;
  criticidade_nivel: string | null;
  criticidade_motivos: string[] | null;
  criado_em: string;
  publicado_em: string | null;
  coluna: { nome: string } | null;
};

const ABAS: Array<{ status: Status; label: string }> = [
  { status: "revisao", label: "Em revisão" },
  { status: "publicado", label: "Publicadas" },
  { status: "rejeitado", label: "Rejeitadas" },
];

function AdminNotasCidades() {
  const [aba, setAba] = useState<Status>("revisao");
  const [itens, setItens] = useState<NotaFila[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setItens(null);
    setErro(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("coluna_cidade_notas")
        .select("id, cidade_slug, titulo, corpo, fonte_nome, fonte_url, tema_crivo, status, criticidade_nivel, criticidade_motivos, criado_em, publicado_em, coluna:colunas(nome)")
        .eq("status", aba)
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      setItens((data ?? []) as unknown as NotaFila[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar (a migration 067 já foi aplicada?)");
    }
  }, [aba]);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(id: string, status: Status) {
    setOcupado(id);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb
        .from("coluna_cidade_notas")
        .update({
          status,
          atualizado_em: new Date().toISOString(),
          ...(status === "publicado" ? { publicado_em: new Date().toISOString() } : {}),
        })
        .eq("id", id);
      if (error) throw error;
      setItens((atual) => (atual ?? []).filter((n) => n.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colunas"
        title="Notas das cidades"
        subtitle="Releases de prefeitura que viram nota nas colunas regionais “Vozes {Região}”. As de risco baixo saem sozinhas; as que o agente de criticidade segurou esperam aqui."
      />
      <div className="flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a.status}
            type="button"
            onClick={() => setAba(a.status)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${aba === a.status ? "border-[#12201E] bg-[#12201E] text-white" : "border-slate-200 bg-white text-slate-700"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {erro && <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{erro}</p>}
      {itens === null && !erro && <p className="text-sm text-slate-500">Carregando…</p>}
      {itens?.length === 0 && <p className="text-sm text-slate-500">Nada aqui.</p>}
      <ul className="space-y-4">
        {itens?.map((n) => (
          <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="text-[#12201E]">{n.coluna?.nome ?? "Coluna"}</span>
              {n.cidade_slug && <span>· {n.cidade_slug.replace(/-/g, " ")}</span>}
              {n.tema_crivo && <span>· {n.tema_crivo.replace("_", " ")}</span>}
              <span>· {new Date(n.criado_em).toLocaleString("pt-BR")}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{n.titulo}</h2>
            <p className="mt-1 text-sm text-slate-700">{n.corpo}</p>
            {n.fonte_nome && (
              <p className="mt-1 text-xs text-slate-500">
                Fonte: {n.fonte_url ? <a className="underline" href={n.fonte_url} target="_blank" rel="noopener noreferrer">{n.fonte_nome}</a> : n.fonte_nome}
              </p>
            )}
            {n.criticidade_nivel && n.criticidade_nivel !== "baixo" && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-bold uppercase">Criticidade {n.criticidade_nivel}</span>
                {n.criticidade_motivos?.length ? (
                  <ul className="mt-1 list-disc pl-4">{n.criticidade_motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
                ) : null}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {n.status !== "publicado" && (
                <button type="button" disabled={ocupado === n.id} onClick={() => mudarStatus(n.id, "publicado")}
                  className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  Publicar
                </button>
              )}
              {n.status !== "rejeitado" && (
                <button type="button" disabled={ocupado === n.id} onClick={() => mudarStatus(n.id, "rejeitado")}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">
                  {n.status === "publicado" ? "Despublicar" : "Rejeitar"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
