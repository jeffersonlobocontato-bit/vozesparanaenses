import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_SOBRE, type SobreConfig } from "@/lib/sobre.functions";

export const Route = createFileRoute("/admin/sobre")({
  component: AdminSobre,
});

type Row = SobreConfig & { id?: string; atualizado_em?: string };

function AdminSobre() {
  const [r, setR] = useState<Row>({ ...DEFAULT_SOBRE });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("sobre_config")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      if (data) setR({ ...DEFAULT_SOBRE, ...data });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const payload = {
        singleton: true,
        hero_title: r.hero_title,
        intro: r.intro,
        quem_somos: r.quem_somos,
        missao: r.missao,
        metodo_editorial: r.metodo_editorial,
        transparencia_ia: r.transparencia_ia,
        correcoes: r.correcoes,
        email_redacao: r.email_redacao,
        email_comercial: r.email_comercial,
        founder_name: r.founder_name,
        atualizado_em: new Date().toISOString(),
      };
      if (r.id) {
        const { error } = await sb.from("sobre_config").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("sobre_config").insert(payload);
        if (error) throw error;
      }
      setMsg("Página Sobre atualizada.");
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Institucional"
        title="Editor da página Sobre"
        subtitle="Edite manualmente o conteúdo exibido em /sobre. Suporta **negrito**, quebras de linha e parágrafos (linha em branco = novo parágrafo)."
      />
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <Field label="Título principal" value={r.hero_title} onChange={(v) => setR({ ...r, hero_title: v })} />
        <TextArea label="Introdução" rows={4} value={r.intro} onChange={(v) => setR({ ...r, intro: v })} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold">Seções</h2>
        <TextArea label="Quem somos" rows={5} value={r.quem_somos} onChange={(v) => setR({ ...r, quem_somos: v })} />
        <TextArea label="Missão" rows={5} value={r.missao} onChange={(v) => setR({ ...r, missao: v })} />
        <TextArea label="Método editorial (DEL)" rows={6} value={r.metodo_editorial} onChange={(v) => setR({ ...r, metodo_editorial: v })} />
        <TextArea label="Transparência sobre IA" rows={5} value={r.transparencia_ia} onChange={(v) => setR({ ...r, transparencia_ia: v })} />
        <TextArea label="Política de correções" rows={5} value={r.correcoes} onChange={(v) => setR({ ...r, correcoes: v })} />
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold">Contato & institucional</h2>
        <Field label="Email da redação" value={r.email_redacao} onChange={(v) => setR({ ...r, email_redacao: v })} />
        <Field label="Email comercial" value={r.email_comercial} onChange={(v) => setR({ ...r, email_comercial: v })} />
        <Field label="Nome do fundador (aparece no JSON-LD)" value={r.founder_name} onChange={(v) => setR({ ...r, founder_name: v })} />
      </section>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {r.atualizado_em ? `Atualizado em ${new Date(r.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
        </p>
        <div className="flex items-center gap-2">
          <a href="/sobre" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#0066CC] hover:text-[#0066CC]">Ver página</a>
          <button onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A2540] to-[#0d3a6e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border px-2 py-2 text-xs" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded border px-2 py-2 text-xs leading-relaxed" />
    </label>
  );
}