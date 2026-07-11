import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/pauta")({
  component: PainelDePauta,
});

type Pauta = {
  id: string;
  status: "novo" | "selecionado_cota" | "fatos_extraidos" | "descartado";
  interesse_score: number | null;
  prioridade_score: number;
  criado_em: string;
  fatos_extraidos_em: string | null;
  grupo_estadual_id: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
  fontesNomes: string[];
  quem: string | null;
  o_que: string | null;
};

const BLOCOS = [
  { label: "Madrugada", ini: 0, fim: 6 },
  { label: "Manhã", ini: 6, fim: 12 },
  { label: "Tarde", ini: 12, fim: 18 },
  { label: "Noite", ini: 18, fim: 24 },
] as const;

function horaSaoPaulo(iso: string): number {
  // Garante o agrupamento por horário local (America/Sao_Paulo), independente
  // do fuso do navegador de quem está olhando o painel.
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parseInt(s, 10);
}

function blocoDoHorario(iso: string): (typeof BLOCOS)[number] {
  const h = horaSaoPaulo(iso);
  return BLOCOS.find((b) => h >= b.ini && h < b.fim) ?? BLOCOS[0];
}

function escalaInteresse(score: number | null): { label: string; chamas: number; cor: string } {
  const s = score ?? 0;
  if (s >= 3.5) return { label: "Muito alto", chamas: 4, cor: "#B42318" };
  if (s >= 2) return { label: "Alto", chamas: 3, cor: "#C4650A" };
  if (s >= 1) return { label: "Médio", chamas: 2, cor: "#946800" };
  return { label: "Baixo", chamas: 1, cor: "#5B6470" };
}

function Chamas({ n, cor }: { n: number; cor: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} style={{ color: i < n ? cor : "#D9DEE3" }}>●</span>
      ))}
    </span>
  );
}

