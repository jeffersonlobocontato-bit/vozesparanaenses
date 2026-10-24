import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  PageHeader,
  Tabs,
  FilterBar,
  StatusPill,
  ConfirmButton,
  EmptyState,
  ErrorBanner,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

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

const VAZIO: Record<Status, string> = {
  revisao: "Nenhuma nota esperando revisão.",
  publicado: "Nenhuma nota publicada.",
  rejeitado: "Nenhuma nota rejeitada.",
};

const ROTULO: Record<Status, string> = {
  revisao: "Em revisão",
  publicado: "Publicada",
  rejeitado: "Rejeitada",
};

function nomeCidade(slug: string) {
  return slug.replace(/-/g, " ");
}

function AdminNotasCidades() {
  const [aba, setAba] = useState<Status>("revisao");
  const [itens, setItens] = useState<NotaFila[] | null>(null);
  const [contagem, setContagem] = useState<Partial<Record<Status, number>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [cidade, setCidade] = useState("");

  const carregarContagem = useCallback(async () => {
    try {
      const sb = await getExternalBrowser();
      const res = await Promise.all(
        ABAS.map((a) =>
          sb.from("coluna_cidade_notas").select("id", { count: "exact", head: true }).eq("status", a.status),
        ),
      );
      const c: Partial<Record<Status, number>> = {};
      ABAS.forEach((a, i) => {
        if (!res[i].error && typeof res[i].count === "number") c[a.status] = res[i].count as number;
      });
      setContagem(c);
    } catch {
      // contagem é só informativa
    }
  }, []);

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
  useEffect(() => { carregarContagem(); }, [carregarContagem]);

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
      carregarContagem();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setOcupado(null);
    }
  }

  const filtradas = useMemo(() => {
    const q = cidade.trim().toLowerCase();
    if (!itens) return null;
    if (!q) return itens;
    return itens.filter((n) => nomeCidade(n.cidade_slug ?? "").toLowerCase().includes(q) || (n.cidade_slug ?? "").includes(q));
  }, [itens, cidade]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colunas"
        title="Notas das cidades"
        subtitle="Releases de prefeitura que viram nota nas colunas regionais “Vozes {Região}”. As de risco baixo saem sozinhas; as que o agente de criticidade segurou esperam aqui."
        actions={<button type="button" onClick={() => { carregar(); carregarContagem(); }} className={btn("secondary")}>Atualizar</button>}
      />

      <Tabs
        value={aba}
        onChange={setAba}
        items={ABAS.map((a) => ({ value: a.status, label: a.label, count: contagem[a.status] }))}
      />

      <FilterBar resumo={filtradas ? `${filtradas.length} de ${itens?.length ?? 0} notas carregadas` : undefined}>
        <label className={rotuloClass}>
          Cidade
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex.: Cascavel"
            className={`${campoClass} w-56`}
          />
        </label>
        {cidade && (
          <button type="button" onClick={() => setCidade("")} className={btn("ghost", "sm")}>Limpar</button>
        )}
      </FilterBar>

      {erro && <ErrorBanner>{erro}</ErrorBanner>}
      {itens === null && !erro && <p className="text-sm text-slate-500">Carregando…</p>}
      {filtradas?.length === 0 && (
        <EmptyState title={cidade ? "Nenhuma nota para essa cidade." : VAZIO[aba]}>
          {cidade ? "Confira a grafia ou limpe o filtro." : null}
        </EmptyState>
      )}

      <ul className="space-y-3">
        {filtradas?.map((n) => (
          <li key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusPill status={n.status} label={ROTULO[n.status]} />
              {n.cidade_slug && <span className="font-semibold capitalize text-[#12201E]">{nomeCidade(n.cidade_slug)}</span>}
              <span>· {n.coluna?.nome ?? "Coluna"}</span>
              {n.tema_crivo && <span>· {n.tema_crivo.replace("_", " ")}</span>}
              <span>· {new Date(n.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            <h2 className="mt-1.5 font-semibold leading-snug text-[#12201E]">{n.titulo}</h2>
            <p className="mt-1 text-sm text-slate-700">{n.corpo}</p>
            {n.fonte_nome && (
              <p className="mt-1 text-xs text-slate-500">
                Fonte: {n.fonte_url ? <a className="underline" href={n.fonte_url} target="_blank" rel="noopener noreferrer">{n.fonte_nome}</a> : n.fonte_nome}
              </p>
            )}
            {n.criticidade_nivel && n.criticidade_nivel !== "baixo" && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-bold uppercase">Criticidade {n.criticidade_nivel}</span>
                {n.criticidade_motivos?.length ? (
                  <ul className="mt-1 list-disc pl-4">{n.criticidade_motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
                ) : null}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {n.status !== "publicado" && (
                <ConfirmButton
                  variante="success"
                  confirmLabel="Confirmar publicação"
                  disabled={ocupado === n.id}
                  onConfirm={() => mudarStatus(n.id, "publicado")}
                >
                  Publicar
                </ConfirmButton>
              )}
              {n.status !== "rejeitado" && (
                <ConfirmButton
                  variante="danger"
                  confirmLabel={n.status === "publicado" ? "Confirmar: despublicar" : "Confirmar rejeição"}
                  disabled={ocupado === n.id}
                  onConfirm={() => mudarStatus(n.id, "rejeitado")}
                >
                  {n.status === "publicado" ? "Despublicar" : "Rejeitar"}
                </ConfirmButton>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
