import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, Section, SaveBar, Aviso, ErrorBanner, btn, campoClass, rotuloClass } from "@/components/admin/ui";
import { DEFAULT_SOBRE, type SobreConfig } from "@/lib/sobre.functions";

export const Route = createFileRoute("/admin/sobre")({
  component: AdminSobre,
});

type Row = SobreConfig & { id?: string; atualizado_em?: string };

function AdminSobre() {
  const [r, setR] = useState<Row>({ ...DEFAULT_SOBRE });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
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
    setSalvando(true);
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
      setMsg({ tipo: "ok", texto: "Página Sobre atualizada." });
      load();
    } catch (e: unknown) {
      setMsg({ tipo: "erro", texto: "Não foi possível salvar: " + (e instanceof Error ? e.message : "erro desconhecido") });
    } finally {
      setSalvando(false);
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
      {err && <ErrorBanner>{err}</ErrorBanner>}

      <Section title="Abertura">
        <div className="space-y-4">
          <Field label="Título principal" value={r.hero_title} onChange={(v) => setR({ ...r, hero_title: v })} />
          <TextArea label="Introdução" rows={4} value={r.intro} onChange={(v) => setR({ ...r, intro: v })} />
        </div>
      </Section>

      <Section title="Seções">
        <div className="space-y-4">
          <TextArea label="Quem somos" rows={5} value={r.quem_somos} onChange={(v) => setR({ ...r, quem_somos: v })} />
          <TextArea label="Missão" rows={5} value={r.missao} onChange={(v) => setR({ ...r, missao: v })} />
          <TextArea label="Método editorial (DEL)" rows={6} value={r.metodo_editorial} onChange={(v) => setR({ ...r, metodo_editorial: v })} />
          <TextArea label="Transparência sobre IA" rows={5} value={r.transparencia_ia} onChange={(v) => setR({ ...r, transparencia_ia: v })} />
          <TextArea label="Política de correções" rows={5} value={r.correcoes} onChange={(v) => setR({ ...r, correcoes: v })} />
        </div>
      </Section>

      <Section title="Contato e institucional">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail da redação" value={r.email_redacao} onChange={(v) => setR({ ...r, email_redacao: v })} />
          <Field label="E-mail comercial" value={r.email_comercial} onChange={(v) => setR({ ...r, email_comercial: v })} />
          <Field label="Nome do fundador (aparece no JSON-LD)" value={r.founder_name} onChange={(v) => setR({ ...r, founder_name: v })} />
        </div>
      </Section>

      <SaveBar
        aviso={
          msg ? (
            <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
          ) : (
            <span className="text-xs text-slate-500">
              {r.atualizado_em ? `Atualizado em ${new Date(r.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
            </span>
          )
        }
      >
        <a href="/sobre" target="_blank" rel="noreferrer" className={btn("secondary")}>Ver página</a>
        <button type="button" onClick={save} disabled={salvando} className={btn("primary")}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </SaveBar>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={rotuloClass}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${campoClass} w-full`} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className={rotuloClass}>
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${campoClass} w-full leading-relaxed`} />
    </label>
  );
}