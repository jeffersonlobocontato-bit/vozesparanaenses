import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, refreshBtnClass } from "@/components/admin/ui";

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

  async function save(cat: Categoria, next: Agente) {
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
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agentes IA"
        title="Agentes redatores por editoria (Método DEL)"
        subtitle='Cada editoria tem um redator especializado, treinado por camadas: Sintática, Semântica e Lexical. Camadas vazias caem no "Prompt livre".'
        actions={<button onClick={load} className={refreshBtnClass()}>Atualizar</button>}
      />
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

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
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button onClick={() => setOpenId(open ? null : c.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${a.ativo ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-semibold">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {agentes[c.id] ? `${camadas}/4 camadas DEL · prompt livre ${(a.instrucoes_base ?? "").length} chars` : "sem agente configurado"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{open ? "fechar" : "editar"}</span>
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

function AgenteEditor({ cat, inicial, onSave }: {
  cat: Categoria; inicial: Agente; onSave: (cat: Categoria, next: Agente) => void;
}) {
  const [state, setState] = useState<Agente>(inicial);
  const [tab, setTab] = useState<Tab>("sintatico");

  function upd<T>(patch: Partial<Agente>) { setState({ ...state, ...patch } as Agente & T); }
  function updSint(patch: Partial<DnaSintatico>) { setState({ ...state, dna_sintatico: { ...state.dna_sintatico, ...patch } }); }
  function updSem(patch: Partial<DnaSemantico>) { setState({ ...state, dna_semantico: { ...state.dna_semantico, ...patch } }); }
  function updLex(patch: Partial<DnaLexical>) { setState({ ...state, dna_lexical: { ...state.dna_lexical, ...patch } }); }
  function updMat(patch: Partial<Matriz>) { setState({ ...state, matriz_editorial: { ...state.matriz_editorial, ...patch } }); }

  const tabs: { id: Tab; label: string }[] = [
    { id: "sintatico", label: "D — Sintático" },
    { id: "semantico", label: "E — Semântico" },
    { id: "lexical", label: "L — Lexical" },
    { id: "matriz", label: "Matriz" },
    { id: "livre", label: "Prompt livre" },
    { id: "exemplo", label: "Exemplo" },
  ];

  return (
    <div className="space-y-3 border-t px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1 text-xs">
          <span className="mb-1 block font-semibold">Nome do agente</span>
          <input value={state.nome} onChange={(e) => upd({ nome: e.target.value })} className="w-full rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={state.ativo} onChange={(e) => upd({ ativo: e.target.checked })} />
          Ativo (aplicar ao gerar matéria)
        </label>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-t px-3 py-1.5 text-xs ${tab === t.id ? "border border-b-white bg-background font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
            {t.label}
          </button>
        ))}
      </div>

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
          <span className="mb-1 block font-semibold">Prompt livre (override / instruções complementares)</span>
          <textarea value={state.instrucoes_base} onChange={(e) => upd({ instrucoes_base: e.target.value })}
            rows={16} className="w-full rounded border px-2 py-2 font-mono text-xs leading-relaxed"
            placeholder="Este bloco é acrescentado APÓS as 4 camadas DEL. Use para overrides finais ou instruções que não cabem nas camadas." />
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Retrocompatível: se as 4 camadas estiverem vazias, este texto sozinho vira o prompt do agente (comportamento atual).
          </span>
        </label>
      )}

      {tab === "exemplo" && (
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">Exemplo de lide (opcional — referência de tom)</span>
          <textarea value={state.exemplo_texto ?? ""} onChange={(e) => upd({ exemplo_texto: e.target.value })}
            rows={6} className="w-full rounded border px-2 py-2 text-xs leading-relaxed"
            placeholder="Ex.: A Câmara de Curitiba aprovou, nesta terça (12), por 24 votos a 9, o projeto que..." />
        </label>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-[10px] text-muted-foreground">
          {state.atualizado_em ? `Atualizado em ${new Date(state.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
        </p>
        <button
          onClick={() => onSave(cat, state)}
          className="rounded bg-[#0066CC] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa]"
        >Salvar agente</button>
      </div>
    </div>
  );
}

function TA({ label, hint, v, onC, rows = 2 }: { label: string; hint?: string; v: string; onC: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold">{label}</span>
      <textarea value={v} onChange={(e) => onC(e.target.value)} rows={rows}
        className="w-full rounded border px-2 py-1.5 text-xs leading-relaxed" placeholder={hint} />
      {hint && <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}