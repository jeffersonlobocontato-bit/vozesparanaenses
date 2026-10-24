import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
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
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/agentes")({
  component: AdminAgentes,
});

type Categoria = { id: string; slug: string; nome: string };

type DnaSintatico = {
  titulo_padrao?: string;
  subtitulo_padrao?: string;
  ordem_informacoes?: string;
  tamanho_paragrafos?: string;
  ritmo?: string;
  uso_listas?: string;
  uso_intertitulos?: string;
};
type DnaSemantico = {
  eixo_narrativo?: string;
  perguntas_obrigatorias?: string;
  enfases?: string;
  conflitos_tipicos?: string;
};
type DnaLexical = {
  palavras_preferidas?: string;
  palavras_proibidas?: string;
  verbos_predominantes?: string;
  adjetivos_evitados?: string;
  expressoes_recorrentes?: string;
  tom?: string;
  formalidade?: string;
  nivel_tecnico?: string;
};
type Matriz = {
  objetivo?: string;
  publico?: string;
  fontes_prioritarias?: string;
  fontes_proibidas?: string;
  cta?: string;
  indicadores?: string;
};

type Agente = {
  id?: string;
  categoria_id: string;
  nome: string;
  instrucoes_base: string;
  exemplo_texto: string | null;
  ativo: boolean;
  atualizado_em?: string;
  dna_sintatico: DnaSintatico;
  dna_semantico: DnaSemantico;
  dna_lexical: DnaLexical;
  matriz_editorial: Matriz;
};

