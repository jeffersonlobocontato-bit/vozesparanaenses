import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { type ResumoIA, type PeriodoIA, totalizarIA } from "@/lib/ia-custos";
import { Section, ErrorBanner, EmptyState } from "@/components/admin/ui";

const moeda = (n: number | null) => n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const etapas: Record<string, string> = { embedding_coleta: "Embeddings", agrupamento: "Agrupamento", crivo: "Crivo", fatos: "Fatos", redacao: "Redação", criticidade: "Criticidade", seo: "SEO", duplicidade: "Duplicidade", imagem_analise: "Análise de imagem", imagem_geracao: "Geração de imagem", nota_cidade: "Notas das cidades", instagram: "Instagram", coluna: "Coluna", imprensa: "Imprensa", chat: "Chat", outro: "Outros" };

export function CustosIA({ atualizacao }: { atualizacao: boolean }) {
  const [resumo, setResumo] = useState<ResumoIA | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const sb = await getExternalBrowser();
      const { data: sessao } = await sb.auth.getSession();
      if (!sessao.session) return;
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", sessao.session.user.id);
      if (!roles?.some(r => r.role === "admin")) return;
      if (ativo) { setAdmin(true); setErro(null); }
      const r = await sb.rpc("ia_custos_resumo");
      if (!ativo) return;
      if (r.error) setErro(/schema cache|does not exist|Could not find/i.test(r.error.message) ? "A medição de IA aguarda a aplicação da migração 099 no banco de conteúdo." : "Não foi possível carregar a medição de IA.");
      else setResumo(r.data as ResumoIA);
    })().catch(() => { if (ativo) setErro("Não foi possível carregar a medição de IA."); });
    return () => { ativo = false; };
  }, [atualizacao]);
  if (!admin) return null;
  return <Section title="Consumo medido de IA" subtitle="Tokens e imagens registrados nas chamadas · horário de Brasília · separado das estimativas abaixo.">
    {erro ? <ErrorBanner>{erro}</ErrorBanner> : !resumo ? <p className="text-sm text-muted-foreground">Carregando…</p> : <div className="grid gap-6 lg:grid-cols-2">
      <Periodo titulo="Ontem" periodo={resumo.ontem} />
      <Periodo titulo="Últimos 7 dias completos" periodo={resumo.sete_dias} />
    </div>}
    <p className="mt-4 text-xs text-muted-foreground">A medição começa após a ativação. Não inclui chamadas anteriores; valores sem uso informado não são tratados como zero. A fatura do serviço continua sendo a referência de cobrança.</p>
  </Section>;
}
function Periodo({ titulo, periodo }: { titulo: string; periodo: PeriodoIA }) {
  const total = totalizarIA(periodo);
  return <div className="min-w-0">
    <h3 className="mb-3 font-semibold text-foreground">{titulo}</h3>
    <dl className="mb-4 grid grid-cols-2 gap-4">
      <div><dt className="text-xs text-muted-foreground">Gasto registrado</dt><dd className="text-xl font-semibold tabular-nums">{moeda(total.custo)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Por matéria publicada</dt><dd className="text-xl font-semibold tabular-nums">{moeda(total.porMateria)}</dd></div>
    </dl>
    <p className="mb-3 text-xs text-muted-foreground">{Number(periodo.materias_publicadas).toLocaleString("pt-BR")} matérias publicadas · {total.chamadas.toLocaleString("pt-BR")} chamadas</p>
    {total.semCusto > 0 && <p className="mb-3 text-sm text-destructive">Total parcial: {total.semCusto} chamadas sem custo conhecido.</p>}
    {!periodo.etapas.length ? <EmptyState title="Nenhuma chamada registrada neste período." /> : <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-2 text-left">Etapa</th><th className="px-2 text-right">Chamadas</th><th className="px-2 text-right">Gasto</th><th className="py-2 text-right">Por matéria</th></tr></thead>
      <tbody>{[...periodo.etapas].sort((a,b) => Number(b.custo_brl) - Number(a.custo_brl)).map(e => <tr key={e.etapa} className="border-b border-border">
        <td className="py-2">{etapas[e.etapa] ?? e.etapa}{Number(e.falhas) > 0 && <span className="block text-xs text-muted-foreground">{e.falhas} falhas</span>}</td>
        <td className="px-2 text-right tabular-nums">{Number(e.chamadas).toLocaleString("pt-BR")}</td>
        <td className="px-2 text-right tabular-nums">{moeda(e.custo_brl == null ? null : Number(e.custo_brl))}</td>
        <td className="py-2 text-right tabular-nums">{moeda(e.custo_brl != null && periodo.materias_publicadas > 0 ? Number(e.custo_brl) / periodo.materias_publicadas : null)}</td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}