import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  PageHeader,
  Section,
  btn,
  StatusPill,
  ErrorBanner,
  Aviso,
  Tabs,
  SaveBar,
  EmptyState,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/regioes")({
  component: AdminRegioes,
});

type Regiao = {
  id: string;
  slug: string;
  nome: string;
  cidade_principal: string;
  descricao: string | null;
  tema_config: { cor_primaria?: string; cor_destaque?: string; paleta?: { primaria?: string; acento?: string } } | null;
  ativa: boolean;
};
type Categoria = { id: string; slug: string; nome: string };
type Quota = { id?: string; regiao_id: string; categoria_id: string; piso_pct: number; teto_pct: number };

const TETO_PADRAO = 100;
const chave = (regiaoId: string, categoriaId: string) => `${regiaoId}:${categoriaId}`;

function AdminRegioes() {
  const [regs, setRegs] = useState<Regiao[] | null>(null);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [quotas, setQuotas] = useState<Record<string, Quota>>({});
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"cotas" | "tema">("cotas");

  const load = useCallback(async () => {
    setRegs(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const [r1, r2, r3] = await Promise.all([
        sb.from("regioes").select("id, slug, nome, cidade_principal, descricao, tema_config, ativa").order("nome"),
        sb.from("editorial_categories").select("id, slug, nome").order("nome"),
        sb.from("quota_rules").select("id, regiao_id, categoria_id, piso_pct, teto_pct"),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (r3.error) throw r3.error;
      setRegs((r1.data ?? []) as Regiao[]);
      setCats((r2.data ?? []) as Categoria[]);
      const porChave: Record<string, Quota> = {};
      for (const q of (r3.data ?? []) as Quota[]) porChave[chave(q.regiao_id, q.categoria_id)] = q;
      setQuotas(porChave);
      setRascunho({});
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tetoOriginal = useCallback(
    (k: string) => quotas[k]?.teto_pct ?? TETO_PADRAO,
    [quotas],
  );

  // Células alteradas: valor digitado diferente do que está no banco.
  const alteradas = useMemo(
    () =>
      Object.entries(rascunho).filter(([k, v]) => v.trim() !== "" && Number(v) !== tetoOriginal(k)),
    [rascunho, tetoOriginal],
  );

  async function saveTema(r: Regiao, primaria: string, destaque: string) {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("regioes").update({
        // O site lê tema_config.paleta (primária = cor oficial da região, fundo; acento = texto/filetes).
        tema_config: { ...(r.tema_config ?? {}), cor_primaria: undefined, cor_destaque: undefined, paleta: { ...(r.tema_config?.paleta ?? {}), primaria, acento: destaque } },
      }).eq("id", r.id);
      if (error) throw error;
      setMsg(`Tema de ${r.nome} salvo.`);
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  async function salvarCotas() {
    if (!alteradas.length) return;
    setMsg(null); setSalvando(true);
    try {
      const sb = await getExternalBrowser();
      const novas: Quota[] = [];
      for (const [k, v] of alteradas) {
        const teto = Math.max(0, Math.min(100, Number(v)));
        const existing = quotas[k];
        if (existing?.id) {
          // Piso não é usado pelo crivo; preservado como está.
          const { error } = await sb.from("quota_rules")
            .update({ piso_pct: existing.piso_pct, teto_pct: teto })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const [regiaoId, categoriaId] = k.split(":");
          novas.push({ regiao_id: regiaoId, categoria_id: categoriaId, piso_pct: 0, teto_pct: teto });
        }
      }
      if (novas.length) {
        const { error } = await sb.from("quota_rules").insert(novas);
        if (error) throw error;
      }
      setMsg(alteradas.length === 1 ? "1 cota salva." : `${alteradas.length} cotas salvas.`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setSalvando(false);
    }
  }

  const aviso = msg ? <Aviso tipo={msg.startsWith("Falha") ? "erro" : "ok"}>{msg}</Aviso> : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Regiões"
        title="Regiões e cotas"
        subtitle="Teto de publicação por editoria e cores de cada regional."
        actions={
          <button type="button" onClick={load} className={btn("secondary")}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
          </button>
        }
      />

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "cotas", label: "Cotas", count: alteradas.length || undefined },
          { value: "tema", label: "Tema visual" },
        ]}
      />

      {err && <ErrorBanner>{err}</ErrorBanner>}
      {!regs && !err && <p className="text-sm text-slate-500">Carregando…</p>}
      {regs && regs.length === 0 && <EmptyState title="Nenhuma região cadastrada" />}

      {regs && regs.length > 0 && aba === "cotas" && (
        <>
          <Section
            title="Teto por editoria"
            subtitle="% máximo das matérias da região em 7 dias."
            padded={false}
          >
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-600">
              Acima do teto, a pauta vira nota na coluna da cidade; serviço, saúde, educação e segurança nunca são rebaixados.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-[1] bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Região
                    </th>
                    {cats.map((c) => (
                      <th key={c.id} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {c.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regs.map((r) => (
                    <tr key={r.id}>
                      <td className="sticky left-0 z-[1] whitespace-nowrap bg-white px-4 py-2 font-semibold text-[#12201E]">
                        {r.nome}
                      </td>
                      {cats.map((c) => {
                        const k = chave(r.id, c.id);
                        const valor = rascunho[k] ?? String(tetoOriginal(k));
                        const mudou = rascunho[k] !== undefined && rascunho[k].trim() !== "" && Number(rascunho[k]) !== tetoOriginal(k);
                        return (
                          <td key={c.id} className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`Teto de ${c.nome} em ${r.nome}`}
                              value={valor}
                              onChange={(e) => setRascunho((d) => ({ ...d, [k]: e.target.value }))}
                              className={`w-16 rounded-md border px-1.5 py-1 text-right text-sm tabular-nums focus:border-[#12201E] focus:outline-none ${
                                mudou ? "border-[#E29F65] bg-[#E29F65]/10" : "border-slate-300 bg-white"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <SaveBar
            aviso={
              aviso ?? (alteradas.length ? (
                <span className="text-xs font-semibold text-[#B5651D]">
                  {alteradas.length === 1 ? "1 cota alterada" : `${alteradas.length} cotas alteradas`}
                </span>
              ) : null)
            }
          >
            {alteradas.length > 0 && (
              <button type="button" onClick={() => setRascunho({})} className={btn("ghost")} disabled={salvando}>
                Descartar
              </button>
            )}
            <button type="button" onClick={salvarCotas} className={btn("primary")} disabled={salvando || !alteradas.length}>
              {salvando ? "Salvando…" : "Salvar cotas"}
            </button>
          </SaveBar>
        </>
      )}

      {regs && regs.length > 0 && aba === "tema" && (
        <>
          {aviso}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regs.map((r) => (
              <TemaCard key={r.id} r={r} onSave={saveTema} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TemaCard({ r, onSave }: { r: Regiao; onSave: (r: Regiao, p: string, d: string) => void }) {
  const origP = r.tema_config?.paleta?.primaria ?? r.tema_config?.cor_primaria ?? "#12201E";
  const origD = r.tema_config?.paleta?.acento ?? r.tema_config?.cor_destaque ?? "#E29F65";
  const [primaria, setPrimaria] = useState(origP);
  const [destaque, setDestaque] = useState(origD);
  const mudou = primaria !== origP || destaque !== origD;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#12201E]">{r.nome}</p>
          <p className="truncate text-xs text-slate-500">/{r.slug} · {r.cidade_principal}</p>
        </div>
        {!r.ativa && <StatusPill status="inativa" />}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${primaria} 70%, ${destaque} 70%)` }} />
      <div className="mt-3 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
          Cor da região
          <input type="color" value={primaria} onChange={(e) => setPrimaria(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
          Texto
          <input type="color" value={destaque} onChange={(e) => setDestaque(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300" />
        </label>
        <button type="button" onClick={() => onSave(r, primaria, destaque)} disabled={!mudou} className={btn(mudou ? "primary" : "secondary", "sm") + " ml-auto"}>
          Salvar tema
        </button>
      </div>
    </div>
  );
}
