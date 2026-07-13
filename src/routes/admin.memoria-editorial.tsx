import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/memoria-editorial")({
  component: AdminMemoria,
});

type Glossario = { termo: string; definicao: string };
type Sigla = { sigla: string; significado: string };
type Pessoa = { nome: string; cargo?: string; partido?: string; estado?: string };
type Instituicao = { nome: string; tipo?: string };

type Memoria = {
  id?: string;
  missao: string;
  valores: string;
  posicionamento: string;
  manual_estilo: string;
  glossario: Glossario[];
  siglas: Sigla[];
  pessoas: Pessoa[];
  instituicoes: Instituicao[];
  atualizado_em?: string;
};

const EMPTY: Memoria = {
  missao: "", valores: "", posicionamento: "", manual_estilo: "",
  glossario: [], siglas: [], pessoas: [], instituicoes: [],
};

function AdminMemoria() {
  const [m, setM] = useState<Memoria>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("memoria_editorial")
        .select("id, missao, valores, posicionamento, manual_estilo, glossario, siglas, pessoas, instituicoes, atualizado_em")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setM({
          id: data.id,
          missao: data.missao ?? "",
          valores: data.valores ?? "",
          posicionamento: data.posicionamento ?? "",
          manual_estilo: data.manual_estilo ?? "",
          glossario: (data.glossario ?? []) as Glossario[],
          siglas: (data.siglas ?? []) as Sigla[],
          pessoas: (data.pessoas ?? []) as Pessoa[],
          instituicoes: (data.instituicoes ?? []) as Instituicao[],
          atualizado_em: data.atualizado_em,
        });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar memória");
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
        missao: m.missao || null,
        valores: m.valores || null,
        posicionamento: m.posicionamento || null,
        manual_estilo: m.manual_estilo || null,
        glossario: m.glossario,
        siglas: m.siglas,
        pessoas: m.pessoas,
        instituicoes: m.instituicoes,
        atualizado_em: new Date().toISOString(),
      };
      if (m.id) {
        const { error } = await sb.from("memoria_editorial").update(payload).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("memoria_editorial").insert(payload);
        if (error) throw error;
      }
      setMsg("Memória editorial salva.");
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Memória"
        title="Memória Editorial"
        subtitle="Identidade global do portal + glossário, siglas, pessoas e instituições injetados no prompt de todo agente redator."
      />
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="text-sm font-semibold">Identidade</h2>
        <TextField label="Missão" rows={2} value={m.missao} onChange={(v) => setM({ ...m, missao: v })} />
        <TextField label="Valores" rows={2} value={m.valores} onChange={(v) => setM({ ...m, valores: v })} />
        <TextField label="Posicionamento" rows={2} value={m.posicionamento} onChange={(v) => setM({ ...m, posicionamento: v })} />
        <TextField label="Manual de estilo (regras curtas de linguagem)" rows={4} value={m.manual_estilo} onChange={(v) => setM({ ...m, manual_estilo: v })} />
      </section>

      <ListEditor
        title="Glossário"
        items={m.glossario}
        fields={["termo", "definicao"]}
        onChange={(items) => setM({ ...m, glossario: items as Glossario[] })}
        blank={{ termo: "", definicao: "" }}
      />
      <ListEditor
        title="Siglas"
        items={m.siglas}
        fields={["sigla", "significado"]}
        onChange={(items) => setM({ ...m, siglas: items as Sigla[] })}
        blank={{ sigla: "", significado: "" }}
      />
      <ListEditor
        title="Pessoas recorrentes"
        items={m.pessoas}
        fields={["nome", "cargo", "partido", "estado"]}
        onChange={(items) => setM({ ...m, pessoas: items as Pessoa[] })}
        blank={{ nome: "", cargo: "", partido: "", estado: "" }}
      />
      <ListEditor
        title="Instituições"
        items={m.instituicoes}
        fields={["nome", "tipo"]}
        onChange={(items) => setM({ ...m, instituicoes: items as Instituicao[] })}
        blank={{ nome: "", tipo: "" }}
      />

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {m.atualizado_em ? `Atualizado em ${new Date(m.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
        </p>
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A2540] to-[#0d3a6e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md">
          Salvar memória editorial
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full rounded border px-2 py-2 text-xs leading-relaxed" />
    </label>
  );
}

function ListEditor<T extends Record<string, string>>({
  title, items, fields, onChange, blank,
}: { title: string; items: T[]; fields: (keyof T & string)[]; onChange: (items: T[]) => void; blank: T }) {
  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title} <span className="ml-2 text-xs text-muted-foreground">({items.length})</span></h2>
        <button onClick={() => onChange([...items, { ...blank }])} className="rounded border px-2 py-1 text-xs hover:bg-accent">+ adicionar</button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item.</p>}
      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li key={idx} className="flex flex-wrap items-start gap-2 rounded border bg-background p-2">
            {fields.map((f) => (
              <label key={f} className="flex-1 text-[10px]">
                <span className="mb-0.5 block font-semibold text-muted-foreground">{f}</span>
                <input
                  value={it[f] ?? ""}
                  onChange={(e) => {
                    const next = items.slice();
                    next[idx] = { ...next[idx], [f]: e.target.value } as T;
                    onChange(next);
                  }}
                  className="w-full min-w-32 rounded border px-2 py-1 text-xs"
                />
              </label>
            ))}
            <button
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="mt-4 rounded border border-red-200 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
            >remover</button>
          </li>
        ))}
      </ul>
    </section>
  );
}