function PainelDePauta() {
  const [items, setItems] = useState<Pauta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fRegiao, setFRegiao] = useState<string>("");
  const [fCategoria, setFCategoria] = useState<string>("");
  const [fFonte, setFFonte] = useState<string>("");

  const load = useCallback(async () => {
    setItems(null); setErr(null);
    try {
      const sb = await getExternalBrowser();
      const { data, error } = await sb
        .from("article_clusters")
        .select(
          "id, status, interesse_score, prioridade_score, criado_em, fatos_extraidos_em, grupo_estadual_id, " +
          "regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome), " +
          "cluster_articles(raw_article:raw_articles(fonte:fontes(nome))), " +
          "extracted_facts(quem, o_que, criado_em)"
        )
        .in("status", ["selecionado_cota", "fatos_extraidos"])
        .order("interesse_score", { ascending: false, nullsFirst: false })
        .limit(150);
      if (error) throw error;

      type Row = {
        id: string; status: Pauta["status"]; interesse_score: number | null; prioridade_score: number;
        criado_em: string; fatos_extraidos_em: string | null; grupo_estadual_id: string | null;
        regiao: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        categoria: { slug: string; nome: string } | { slug: string; nome: string }[] | null;
        cluster_articles: { raw_article: { fonte: { nome: string } | { nome: string }[] | null } | { fonte: { nome: string } | { nome: string }[] | null }[] | null }[] | null;
        extracted_facts: { quem: string | null; o_que: string | null; criado_em: string }[] | null;
      };
      const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

      const mapped: Pauta[] = ((data ?? []) as unknown as Row[]).map((r) => {
        const fontesNomes = Array.from(
          new Set(
            (r.cluster_articles ?? [])
              .map((ca) => first(ca.raw_article)?.fonte ?? null)
              .map((f) => first(f)?.nome)
              .filter((n): n is string => !!n),
          ),
        );
        const fatos = (r.extracted_facts ?? [])[0] ?? null;
        return {
          id: r.id,
          status: r.status,
          interesse_score: r.interesse_score,
          prioridade_score: r.prioridade_score,
          criado_em: r.criado_em,
          fatos_extraidos_em: r.fatos_extraidos_em,
          grupo_estadual_id: r.grupo_estadual_id,
          regiao: first(r.regiao),
          categoria: first(r.categoria),
          fontesNomes,
          quem: fatos?.quem ?? null,
          o_que: fatos?.o_que ?? null,
        };
      });
      setItems(mapped);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function extractFacts(id: string) {
    setBusyId(id); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("extract-facts", { body: { cluster_id: id } });
      if (error) throw error;
      setMsg(`Fatos extraídos (${(data as { extracted_facts_id?: string })?.extracted_facts_id ?? "ok"}). Revise antes de gerar a matéria.`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha ao extrair fatos: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusyId(null); }
  }

  async function generate(id: string) {
    setBusyId(id); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-article", { body: { cluster_id: id } });
      if (error) throw error;
      setMsg(`Rascunho criado: ${(data as { titulo?: string })?.titulo ?? "ok"}`);
      await load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusyId(null); }
  }

  const regioes = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.regiao?.nome).filter((n): n is string => !!n))).sort(), [items]);
  const categorias = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.categoria?.nome).filter((n): n is string => !!n))).sort(), [items]);
  const fontes = useMemo(() => Array.from(new Set((items ?? []).flatMap((i) => i.fontesNomes))).sort(), [items]);

  const filtrados = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (!fRegiao || i.regiao?.nome === fRegiao) &&
          (!fCategoria || i.categoria?.nome === fCategoria) &&
          (!fFonte || i.fontesNomes.includes(fFonte)),
      ),
    [items, fRegiao, fCategoria, fFonte],
  );

  const porBloco = useMemo(() => {
    const grupos = new Map<string, Pauta[]>();
    for (const b of BLOCOS) grupos.set(b.label, []);
    for (const p of filtrados) {
      const ref = p.fatos_extraidos_em ?? p.criado_em;
      const bloco = blocoDoHorario(ref);
      grupos.get(bloco.label)!.push(p);
    }
    // Dentro de cada bloco, agrupa por região
    return BLOCOS.map((b) => {
      const clusters = grupos.get(b.label) ?? [];
      const porRegiao = new Map<string, Pauta[]>();
      for (const c of clusters) {
        const chave = c.regiao?.nome ?? "Sem região";
        if (!porRegiao.has(chave)) porRegiao.set(chave, []);
        porRegiao.get(chave)!.push(c);
      }
      return { bloco: b.label, total: clusters.length, porRegiao: Array.from(porRegiao.entries()) };
    });
  }, [filtrados]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel de Pauta</h1>
          <p className="text-sm text-muted-foreground">
            Sugestões de matéria já classificadas, organizadas por horário de extração e região — com potencial de interesse de leitura para curadoria antes de redigir.
          </p>
        </div>
        <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={fRegiao} onChange={(e) => setFRegiao(e.target.value)} className="rounded border px-2 py-1 text-xs">
          <option value="">Todas as regiões</option>
          {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className="rounded border px-2 py-1 text-xs">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fFonte} onChange={(e) => setFFonte(e.target.value)} className="rounded border px-2 py-1 text-xs">
          <option value="">Todas as fontes</option>
          {fontes.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {items && filtrados.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pauta no filtro atual.</p>}

      {porBloco.filter((b) => b.total > 0).map((b) => (
        <section key={b.bloco} className="space-y-3">
          <h2 className="border-b pb-1 text-lg font-semibold text-[#0A2540]">
            {b.bloco} <span className="text-sm font-normal text-muted-foreground">— {b.total} pauta(s)</span>
          </h2>
          {b.porRegiao.map(([regiaoNome, clusters]) => (
            <div key={regiaoNome} className="pl-1">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{regiaoNome}</h3>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {clusters
                  .sort((a, c) => (c.interesse_score ?? 0) - (a.interesse_score ?? 0))
                  .map((c) => {
                    const escala = escalaInteresse(c.interesse_score);
                    return (
                      <li key={c.id} className="rounded-lg border bg-card p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                          {c.categoria && <span className="rounded bg-[#0066CC] px-2 py-0.5 font-semibold text-white">{c.categoria.nome}</span>}
                          <span className="flex items-center gap-1" title={`Interesse de leitura: ${escala.label}`}>
                            <Chamas n={escala.chamas} cor={escala.cor} />
                            <span className="text-muted-foreground">{escala.label}</span>
                          </span>
                          {c.grupo_estadual_id && (
                            <span className="rounded bg-[#5B2A86] px-2 py-0.5 font-semibold text-white" title="Mesma notícia detectada em outra região">
                              🔗 Cobertura estadual
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.fontesNomes.length} fonte(s): {c.fontesNomes.join(", ") || "—"}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Extraído: {new Date(c.fatos_extraidos_em ?? c.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </div>
                        {c.quem || c.o_que ? (
                          <div className="mt-2 border-t pt-2 text-xs leading-snug">
                            {c.quem && <p><span className="font-semibold">Quem:</span> {c.quem}</p>}
                            {c.o_que && <p><span className="font-semibold">O quê:</span> {c.o_que}</p>}
                          </div>
                        ) : (
                          <p className="mt-2 border-t pt-2 text-xs italic text-muted-foreground">Fatos ainda não extraídos.</p>
                        )}
                        <div className="mt-3">
                          {c.status === "fatos_extraidos" ? (
                            <button disabled={busyId === c.id} onClick={() => generate(c.id)}
                              className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
                              {busyId === c.id ? "Gerando…" : "Gerar matéria"}
                            </button>
                          ) : (
                            <button disabled={busyId === c.id} onClick={() => extractFacts(c.id)}
                              className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60">
                              {busyId === c.id ? "Extraindo…" : "Extrair fatos"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
