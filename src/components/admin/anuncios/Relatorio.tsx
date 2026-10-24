import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Section, btn, EmptyState, ErrorBanner } from "@/components/admin/ui";
import { type Campaign, type Creative, type Sb, tabelaClass, theadClass, thClass, trClass, tdClass } from "./tipos";

type Metric = { creative_id: string; impressoes: number; cliques: number };

// Quantas contagens rodam em paralelo (cada criativo faz 2: impressões e cliques).
const LOTE = 8;

/**
 * Conta exata no servidor (`count: "exact", head: true`): não baixa linha
 * nenhuma, então não sofre o corte de 1000 linhas do PostgREST que fazia o
 * relatório antigo subcontar em silêncio.
 */
async function contar(sb: Sb, tabela: "ad_impressions" | "ad_clicks", creativeId?: string): Promise<number> {
  let q = sb.from(tabela).select("id", { count: "exact", head: true });
  if (creativeId) q = q.eq("creative_id", creativeId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-[#12201E]">{valor}</p>
    </div>
  );
}

const fmt = new Intl.NumberFormat("pt-BR");

export function Relatorio({ creatives, campaigns }: { creatives: Creative[]; campaigns: Campaign[] }) {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [totais, setTotais] = useState<{ imp: number; clk: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setMetrics(null);
    try {
      const sb = await getExternalBrowser();
      const [imp, clk] = await Promise.all([contar(sb, "ad_impressions"), contar(sb, "ad_clicks")]);
      setTotais({ imp, clk });

      const res: Metric[] = [];
      for (let i = 0; i < creatives.length; i += LOTE) {
        const lote = creatives.slice(i, i + LOTE);
        const parte = await Promise.all(lote.map(async (cr) => {
          const [impressoes, cliques] = await Promise.all([
            contar(sb, "ad_impressions", cr.id),
            contar(sb, "ad_clicks", cr.id),
          ]);
          return { creative_id: cr.id, impressoes, cliques };
        }));
        res.push(...parte);
      }
      // Como antes: só aparecem no detalhamento criativos com alguma métrica.
      setMetrics(res.filter((m) => m.impressoes > 0 || m.cliques > 0));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o relatório.");
    }
  }, [creatives]);

  useEffect(() => { carregar(); }, [carregar]);

  const rows = (metrics ?? [])
    .map((m) => {
      const cr = creatives.find((c) => c.id === m.creative_id);
      const camp = cr ? campaigns.find((c) => c.id === cr.campaign_id) : undefined;
      const ctr = m.impressoes ? (m.cliques / m.impressoes) * 100 : 0;
      return { ...m, cr, camp, ctr };
    })
    .sort((a, b) => b.impressoes - a.impressoes);

  const totalImp = totais?.imp ?? 0;
  const totalClk = totais?.clk ?? 0;
  const ctrTotal = totalImp ? ((totalClk / totalImp) * 100).toFixed(2).replace(".", ",") : "0,00";

  return (
    <div className="space-y-4">
      {erro && <ErrorBanner>{erro}</ErrorBanner>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi rotulo="Impressões" valor={totais ? fmt.format(totalImp) : "…"} />
        <Kpi rotulo="Cliques" valor={totais ? fmt.format(totalClk) : "…"} />
        <Kpi rotulo="Taxa de clique (CTR)" valor={totais ? `${ctrTotal}%` : "…"} />
      </div>

      <Section
        title="Desempenho por criativo"
        subtitle="Desde o início da veiculação."
        aside={<button type="button" onClick={carregar} className={btn("secondary", "sm")}>Recontar</button>}
        padded={false}
      >
        {metrics === null && !erro ? (
          <p className="px-5 py-6 text-sm text-slate-500">Contando impressões e cliques…</p>
        ) : rows.length === 0 ? (
          <div className="p-5"><EmptyState title="Sem métricas ainda">Nenhum criativo foi exibido até agora.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tabelaClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Criativo</th>
                  <th className={thClass}>Campanha</th>
                  <th className={`${thClass} text-right`}>Impressões</th>
                  <th className={`${thClass} text-right`}>Cliques</th>
                  <th className={`${thClass} text-right`}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.creative_id} className={trClass}>
                    <td className={`${tdClass} max-w-md truncate font-semibold text-[#12201E]`}>{r.cr?.headline ?? r.creative_id}</td>
                    <td className={`${tdClass} text-slate-600`}>{r.camp?.nome ?? "—"}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{fmt.format(r.impressoes)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{fmt.format(r.cliques)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.ctr.toFixed(2).replace(".", ",")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
