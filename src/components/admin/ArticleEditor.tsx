import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  PARANA_MUNICIPIOS,
  parseCityList,
  suggestMunicipios,
  findMunicipioBySlug,
  type Municipio,
} from "@/lib/parana-municipios";

type PinScope = "estado" | "regiao" | "cidades";

type Regiao = { slug: string; nome: string };
type RegiaoOpt = { id: string; slug: string; nome: string };
type CategoriaOpt = { id: string; slug: string; nome: string };

type Props = {
  articleId: string;
  initial: {
    titulo: string;
    subtitulo: string | null;
    resumo: string | null;
    corpo: string | null;
    slug: string;
    seo_title: string | null;
    seo_description: string | null;
    editor_responsavel?: string | null;
    fixado_posicao?: number | null;
    fixado_escopo?: PinScope | null;
    fixado_regioes?: string[] | null;
    fixado_cidades?: string[] | null;
    regiao_id?: string | null;
    categoria_id?: string | null;
  };
  onSaved: () => void;
  onCancel: () => void;
};

export function ArticleEditor({ articleId, initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    titulo: initial.titulo ?? "",
    subtitulo: initial.subtitulo ?? "",
    resumo: initial.resumo ?? "",
    corpo: initial.corpo ?? "",
    slug: initial.slug ?? "",
    seo_title: initial.seo_title ?? "",
    seo_description: initial.seo_description ?? "",
    editor_responsavel: initial.editor_responsavel ?? "",
    regiao_id: initial.regiao_id ?? "",
    categoria_id: initial.categoria_id ?? "",
    fixado_posicao:
      typeof initial.fixado_posicao === "number" && initial.fixado_posicao !== null
        ? String(initial.fixado_posicao)
        : "",
  });
  const [escopo, setEscopo] = useState<PinScope>(initial.fixado_escopo ?? "estado");
  const [regioes, setRegioes] = useState<string[]>(initial.fixado_regioes ?? []);
  const [cidades, setCidades] = useState<string[]>(initial.fixado_cidades ?? []);
  const [cityInput, setCityInput] = useState("");
  const [cityMsg, setCityMsg] = useState<string | null>(null);
  const [availableRegions, setAvailableRegions] = useState<Regiao[]>([]);
  const [regioesFull, setRegioesFull] = useState<RegiaoOpt[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Carrega regiões cadastradas (para o multi-select de "Regiões específicas").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const [{ data: regs }, { data: cats }] = await Promise.all([
          sb.from("regioes").select("id, slug, nome").order("nome"),
          sb.from("editorial_categories").select("id, slug, nome").order("nome"),
        ]);
        if (!cancelled) {
          if (regs) {
            setRegioesFull(regs as RegiaoOpt[]);
            setAvailableRegions((regs as RegiaoOpt[]).map((r) => ({ slug: r.slug, nome: r.nome })));
          }
          if (cats) setCategorias(cats as CategoriaOpt[]);
        }
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addCitiesFromInput() {
    if (!cityInput.trim()) return;
    const { found, unknown } = parseCityList(cityInput);
    const merged = Array.from(new Set([...cidades, ...found.map((m) => m.slug)]));
    setCidades(merged);
    setCityInput("");
    setCityMsg(
      unknown.length > 0
        ? `Não reconhecidas: ${unknown.join(", ")}. Só municípios do Paraná são aceitos.`
        : null,
    );
  }

  function removeCity(slug: string) {
    setCidades((prev) => prev.filter((s) => s !== slug));
  }

  function toggleRegion(slug: string) {
    setRegioes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  const suggestions: Municipio[] = cityInput.trim() ? suggestMunicipios(cityInput, 6) : [];

  function insertAtCursor(prefix: string, suffix = prefix) {
    const el = document.getElementById(`corpo-${articleId}`) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = form.corpo;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    set("corpo", next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + prefix.length;
      el.selectionEnd = end + prefix.length;
    }, 0);
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const selectedPin = form.fixado_posicao === "" ? null : Number(form.fixado_posicao);
      const effectiveEscopo: PinScope | null = selectedPin === null ? null : escopo;
      const effectiveRegioes = effectiveEscopo === "regiao" ? regioes : [];
      const effectiveCidades = effectiveEscopo === "cidades" ? cidades : [];
      const patch: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        subtitulo: form.subtitulo.trim() || null,
        resumo: form.resumo.trim() || null,
        corpo: form.corpo,
        slug: form.slug.trim(),
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        editor_responsavel: form.editor_responsavel.trim() || null,
        categoria_id: form.categoria_id || null,
        fixado_posicao: selectedPin,
        fixado_escopo: effectiveEscopo,
        fixado_regioes: effectiveRegioes,
        fixado_cidades: effectiveCidades,
      };
      if (form.regiao_id) patch.regiao_id = form.regiao_id;
      const { data, error } = await sb
        .from("generated_articles")
        .update(patch)
        .eq("id", articleId)
        .select("id, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades")
        .maybeSingle();
      if (error) {
        if (/fixado_(escopo|regioes|cidades)/i.test(error.message)) {
          throw new Error(
            "As colunas de fixação geo ainda não existem no banco. Rode a migração 015_pins_geo.sql.",
          );
        }
        throw error;
      }
      if (!data) throw new Error("A alteração não foi aplicada. Verifique sua permissão de editor.");
      const savedPin = typeof data.fixado_posicao === "number" ? data.fixado_posicao : null;
      if (savedPin !== selectedPin) {
        throw new Error("A posição de fixação não foi gravada no banco.");
      }
      // Exclusividade da posição só vale DENTRO do mesmo escopo.
      // Dois pins "Manchete" para cidades diferentes convivem.
      if (selectedPin !== null && effectiveEscopo === "estado") {
        const { error: clearError } = await sb
          .from("generated_articles")
          .update({ fixado_posicao: null })
          .eq("fixado_posicao", selectedPin)
          .eq("fixado_escopo", "estado")
          .neq("id", articleId);
        if (clearError) throw clearError;
      }
      setMsg("Salvo.");
      onSaved();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded border bg-background px-2 py-1.5 text-sm";
  const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const pinned = form.fixado_posicao !== "";

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <label className={labelCls}>Título</label>
        <input className={inputCls} value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={form.subtitulo} onChange={(e) => set("subtitulo", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Resumo</label>
        <textarea className={inputCls} rows={2} value={form.resumo} onChange={(e) => set("resumo", e.target.value)} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Corpo da matéria</label>
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => insertAtCursor("**")}
              className="rounded border px-2 py-0.5 font-bold hover:bg-accent">B</button>
            <button type="button" onClick={() => insertAtCursor("*")}
              className="rounded border px-2 py-0.5 italic hover:bg-accent">I</button>
            <button type="button" onClick={() => insertAtCursor("\n\n## ", "")}
              className="rounded border px-2 py-0.5 hover:bg-accent">H2</button>
            <button type="button" onClick={() => insertAtCursor("\n\n### ", "")}
              className="rounded border px-2 py-0.5 hover:bg-accent">H3</button>
            <button type="button" onClick={() => insertAtCursor("[", "](https://)")}
              className="rounded border px-2 py-0.5 hover:bg-accent">Link</button>
            <button type="button" onClick={() => insertAtCursor("\n\n> ", "")}
              className="rounded border px-2 py-0.5 hover:bg-accent">"</button>
          </div>
        </div>
        <textarea
          id={`corpo-${articleId}`}
          className={`${inputCls} font-mono text-[13px] leading-relaxed`}
          rows={18}
          value={form.corpo}
          onChange={(e) => set("corpo", e.target.value)}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {form.corpo.length} caracteres · {form.corpo.trim().split(/\s+/).filter(Boolean).length} palavras
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Slug</label>
          <input className={inputCls} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>SEO title</label>
          <input className={inputCls} value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>SEO description</label>
        <textarea className={inputCls} rows={2} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Editor(a) responsável</label>
        <input
          className={inputCls}
          placeholder="Ex.: Maria Silva"
          value={form.editor_responsavel}
          onChange={(e) => set("editor_responsavel", e.target.value)}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Aparece como byline visível e como author Person no JSON-LD (E-E-A-T / Google News).
        </p>
      </div>
      <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
        <label className={labelCls}>📌 Fixar na home / região</label>
        <select
          className={inputCls}
          value={form.fixado_posicao}
          onChange={(e) => set("fixado_posicao", e.target.value)}
        >
          <option value="">Não fixar — ordem automática por data</option>
          <option value="0">Manchete principal (capa)</option>
          <option value="1">Destaque lateral · posição 1</option>
          <option value="2">Destaque lateral · posição 2</option>
          <option value="3">Destaque lateral · posição 3</option>
          <option value="4">Destaque lateral · posição 4</option>
        </select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Sem fixação, novas matérias publicadas assumem a manchete automaticamente.
          Ao fixar, a matéria trava nessa posição até ser desfixada.
        </p>

        {pinned && (
          <div className="mt-3 space-y-2 border-t border-amber-300/60 pt-3 dark:border-amber-500/30">
            <label className={labelCls}>🎯 Aparecer para</label>
            <div className="flex flex-wrap gap-3 text-xs">
              {(["estado", "regiao", "cidades"] as PinScope[]).map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name={`escopo-${articleId}`}
                    checked={escopo === opt}
                    onChange={() => setEscopo(opt)}
                  />
                  <span>
                    {opt === "estado" && "Todo o estado"}
                    {opt === "regiao" && "Regiões específicas"}
                    {opt === "cidades" && "Cidades específicas"}
                  </span>
                </label>
              ))}
            </div>

            {escopo === "regiao" && (
              <div className="rounded border bg-background p-2">
                <p className="mb-1 text-[10px] text-muted-foreground">
                  Selecione uma ou mais regiões editoriais em que essa fixação deve aparecer:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableRegions.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Carregando regiões…
                    </span>
                  )}
                  {availableRegions.map((r) => {
                    const on = regioes.includes(r.slug);
                    return (
                      <button
                        key={r.slug}
                        type="button"
                        onClick={() => toggleRegion(r.slug)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          on
                            ? "border-[#0A2540] bg-[#0A2540] text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-accent"
                        }`}
                      >
                        {r.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {escopo === "cidades" && (
              <div className="rounded border bg-background p-2">
                <p className="mb-1 text-[10px] text-muted-foreground">
                  Digite cidades do Paraná separadas por vírgula
                  (ex.: <em>Cascavel, Toledo, Santa Tereza do Oeste, Medianeira</em>).
                  Pressione Enter para adicionar.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 rounded border bg-white px-2 py-1.5">
                  {cidades.map((slug) => {
                    const m = findMunicipioBySlug(slug);
                    return (
                      <span
                        key={slug}
                        className="inline-flex items-center gap-1 rounded-full bg-[#0A2540] px-2 py-0.5 text-[11px] font-medium text-white"
                      >
                        {m?.name ?? slug}
                        <button
                          type="button"
                          onClick={() => removeCity(slug)}
                          className="ml-0.5 text-white/80 hover:text-white"
                          aria-label={`Remover ${m?.name ?? slug}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  <input
                    list={`munic-${articleId}`}
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addCitiesFromInput();
                      } else if (
                        e.key === "Backspace" &&
                        !cityInput &&
                        cidades.length > 0
                      ) {
                        setCidades((prev) => prev.slice(0, -1));
                      }
                    }}
                    onBlur={addCitiesFromInput}
                    placeholder={cidades.length === 0 ? "Cascavel, Toledo, …" : ""}
                    className="min-w-[140px] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none"
                  />
                  <datalist id={`munic-${articleId}`}>
                    {PARANA_MUNICIPIOS.slice(0, 399).map((m) => (
                      <option key={m.slug} value={m.name} />
                    ))}
                  </datalist>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {suggestions.map((s) => (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => {
                          setCidades((prev) =>
                            prev.includes(s.slug) ? prev : [...prev, s.slug],
                          );
                          setCityInput("");
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] hover:bg-accent"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {cityMsg && (
                  <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">{cityMsg}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {cidades.length} cidade(s) selecionada(s). Quem estiver fora dessas cidades verá a home/região normal, sem essa fixação.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving}
          className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60">
          {saving ? "Salvando…" : "💾 Salvar alterações"}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="rounded border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">
          Cancelar
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