function AdminAgentes() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [agentes, setAgentes] = useState<Record<string, Agente>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const [rc, ra] = await Promise.all([
        sb.from("editorial_categories").select("id, slug, nome").order("nome"),
        sb.from("agentes_redatores").select("id, categoria_id, nome, instrucoes_base, exemplo_texto, ativo, atualizado_em, dna_sintatico, dna_semantico, dna_lexical, matriz_editorial"),
      ]);
      if (rc.error) throw rc.error;
      if (ra.error) throw ra.error;
      setCats((rc.data ?? []) as Categoria[]);
      const map: Record<string, Agente> = {};
      for (const a of (ra.data ?? []) as Agente[]) {
        map[a.categoria_id] = {
          ...a,
          dna_sintatico: a.dna_sintatico ?? {},
          dna_semantico: a.dna_semantico ?? {},
          dna_lexical: a.dna_lexical ?? {},
          matriz_editorial: a.matriz_editorial ?? {},
        };
      }
      setAgentes(map);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(cat: Categoria, next: Agente): Promise<boolean> {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const payload = {
        categoria_id: cat.id,
        nome: next.nome || `Redator de ${cat.nome}`,
        instrucoes_base: next.instrucoes_base ?? "",
        exemplo_texto: next.exemplo_texto || null,
        ativo: next.ativo,
        dna_sintatico: next.dna_sintatico ?? {},
        dna_semantico: next.dna_semantico ?? {},
        dna_lexical: next.dna_lexical ?? {},
        matriz_editorial: next.matriz_editorial ?? {},
        atualizado_em: new Date().toISOString(),
      };
      if (next.id) {
        const { error } = await sb.from("agentes_redatores").update(payload).eq("id", next.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("agentes_redatores").insert(payload);
        if (error) throw error;
      }
      setMsg(`Agente de ${cat.nome} salvo.`);
      await load();
      return true;
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Redação"
        title="Agentes IA"
        subtitle="Um redator especializado por editoria, configurado pelo Método DEL (camadas Sintática, Semântica e Lexical)."
        actions={
          <button type="button" onClick={load} className={btn("secondary")}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
          </button>
        }
      />

      <Section title="O que os agentes fazem">
        <p className="text-sm text-slate-600">
          Quando a IA escreve uma matéria, ela segue as instruções do agente da editoria: estrutura do texto, perguntas que precisa responder e vocabulário.
          Camadas vazias são ignoradas e, se todas estiverem vazias, vale só o prompt livre.
        </p>
      </Section>

      {msg && <Aviso tipo={msg.startsWith("Falha") ? "erro" : "ok"}>{msg}</Aviso>}
      {err && <ErrorBanner>{err}</ErrorBanner>}

      <ul className="space-y-2">
        {cats.map((c) => {
          const a = agentes[c.id] ?? {
            categoria_id: c.id, nome: `Redator de ${c.nome}`, instrucoes_base: "",
            exemplo_texto: null, ativo: true,
            dna_sintatico: {}, dna_semantico: {}, dna_lexical: {}, matriz_editorial: {},
          };
          const open = openId === c.id;
          const camadas = [
            Object.keys(a.dna_sintatico ?? {}).length,
            Object.keys(a.dna_semantico ?? {}).length,
            Object.keys(a.dna_lexical ?? {}).length,
            Object.keys(a.matriz_editorial ?? {}).length,
          ].filter((n) => n > 0).length;
          return (
            <li key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : c.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <span className="font-semibold text-[#12201E]">{c.nome}</span>
                  {agentes[c.id] ? (
                    <>
                      <StatusPill status={a.ativo ? "ativo" : "inativo"} />
                      <span className="text-xs text-slate-500">
                        {camadas}/4 camadas DEL · prompt livre {(a.instrucoes_base ?? "").length} caracteres
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Sem agente configurado</span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {open && <AgenteEditor cat={c} inicial={a} onSave={save} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Tab = "sintatico" | "semantico" | "lexical" | "matriz" | "livre" | "exemplo";

const preenchido = (v: unknown) => typeof v === "string" && v.trim() !== "";
const contar = (o: object, chaves: string[]) =>
  chaves.filter((k) => preenchido((o as Record<string, unknown>)[k])).length;

const CHAVES_SINT = ["titulo_padrao", "subtitulo_padrao", "ordem_informacoes", "tamanho_paragrafos", "ritmo", "uso_listas", "uso_intertitulos"];
const CHAVES_SEM = ["eixo_narrativo", "enfases", "perguntas_obrigatorias", "conflitos_tipicos"];
const CHAVES_LEX = ["palavras_preferidas", "palavras_proibidas", "verbos_predominantes", "adjetivos_evitados", "expressoes_recorrentes", "tom", "formalidade", "nivel_tecnico"];
const CHAVES_MAT = ["objetivo", "publico", "fontes_prioritarias", "fontes_proibidas", "indicadores", "cta"];

function editavel(a: Agente) {
  return JSON.stringify({
    nome: a.nome, ativo: a.ativo, instrucoes_base: a.instrucoes_base ?? "", exemplo_texto: a.exemplo_texto ?? "",
    s: a.dna_sintatico, se: a.dna_semantico, l: a.dna_lexical, m: a.matriz_editorial,
  });
}

function AgenteEditor({ cat, inicial, onSave }: {
  cat: Categoria; inicial: Agente; onSave: (cat: Categoria, next: Agente) => Promise<boolean>;
}) {
  const [state, setState] = useState<Agente>(inicial);
  const [tab, setTab] = useState<Tab>("sintatico");
  const [salvando, setSalvando] = useState(false);

  // Depois de salvar, a lista recarrega e o agente volta do banco.
  // Chave estável: o agente padrão (sem registro) é recriado a cada render do pai.
  const versao = `${inicial.id ?? "novo"}:${inicial.atualizado_em ?? ""}`;
  useEffect(() => { setState(inicial); }, [versao]); // eslint-disable-line react-hooks/exhaustive-deps

  const sujo = useMemo(() => editavel(state) !== editavel(inicial), [state, inicial]);

  function upd<T>(patch: Partial<Agente>) { setState({ ...state, ...patch } as Agente & T); }
  function updSint(patch: Partial<DnaSintatico>) { setState({ ...state, dna_sintatico: { ...state.dna_sintatico, ...patch } }); }
  function updSem(patch: Partial<DnaSemantico>) { setState({ ...state, dna_semantico: { ...state.dna_semantico, ...patch } }); }
  function updLex(patch: Partial<DnaLexical>) { setState({ ...state, dna_lexical: { ...state.dna_lexical, ...patch } }); }
  function updMat(patch: Partial<Matriz>) { setState({ ...state, matriz_editorial: { ...state.matriz_editorial, ...patch } }); }

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "sintatico", label: "D — Sintático", count: contar(state.dna_sintatico, CHAVES_SINT) },
    { value: "semantico", label: "E — Semântico", count: contar(state.dna_semantico, CHAVES_SEM) },
    { value: "lexical", label: "L — Lexical", count: contar(state.dna_lexical, CHAVES_LEX) },
    { value: "matriz", label: "Matriz", count: contar(state.matriz_editorial, CHAVES_MAT) },
    { value: "livre", label: "Prompt livre", count: preenchido(state.instrucoes_base) ? 1 : 0 },
    { value: "exemplo", label: "Exemplo", count: preenchido(state.exemplo_texto) ? 1 : 0 },
  ];

  async function salvar() {
    setSalvando(true);
    try { await onSave(cat, state); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4 border-t border-slate-100 px-4 pt-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className={rotuloClass + " min-w-[16rem] flex-1"}>
          Nome do agente
          <input value={state.nome} onChange={(e) => upd({ nome: e.target.value })} className={campoClass} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={state.ativo} onChange={(e) => upd({ ativo: e.target.checked })} />
          Ativo (aplicar ao gerar matéria)
        </label>
      </div>

      <Tabs value={tab} onChange={setTab} items={tabs} />
      {tab === "sintatico" && (
        <div className="grid gap-3 md:grid-cols-2">
          <TA label="Padrão de título" hint="Ex.: Verbo + personagem + consequência" v={state.dna_sintatico.titulo_padrao ?? ""} onC={(v) => updSint({ titulo_padrao: v })} />
          <TA label="Padrão de subtítulo" hint="resume? amplia? contextualiza? traz números?" v={state.dna_sintatico.subtitulo_padrao ?? ""} onC={(v) => updSint({ subtitulo_padrao: v })} />
          <TA label="Ordem das informações" hint="Ex.: Lide → fato principal → explicação → declarações → contexto → consequências → serviço" v={state.dna_sintatico.ordem_informacoes ?? ""} onC={(v) => updSint({ ordem_informacoes: v })} rows={4} />
          <TA label="Tamanho dos parágrafos" hint="Ex.: 3-4 parágrafos, 40-60 palavras cada, períodos curtos" v={state.dna_sintatico.tamanho_paragrafos ?? ""} onC={(v) => updSint({ tamanho_paragrafos: v })} />
          <TA label="Ritmo" hint="frases curtas? longas? mistura? conectores?" v={state.dna_sintatico.ritmo ?? ""} onC={(v) => updSint({ ritmo: v })} />
          <TA label="Uso de listas" hint="Quando aparecem? Como aparecem?" v={state.dna_sintatico.uso_listas ?? ""} onC={(v) => updSint({ uso_listas: v })} />
          <TA label="Uso de intertítulos" hint="Quantos? Em quais momentos?" v={state.dna_sintatico.uso_intertitulos ?? ""} onC={(v) => updSint({ uso_intertitulos: v })} />
        </div>
      )}

      {tab === "semantico" && (
        <div className="grid gap-3 md:grid-cols-2">
          <TA label="Eixo narrativo" hint="Ex.: gestão / investimento / conflito / serviço" v={state.dna_semantico.eixo_narrativo ?? ""} onC={(v) => updSem({ eixo_narrativo: v })} />
          <TA label="Ênfases da editoria" hint="Ex.: economia, segurança, gastos, direitos, bastidores" v={state.dna_semantico.enfases ?? ""} onC={(v) => updSem({ enfases: v })} />
          <TA label="10 perguntas obrigatórias" hint="Qual foi o fato? Qual o conflito? Quem ganha? Quem perde? Causa? Consequência? Contexto histórico? Impacto? Sentimento predominante? Intenção editorial?" v={state.dna_semantico.perguntas_obrigatorias ?? ""} onC={(v) => updSem({ perguntas_obrigatorias: v })} rows={8} />
          <TA label="Conflitos típicos" hint="Ex.: oposição vs governo, produtor vs órgão, moradores vs prefeitura" v={state.dna_semantico.conflitos_tipicos ?? ""} onC={(v) => updSem({ conflitos_tipicos: v })} rows={4} />
        </div>
      )}

      {tab === "lexical" && (
        <div className="grid gap-3 md:grid-cols-2">
          <TA label="Palavras preferidas" hint="separe por vírgula" v={state.dna_lexical.palavras_preferidas ?? ""} onC={(v) => updLex({ palavras_preferidas: v })} />
          <TA label="Palavras proibidas" hint="ex.: polêmico, controverso, importante, monstro" v={state.dna_lexical.palavras_proibidas ?? ""} onC={(v) => updLex({ palavras_proibidas: v })} />
          <TA label="Verbos predominantes" hint="afirma, declara, informa, aprova, determina" v={state.dna_lexical.verbos_predominantes ?? ""} onC={(v) => updLex({ verbos_predominantes: v })} />
          <TA label="Adjetivos evitados" hint="incrível, imperdível, absurdo, bandido" v={state.dna_lexical.adjetivos_evitados ?? ""} onC={(v) => updLex({ adjetivos_evitados: v })} />
          <TA label="Expressões recorrentes" hint='"segundo levantamento", "de acordo com", "em nota"' v={state.dna_lexical.expressoes_recorrentes ?? ""} onC={(v) => updLex({ expressoes_recorrentes: v })} rows={3} />
          <TA label="Tom" hint="institucional, popular, técnico, investigativo, analítico, didático, combativo, neutro" v={state.dna_lexical.tom ?? ""} onC={(v) => updLex({ tom: v })} />
          <TA label="Formalidade" hint="alta / média / baixa" v={state.dna_lexical.formalidade ?? ""} onC={(v) => updLex({ formalidade: v })} />
          <TA label="Nível técnico" hint="básico / intermediário / avançado (com tradução de jargão)" v={state.dna_lexical.nivel_tecnico ?? ""} onC={(v) => updLex({ nivel_tecnico: v })} />
        </div>
      )}

      {tab === "matriz" && (
        <div className="grid gap-3 md:grid-cols-2">
          <TA label="Objetivo da editoria" v={state.matriz_editorial.objetivo ?? ""} onC={(v) => updMat({ objetivo: v })} />
          <TA label="Público-alvo" v={state.matriz_editorial.publico ?? ""} onC={(v) => updMat({ publico: v })} />
          <TA label="Fontes prioritárias" hint="Ex.: Sesa, MP-PR, IBGE, Deral" v={state.matriz_editorial.fontes_prioritarias ?? ""} onC={(v) => updMat({ fontes_prioritarias: v })} rows={3} />
          <TA label="Fontes proibidas" hint="Ex.: blogs anônimos, contas não verificadas" v={state.matriz_editorial.fontes_proibidas ?? ""} onC={(v) => updMat({ fontes_proibidas: v })} rows={3} />
          <TA label="Indicadores da editoria" hint="Ex.: R$ investidos, nº de atingidos, % de variação" v={state.matriz_editorial.indicadores ?? ""} onC={(v) => updMat({ indicadores: v })} />
          <TA label="CTA (quando fizer sentido)" hint="Ex.: 'agende sua vacina na UBS mais próxima'" v={state.matriz_editorial.cta ?? ""} onC={(v) => updMat({ cta: v })} />
        </div>
      )}

      {tab === "livre" && (
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-600">Prompt livre (instruções complementares)</span>
          <textarea value={state.instrucoes_base} onChange={(e) => upd({ instrucoes_base: e.target.value })}
            rows={16} className={campoClass + " w-full font-mono text-xs leading-relaxed"}
            placeholder="Este bloco é acrescentado APÓS as 4 camadas DEL. Use para overrides finais ou instruções que não cabem nas camadas." />
          <span className="mt-1 block text-[11px] text-slate-500">
            Retrocompatível: se as 4 camadas estiverem vazias, este texto sozinho vira o prompt do agente (comportamento atual).
          </span>
        </label>
      )}

      {tab === "exemplo" && (
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-slate-600">Exemplo de lide (opcional, referência de tom)</span>
          <textarea value={state.exemplo_texto ?? ""} onChange={(e) => upd({ exemplo_texto: e.target.value })}
            rows={6} className={campoClass + " w-full text-xs leading-relaxed"}
            placeholder="Ex.: A Câmara de Curitiba aprovou, nesta terça (12), por 24 votos a 9, o projeto que..." />
        </label>
      )}

      <SaveBar
        aviso={
          <span className="text-xs text-slate-500">
            {sujo ? (
              <span className="font-semibold text-[#B5651D]">Alterações não salvas</span>
            ) : state.atualizado_em ? (
              `Atualizado em ${new Date(state.atualizado_em).toLocaleString("pt-BR")}`
            ) : (
              "Nunca salvo"
            )}
          </span>
        }
      >
        {sujo && (
          <button type="button" onClick={() => setState(inicial)} className={btn("ghost")} disabled={salvando}>
            Descartar
          </button>
        )}
        <button type="button" onClick={salvar} className={btn("primary")} disabled={salvando || (!sujo && !!inicial.id)}>
          {salvando ? "Salvando…" : "Salvar agente"}
        </button>
      </SaveBar>
    </div>
  );
}

function TA({ label, hint, v, onC, rows = 2 }: { label: string; hint?: string; v: string; onC: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-slate-600">{label}</span>
      <textarea value={v} onChange={(e) => onC(e.target.value)} rows={rows}
        className={campoClass + " w-full text-xs leading-relaxed"} placeholder={hint} />
      {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}