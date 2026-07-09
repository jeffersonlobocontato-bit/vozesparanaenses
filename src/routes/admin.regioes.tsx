import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

export const Route = createFileRoute("/admin/regioes")({
  component: AdminRegioes,
});

type Regiao = {
  id: string;
  slug: string;
  nome: string;
  cidade_principal: string;
  descricao: string | null;
  tema_config: { cor_primaria?: string; cor_destaque?: string } | null;
  ativa: boolean;
};
type Categoria = { id: string; slug: string; nome: string };
type Quota = { id?: string; regiao_id: string; categoria_id: string; piso_pct: number; teto_pct: number };

function AdminRegioes() {
  const [regs, setRegs] = useState<Regiao[] | null>(null);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [quotas, setQuotas] = useState<Record<string, Quota[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
      const byReg: Record<string, Quota[]> = {};
      for (const q of (r3.data ?? []) as Quota[]) {
        (byReg[q.regiao_id] ??= []).push(q);
      }
      setQuotas(byReg);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveTema(r: Regiao, primaria: string, destaque: string) {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("regioes").update({
        tema_config: { ...(r.tema_config ?? {}), cor_primaria: primaria, cor_destaque: destaque },
      }).eq("id", r.id);
      if (error) throw error;
      setMsg(`Tema de ${r.nome} salvo.`);
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  async function saveQuota(regiaoId: string, categoriaId: string, piso: number, teto: number) {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const existing = (quotas[regiaoId] ?? []).find((q) => q.categoria_id === categoriaId);
      if (existing?.id) {
        const { error } = await sb.from("quota_rules").update({ piso_pct: piso, teto_pct: teto }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("quota_rules").insert({ regiao_id: regiaoId, categoria_id: categoriaId, piso_pct: piso, teto_pct: teto });
        if (error) throw error;
      }
      setMsg("Cota salva.");
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Regiões, tema e cotas</h1>
        <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
      </div>
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!regs && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <ul className="space-y-2">
        {regs?.map((r) => {
          const open = openId === r.id;
          const primaria = r.tema_config?.cor_primaria ?? "#0A2540";
          const destaque = r.tema_config?.cor_destaque ?? "#0066CC";
          return (
            <li key={r.id} className="rounded-lg border bg-card">
              <button onClick={() => setOpenId(open ? null : r.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-4 w-4 rounded" style={{ background: primaria }} />
                  <span className="inline-block h-4 w-4 rounded" style={{ background: destaque }} />
                  <span className="font-semibold">{r.nome}</span>
                  <span className="text-xs text-muted-foreground">/{r.slug} · {r.cidade_principal}</span>
                </div>
                <span className="text-xs text-muted-foreground">{open ? "fechar" : "editar"}</span>
              </button>
              {open && <RegionEditor r={r} cats={cats} quotas={quotas[r.id] ?? []}
                onSaveTema={saveTema} onSaveQuota={saveQuota} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RegionEditor({ r, cats, quotas, onSaveTema, onSaveQuota }: {
  r: Regiao; cats: Categoria[]; quotas: Quota[];
  onSaveTema: (r: Regiao, p: string, d: string) => void;
  onSaveQuota: (regiaoId: string, categoriaId: string, piso: number, teto: number) => void;
}) {
  const [primaria, setPrimaria] = useState(r.tema_config?.cor_primaria ?? "#0A2540");
  const [destaque, setDestaque] = useState(r.tema_config?.cor_destaque ?? "#0066CC");
  return (
    <div className="border-t px-4 py-4">
      <h3 className="mb-2 text-sm font-semibold">Tema visual</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block">Cor primária</span>
          <input type="color" value={primaria} onChange={(e) => setPrimaria(e.target.value)} className="h-9 w-16 rounded border" />
        </label>
        <label className="text-xs">
          <span className="mb-1 block">Cor de destaque</span>
          <input type="color" value={destaque} onChange={(e) => setDestaque(e.target.value)} className="h-9 w-16 rounded border" />
        </label>
        <button onClick={() => onSaveTema(r, primaria, destaque)}
          className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa]">Salvar tema</button>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold">Cotas por editoria (% do total regional)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr><th className="px-2 py-1 text-left">Editoria</th><th className="px-2 py-1">Piso %</th><th className="px-2 py-1">Teto %</th><th className="px-2 py-1"></th></tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const existing = quotas.find((q) => q.categoria_id === c.id);
              return <QuotaRow key={c.id} regiaoId={r.id} categoria={c} initial={existing} onSave={onSaveQuota} />;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuotaRow({ regiaoId, categoria, initial, onSave }: {
  regiaoId: string; categoria: Categoria; initial?: Quota;
  onSave: (regiaoId: string, categoriaId: string, piso: number, teto: number) => void;
}) {
  const [piso, setPiso] = useState<number>(initial?.piso_pct ?? 0);
  const [teto, setTeto] = useState<number>(initial?.teto_pct ?? 100);
  return (
    <tr className="border-t">
      <td className="px-2 py-1">{categoria.nome}</td>
      <td className="px-2 py-1"><input type="number" min={0} max={100} value={piso} onChange={(e) => setPiso(Number(e.target.value))} className="w-20 rounded border px-1 py-0.5 text-right" /></td>
      <td className="px-2 py-1"><input type="number" min={0} max={100} value={teto} onChange={(e) => setTeto(Number(e.target.value))} className="w-20 rounded border px-1 py-0.5 text-right" /></td>
      <td className="px-2 py-1 text-right"><button onClick={() => onSave(regiaoId, categoria.id, piso, teto)}
        className="text-xs text-[#0066CC] hover:underline">salvar</button></td>
    </tr>
  );
}
