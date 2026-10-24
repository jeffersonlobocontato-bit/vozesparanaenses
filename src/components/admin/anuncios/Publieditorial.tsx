import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Section, btn, StatusPill, campoClass, rotuloClass, EmptyState } from "@/components/admin/ui";
import type { Campaign, Toast } from "./tipos";

type Regiao = { id: string; nome: string };
type Categoria = { id: string; nome: string };
type BriefingRow = {
  id: string; token: string; status: string; nome_anunciante: string | null;
  campaign_id: string; criado_em: string;
};

// Status do briefing → tom do kit (StatusPill) + texto legível.
const STATUS_BRIEFING: Record<string, { tom: string; label: string }> = {
  aguardando_preenchimento: { tom: "aguardando", label: "Aguardando o cliente" },
  preenchido: { tom: "pendente", label: "Preenchido, gerando texto" },
  gerado: { tom: "aprovado", label: "Texto gerado" },
  erro: { tom: "rejeitado", label: "Erro na geração" },
};

export function Publieditorial({ campaigns, onToast }: { campaigns: Campaign[]; onToast: Toast }) {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [form, setForm] = useState({ campaign_id: "", regiao_id: "", categoria_id: "" });
  const [criando, setCriando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const sb = await getExternalBrowser();
      const [r, c, b] = await Promise.all([
        sb.from("regioes").select("id, nome").eq("ativa", true).order("nome"),
        sb.from("editorial_categories").select("id, nome").order("nome"),
        sb.from("publieditorial_briefings").select("id, token, status, nome_anunciante, campaign_id, criado_em").order("criado_em", { ascending: false }),
      ]);
      setRegioes((r.data ?? []) as Regiao[]);
      setCategorias((c.data ?? []) as Categoria[]);
      setBriefings((b.data ?? []) as BriefingRow[]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function criarLink(e: FormEvent) {
    e.preventDefault();
    if (!form.campaign_id || !form.regiao_id) return onToast("Selecione campanha e região.");
    setCriando(true);
    try {
      const sb = await getExternalBrowser();
      const { data: sess } = await sb.auth.getSession();
      const { data, error } = await sb.from("publieditorial_briefings").insert({
        campaign_id: form.campaign_id,
        regiao_id: form.regiao_id,
        categoria_id: form.categoria_id || null,
        criado_por: sess.session?.user.id,
      }).select("token").single();
      if (error) throw error;
      onToast(`Link criado: /publieditorial/${data.token}. Copie e envie ao cliente.`);
      setForm({ campaign_id: "", regiao_id: "", categoria_id: "" });
      carregar();
    } catch (e: unknown) {
      onToast("Erro: " + (e instanceof Error ? e.message : "não foi possível criar o link"));
    } finally {
      setCriando(false);
    }
  }

  function copiarLink(token: string) {
    const link = `${window.location.origin}/publieditorial/${token}`;
    navigator.clipboard?.writeText(link);
    onToast("Link copiado: " + link);
  }

  return (
    <div className="space-y-4">
      <Section
        title="Novo link de publieditorial"
        subtitle="Você só cria o link. O cliente responde a entrevista (tese, contexto, diferenciais, evidências, impacto e fechamento) pelo link; o texto é gerado sozinho e cai na fila de aprovação do painel."
      >
        <form onSubmit={criarLink} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className={rotuloClass}>
            Campanha
            <select required value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} className={campoClass}>
              <option value="">Selecione…</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className={rotuloClass}>
            Região
            <select required value={form.regiao_id} onChange={(e) => setForm({ ...form, regiao_id: e.target.value })} className={campoClass}>
              <option value="">Selecione…</option>
              {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
          <label className={rotuloClass}>
            Editoria (opcional)
            <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className={campoClass}>
              <option value="">Nenhuma</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" disabled={criando} className={btn("primary")}>
              {criando ? "Criando…" : "Gerar link para o cliente"}
            </button>
          </div>
        </form>
      </Section>

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : briefings.length === 0 ? (
        <EmptyState title="Nenhum link criado ainda" />
      ) : (
        <Section title="Links enviados" subtitle={`${briefings.length} link(s)`} padded={false}>
          <ul className="divide-y divide-slate-100">
            {briefings.map((b) => {
              const camp = campaigns.find((c) => c.id === b.campaign_id);
              const st = STATUS_BRIEFING[b.status];
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#12201E]">{camp?.nome ?? "—"}{b.nome_anunciante ? ` · ${b.nome_anunciante}` : ""}</p>
                    <p className="truncate text-xs text-slate-500">/publieditorial/{b.token}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={st?.tom ?? b.status} label={st?.label ?? b.status.replace(/_/g, " ")} />
                    {b.status === "aguardando_preenchimento" && (
                      <button type="button" onClick={() => copiarLink(b.token)} className={btn("secondary", "sm")}>
                        Copiar link
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
