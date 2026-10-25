import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { situacao, type Assinatura } from "@/lib/custos";
import {
  PageHeader,
  Section,
  StatCard,
  StatusPill,
  ConfirmButton,
  EmptyState,
  ErrorBanner,
  Aviso,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/custos")({
  component: AdminCustos,
});

// Custo VARIÁVEL (IA) estimado pelo que o pipeline fez × custo unitário
// (custos_parametros); custo FIXO = assinaturas rateadas por dia. Tudo vem da
// RPC custos_resumo() (migração 084).

type Item = { chave: string; descricao: string | null; quantidade: number; usd: number };
type Periodo = { variavel_usd: number; fixo_usd: number; total_usd: number; total_brl: number; cambio: number; dias: number; itens: Item[] };
type Resumo = {
  hoje: Periodo & { fixo_dia_usd: number };
  mes: Periodo;
  total: Periodo;
  inicio: string;
  dias_no_mes: number;
  dia_do_mes: number;
  serie_30d: { dia: string; total_brl: number }[];
};
type Parametro = { chave: string; valor: number; descricao: string; unidade: string };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const usd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

function AdminCustos() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Assinatura> | null>(null);
  const [mostrarParametros, setMostrarParametros] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const sb = await getExternalBrowser();
      const [r, a, p] = await Promise.all([
        sb.rpc("custos_resumo"),
        sb.from("assinaturas").select("*").order("nome"),
        sb.from("custos_parametros").select("chave, valor, descricao, unidade").order("chave"),
      ]);
      if (r.error) throw new Error(/custos_resumo|assinaturas|does not exist|schema cache/i.test(r.error.message)
        ? "A migração 084 (painel de custos) ainda não foi aplicada no banco."
        : r.error.message);
      setResumo(r.data as Resumo);
      setAssinaturas((a.data ?? []) as Assinatura[]);
      setParametros((p.data ?? []) as Parametro[]);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os custos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const alertas = useMemo(
    () => assinaturas.map((a) => ({ a, s: situacao(a) })).sort((x, y) => x.s.nivel - y.s.nivel || x.a.nome.localeCompare(y.a.nome)),
    [assinaturas],
  );
  const qtdAlertas = alertas.filter(({ s }) => s.nivel <= 2).length;

  async function salvarAssinatura() {
    if (!editando?.nome?.trim()) { setAviso("Informe o nome do serviço."); return; }
    const sb = await getExternalBrowser();
    const dados = {
      nome: editando.nome.trim(),
      fornecedor: editando.fornecedor?.trim() || null,
      finalidade: editando.finalidade?.trim() || null,
      valor: Number(editando.valor ?? 0),
      moeda: editando.moeda ?? "USD",
      periodicidade: editando.periodicidade ?? "mensal",
      vencimento: editando.vencimento || null,
      saldo: editando.saldo === null || editando.saldo === undefined || String(editando.saldo) === "" ? null : Number(editando.saldo),
      saldo_unidade: editando.saldo_unidade?.trim() || null,
      saldo_alerta: editando.saldo_alerta === null || editando.saldo_alerta === undefined || String(editando.saldo_alerta) === "" ? null : Number(editando.saldo_alerta),
      link: editando.link?.trim() || null,
      observacao: editando.observacao?.trim() || null,
      ativo: editando.ativo ?? true,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = editando.id
      ? await sb.from("assinaturas").update(dados).eq("id", editando.id)
      : await sb.from("assinaturas").insert(dados);
    if (error) { setAviso(error.message); return; }
    setEditando(null);
    setAviso("Salvo.");
    await carregar();
  }

  async function excluirAssinatura(id: string) {
    const sb = await getExternalBrowser();
    const { error } = await sb.from("assinaturas").delete().eq("id", id);
    if (error) setAviso(error.message);
    await carregar();
  }

  async function salvarParametro(chave: string, valor: number) {
    const sb = await getExternalBrowser();
    const { error } = await sb.from("custos_parametros").update({ valor, atualizado_em: new Date().toISOString() }).eq("chave", chave);
    if (error) setAviso(error.message);
    else { setAviso("Parâmetro atualizado."); await carregar(); }
  }

  const projecaoMes = resumo ? (resumo.mes.total_brl / Math.max(1, resumo.dia_do_mes)) * resumo.dias_no_mes : 0;
  const maxSerie = resumo ? Math.max(1, ...resumo.serie_30d.map((d) => d.total_brl)) : 1;
  const desde = resumo ? new Date(resumo.inicio).toLocaleDateString("pt-BR") : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Custos"
        subtitle="Estimativa de quanto o portal custa por dia, no mês e desde o início, com os alertas de saldo e vencimento que não podem passar despercebidos."
        actions={<button type="button" onClick={() => void carregar()} className={btn("secondary")}>Atualizar</button>}
      />

      {erro && <ErrorBanner>{erro}</ErrorBanner>}
      {aviso && <Aviso tipo={/salvo|atualizado/i.test(aviso) ? "ok" : "erro"}>{aviso}</Aviso>}
      {carregando && !resumo && <p className="text-sm text-slate-500">Carregando…</p>}

      {resumo && (
        <>
          {/* Indicadores */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Custo de hoje"
              value={brl(resumo.hoje.total_brl)}
              detalhe={`${usd(resumo.hoje.total_usd)} · IA ${usd(resumo.hoje.variavel_usd)} + fixo ${usd(resumo.hoje.fixo_usd)}`}
            />
            <StatCard
              label="Acumulado do mês"
              value={brl(resumo.mes.total_brl)}
              detalhe={`Projeção até o fim do mês: ${brl(projecaoMes)}`}
            />
            <StatCard
              label="Total acumulado"
              value={brl(resumo.total.total_brl)}
              detalhe={`Desde ${desde} · ${usd(resumo.total.total_usd)}`}
            />
          </div>

          {/* Últimos 30 dias */}
          <Section title="Últimos 30 dias" subtitle="Custo estimado por dia (IA + assinaturas rateadas).">
            <div className="flex h-36 items-end gap-1" role="img" aria-label="Custo por dia nos últimos 30 dias">
              {resumo.serie_30d.map((d) => (
                <div key={d.dia} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-[#12201E]/80 transition group-hover:bg-[#E29F65]"
                    style={{ height: `${Math.max(2, (d.total_brl / maxSerie) * 128)}px` }}
                  />
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#12201E] px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {brl(d.total_brl)}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Composição do mês */}
          <Section title="De onde vem o custo do mês" subtitle={`Câmbio usado: R$ ${resumo.mes.cambio.toLocaleString("pt-BR")} por dólar.`} padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-2">Item</th><th className="px-5 py-2 text-right">Quantidade</th><th className="px-5 py-2 text-right">US$</th><th className="px-5 py-2 text-right">R$</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...resumo.mes.itens].sort((a, b) => b.usd - a.usd).map((i) => (
                  <tr key={i.chave}>
                    <td className="px-5 py-2">{i.descricao ?? i.chave}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{i.quantidade.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{usd(i.usd)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{brl(i.usd * resumo.mes.cambio)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-5 py-2">Assinaturas (rateio do mês até hoje)</td>
                  <td className="px-5 py-2 text-right text-slate-400">—</td>
                  <td className="px-5 py-2 text-right tabular-nums">{usd(resumo.mes.fixo_usd)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{brl(resumo.mes.fixo_usd * resumo.mes.cambio)}</td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-5 py-2">Total</td>
                  <td />
                  <td className="px-5 py-2 text-right tabular-nums">{usd(resumo.mes.total_usd)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{brl(resumo.mes.total_brl)}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </>
      )}

      {/* Saldos e vencimentos */}
      {!erro && (
        <Section
          title={`Saldos e vencimentos${qtdAlertas ? ` · ${qtdAlertas} alerta${qtdAlertas === 1 ? "" : "s"}` : ""}`}
          subtitle="Mantenha saldo e vencimento atualizados: saldo de IA zerado ou assinatura vencida param o portal."
          aside={
            <button type="button" className={btn("primary", "sm")} onClick={() => setEditando({ moeda: "USD", periodicidade: "mensal", ativo: true })}>
              <Plus className="h-3.5 w-3.5" /> Nova assinatura
            </button>
          }
          padded={false}
        >
          {alertas.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhuma assinatura cadastrada." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-2">Situação</th>
                    <th className="px-5 py-2">Serviço</th>
                    <th className="px-5 py-2 text-right">Valor</th>
                    <th className="px-5 py-2">Vencimento / renovação</th>
                    <th className="px-5 py-2 text-right">Saldo</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.map(({ a, s }) => (
                    <tr key={a.id} className={s.nivel <= 1 ? "bg-red-50/60" : s.nivel === 2 ? "bg-amber-50/60" : ""}>
                      <td className="px-5 py-3"><StatusPill status={s.status} label={s.rotulo} /></td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-[#12201E]">
                          {a.link ? (
                            <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                              {a.nome} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : a.nome}
                        </p>
                        <p className="text-xs text-slate-500">{[a.finalidade, a.observacao].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {a.periodicidade === "uso" ? <span className="text-slate-500">por uso</span> : (
                          <>{a.moeda === "BRL" ? brl(a.valor) : usd(a.valor)}<span className="text-xs text-slate-500">/{a.periodicidade === "anual" ? "ano" : "mês"}</span></>
                        )}
                      </td>
                      <td className="px-5 py-3">{dataBR(a.vencimento)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {a.saldo == null ? "—" : `${a.saldo.toLocaleString("pt-BR")} ${a.saldo_unidade ?? ""}`}
                        {a.saldo_alerta != null && <span className="block text-[11px] text-slate-400">alerta ≤ {a.saldo_alerta.toLocaleString("pt-BR")}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" className={btn("secondary", "sm")} onClick={() => setEditando({ ...a })}>Atualizar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editando && (
            <div className="border-t border-slate-200 bg-slate-50 p-5">
              <p className="mb-3 text-sm font-bold text-[#12201E]">{editando.id ? `Atualizar: ${editando.nome}` : "Nova assinatura"}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className={rotuloClass}>Serviço
                  <input className={campoClass} value={editando.nome ?? ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                </label>
                <label className={rotuloClass}>Para quê
                  <input className={campoClass} value={editando.finalidade ?? ""} onChange={(e) => setEditando({ ...editando, finalidade: e.target.value })} />
                </label>
                <label className={rotuloClass}>Cobrança
                  <select className={campoClass} value={editando.periodicidade ?? "mensal"} onChange={(e) => setEditando({ ...editando, periodicidade: e.target.value as Assinatura["periodicidade"] })}>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                    <option value="uso">Por uso (saldo/créditos)</option>
                  </select>
                </label>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <label className={rotuloClass}>Valor
                    <input type="number" step="0.01" className={campoClass} value={editando.valor ?? 0} onChange={(e) => setEditando({ ...editando, valor: Number(e.target.value) })} />
                  </label>
                  <label className={rotuloClass}>Moeda
                    <select className={campoClass} value={editando.moeda ?? "USD"} onChange={(e) => setEditando({ ...editando, moeda: e.target.value as "USD" | "BRL" })}>
                      <option value="USD">US$</option>
                      <option value="BRL">R$</option>
                    </select>
                  </label>
                </div>
                <label className={rotuloClass}>Vencimento / próxima renovação
                  <input type="date" className={campoClass} value={editando.vencimento ?? ""} onChange={(e) => setEditando({ ...editando, vencimento: e.target.value || null })} />
                </label>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <label className={rotuloClass}>Saldo atual
                    <input type="number" step="0.01" className={campoClass} value={editando.saldo ?? ""} onChange={(e) => setEditando({ ...editando, saldo: e.target.value === "" ? null : Number(e.target.value) })} />
                  </label>
                  <label className={rotuloClass}>Unidade
                    <input className={campoClass} placeholder="US$, créditos" value={editando.saldo_unidade ?? ""} onChange={(e) => setEditando({ ...editando, saldo_unidade: e.target.value })} />
                  </label>
                </div>
                <label className={rotuloClass}>Avisar quando o saldo chegar a
                  <input type="number" step="0.01" className={campoClass} value={editando.saldo_alerta ?? ""} onChange={(e) => setEditando({ ...editando, saldo_alerta: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
                <label className={rotuloClass}>Link do painel do serviço
                  <input className={campoClass} value={editando.link ?? ""} onChange={(e) => setEditando({ ...editando, link: e.target.value })} />
                </label>
                <label className={`${rotuloClass} sm:col-span-2 lg:col-span-3`}>Observação
                  <input className={campoClass} value={editando.observacao ?? ""} onChange={(e) => setEditando({ ...editando, observacao: e.target.value })} />
                </label>
                <label className="flex items-center gap-2 self-end text-sm text-slate-600">
                  <input type="checkbox" checked={editando.ativo ?? true} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} /> Ativa
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" className={btn("primary")} onClick={() => void salvarAssinatura()}>Salvar</button>
                <button type="button" className={btn("ghost")} onClick={() => setEditando(null)}>Cancelar</button>
                {editando.id && (
                  <span className="ml-auto">
                    <ConfirmButton confirmLabel="Confirmar exclusão" onConfirm={() => { const id = editando.id!; setEditando(null); return excluirAssinatura(id); }}>
                      Excluir
                    </ConfirmButton>
                  </span>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Parâmetros */}
      {resumo && (
        <Section
          title="Como o custo é calculado"
          subtitle="Custos unitários estimados. Quando chegar a fatura real do Lovable AI, ajuste aqui para os números baterem."
          aside={<button type="button" className={btn("ghost", "sm")} onClick={() => setMostrarParametros((v) => !v)}>{mostrarParametros ? "Ocultar" : "Ajustar"}</button>}
        >
          {mostrarParametros ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {parametros.map((p) => (
                <ParametroCampo key={p.chave} p={p} onSalvar={salvarParametro} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              IA = atividades do pipeline × custo unitário (por matéria, ficha de fatos, imagem…). Assinaturas mensais e
              anuais entram rateadas por dia. Os valores são estimativas para acompanhar tendência e evitar surpresa; a
              cobrança oficial é a fatura de cada serviço.
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

function ParametroCampo({ p, onSalvar }: { p: Parametro; onSalvar: (chave: string, valor: number) => Promise<void> }) {
  const [valor, setValor] = useState(String(p.valor));
  const mudou = Number(valor) !== Number(p.valor);
  return (
    <label className={rotuloClass}>
      {p.descricao} ({p.unidade})
      <span className="flex gap-2">
        <input type="number" step="0.00001" className={`${campoClass} min-w-0 flex-1`} value={valor} onChange={(e) => setValor(e.target.value)} />
        <button type="button" disabled={!mudou} className={btn("secondary", "sm")} onClick={() => void onSalvar(p.chave, Number(valor))}>Salvar</button>
      </span>
    </label>
  );
}
