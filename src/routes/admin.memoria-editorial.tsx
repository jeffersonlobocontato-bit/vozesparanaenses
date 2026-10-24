import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  PageHeader,
  Section,
  btn,
  ErrorBanner,
  Aviso,
  Tabs,
  SaveBar,
  EmptyState,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

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

type Aba = "identidade" | "glossario" | "siglas" | "pessoas" | "instituicoes";

function AdminMemoria() {
  const [m, setM] = useState<Memoria>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<Aba>("identidade");

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
    setSalvando(true);
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
      await load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;

  const identidadePreenchida = [m.missao, m.valores, m.posicionamento, m.manual_estilo].filter((v) => v.trim()).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Redação"
        title="Memória editorial"
        subtitle="Identidade do portal e listas de referência (glossário, siglas, pessoas e instituições) enviadas a todo agente redator."
      />
      {err && <ErrorBanner>{err}</ErrorBanner>}

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "identidade", label: "Identidade", count: identidadePreenchida },
          { value: "glossario", label: "Glossário", count: m.glossario.length },
          { value: "siglas", label: "Siglas", count: m.siglas.length },
          { value: "pessoas", label: "Pessoas", count: m.pessoas.length },
          { value: "instituicoes", label: "Instituições", count: m.instituicoes.length },
        ]}
      />

      {aba === "identidade" && (
        <Section title="Identidade">
          <div className="space-y-4">
            <TextField label="Missão" rows={2} value={m.missao} onChange={(v) => setM({ ...m, missao: v })} />
            <TextField label="Valores" rows={2} value={m.valores} onChange={(v) => setM({ ...m, valores: v })} />
            <TextField label="Posicionamento" rows={2} value={m.posicionamento} onChange={(v) => setM({ ...m, posicionamento: v })} />
            <TextField label="Manual de estilo (regras curtas de linguagem)" rows={4} value={m.manual_estilo} onChange={(v) => setM({ ...m, manual_estilo: v })} />
          </div>
        </Section>
      )}

      {aba === "glossario" && (
        <ListEditor
          title="Glossário"
          items={m.glossario}
          fields={["termo", "definicao"]}
          onChange={(items) => setM({ ...m, glossario: items as Glossario[] })}
          blank={{ termo: "", definicao: "" }}
        />
      )}
      {aba === "siglas" && (
        <ListEditor
          title="Siglas"
          items={m.siglas}
          fields={["sigla", "significado"]}
          onChange={(items) => setM({ ...m, siglas: items as Sigla[] })}
          blank={{ sigla: "", significado: "" }}
        />
      )}
      {aba === "pessoas" && (
        <ListEditor
          title="Pessoas recorrentes"
          items={m.pessoas}
          fields={["nome", "cargo", "partido", "estado"]}
          onChange={(items) => setM({ ...m, pessoas: items as Pessoa[] })}
          blank={{ nome: "", cargo: "", partido: "", estado: "" }}
        />
      )}
      {aba === "instituicoes" && (
        <ListEditor
          title="Instituições"
          items={m.instituicoes}
          fields={["nome", "tipo"]}
          onChange={(items) => setM({ ...m, instituicoes: items as Instituicao[] })}
          blank={{ nome: "", tipo: "" }}
        />
      )}

      <SaveBar
        aviso={
          msg ? (
            <Aviso tipo={msg.startsWith("Falha") ? "erro" : "ok"}>{msg}</Aviso>
          ) : (
            <span className="text-xs text-slate-500">
              {m.atualizado_em ? `Atualizado em ${new Date(m.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
            </span>
          )
        }
      >
        <button type="button" onClick={save} disabled={salvando} className={btn("primary")}>
          {salvando ? "Salvando…" : "Salvar memória editorial"}
        </button>
      </SaveBar>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className={rotuloClass}>
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className={campoClass + " w-full font-normal leading-relaxed"} />
    </label>
  );
}

const ROTULO_CAMPO: Record<string, string> = {
  termo: "Termo",
  definicao: "Definição",
  sigla: "Sigla",
  significado: "Significado",
  nome: "Nome",
  cargo: "Cargo",
  partido: "Partido",
  estado: "Estado",
  tipo: "Tipo",
};

function ListEditor<T extends Record<string, string>>({
  title, items, fields, onChange, blank,
}: { title: string; items: T[]; fields: (keyof T & string)[]; onChange: (items: T[]) => void; blank: T }) {
  return (
    <Section
      title={title}
      subtitle={items.length === 1 ? "1 item" : `${items.length} itens`}
      aside={
        <button type="button" onClick={() => onChange([...items, { ...blank }])} className={btn("secondary", "sm")}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
        </button>
      }
    >
      {items.length === 0 && <EmptyState title="Nenhum item ainda">Use “Adicionar” para incluir o primeiro.</EmptyState>}
      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li key={idx} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {fields.map((f) => (
              <label key={f} className={rotuloClass + " min-w-32 flex-1"}>
                {ROTULO_CAMPO[f] ?? f}
                <input
                  value={it[f] ?? ""}
                  onChange={(e) => {
                    const next = items.slice();
                    next[idx] = { ...next[idx], [f]: e.target.value } as T;
                    onChange(next);
                  }}
                  className={campoClass + " w-full font-normal"}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className={btn("danger", "sm") + " mb-1"}
              aria-label="Remover item"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
