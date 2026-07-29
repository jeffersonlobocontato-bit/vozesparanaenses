import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

type Categoria = { id: string; nome: string; slug: string };
type Regiao = { id: string; nome: string; slug: string };

/**
 * Card "Publicar matéria": o editor preenche os campos essenciais e a IA
 * autopreenche SEO (title/description/slug), GEO (região/cidade/JSON-LD),
 * TL;DR, 5W1H e FAQ. Publica direto ao final.
 */
export function PublishArticleBox() {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [regiaoId, setRegiaoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [fonteUrl, setFonteUrl] = useState("");
  const [imagem, setImagem] = useState("");
  const [legenda, setLegenda] = useState("");
  const [credito, setCredito] = useState("");
  const [obs, setObs] = useState("");
  const [publicarDireto, setPublicarDireto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const [rg, ct] = await Promise.all([
          sb.from("regioes").select("id, nome, slug").order("nome"),
          sb.from("editorial_categories").select("id, nome, slug").order("nome"),
        ]);
        setRegioes((rg.data ?? []) as Regiao[]);
        setCategorias((ct.data ?? []) as Categoria[]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha ao carregar regiões/editorias");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!titulo.trim()) { setErr("Informe o título da matéria."); return; }
    if (texto.trim().length < 200) { setErr("O texto precisa ter ao menos 200 caracteres."); return; }
    if (!regiaoId) { setErr("Escolha a região."); return; }
    if (!categoriaId) { setErr("Escolha a editoria."); return; }

    setBusy(true);
    setStep("Organizando SEO, GEO e estrutura com a IA…");
    try {
      const { data, error } = await supabase.functions.invoke("manual-article", {
        body: {
          titulo: titulo.trim(),
          texto: texto.trim(),
          fonte_url: fonteUrl.trim() || undefined,
          regiao_id: regiaoId,
          categoria_id: categoriaId,
          observacoes: obs.trim() || undefined,
          imagem_capa_url: imagem.trim() || undefined,
          imagem_legenda: legenda.trim() || undefined,
          imagem_credito: credito.trim() || undefined,
          publicar: publicarDireto,
        },
      });
      if (error) {
        let detail = "";
        try {
          const resp = (error as { context?: { response?: Response } }).context?.response;
          if (resp) detail = await resp.clone().text();
        } catch { /* ignore */ }
        throw new Error(detail || error.message);
      }
      const payload = data as { ok?: boolean; error?: string; hint?: string; titulo?: string; publicado?: boolean };
      if (!payload?.ok) throw new Error(payload?.hint ?? payload?.error ?? "Falha desconhecida");
      setOk(payload.publicado
        ? `Publicada: "${payload.titulo ?? titulo}". Já está no ar.`
        : `Rascunho criado: "${payload.titulo ?? titulo}". Revise na Fila editorial.`);
      setTitulo(""); setTexto(""); setFonteUrl(""); setImagem(""); setLegenda(""); setCredito(""); setObs("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao publicar matéria");
    } finally {
      setBusy(false); setStep(null);
    }
  }

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0066CC]";
  const labelCls = "block text-xs font-semibold text-slate-600";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Região
          <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} disabled={busy} className={inputCls}>
            <option value="">— selecione —</option>
            {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Editoria
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={busy} className={inputCls}>
            <option value="">— selecione —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      <label className={labelCls}>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={busy}
          placeholder="Ex.: Prefeitura anuncia obras no anel viário de Maringá" className={inputCls} />
      </label>

      <label className={labelCls}>
        Texto da matéria
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={busy} rows={10}
          placeholder="Escreva ou cole o texto completo. A IA cuida de SEO, GEO, TL;DR, 5W1H e FAQ."
          className={`${inputCls} font-mono text-[12px] leading-relaxed`} />
        <span className="mt-1 block text-[10px] text-slate-500">
          {texto.trim().length} caracteres · {texto.trim().split(/\s+/).filter(Boolean).length} palavras
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelCls}>
          Foto de capa (URL, opcional)
          <input type="url" value={imagem} onChange={(e) => setImagem(e.target.value)} disabled={busy}
            placeholder="https://…" className={inputCls} />
        </label>
        <label className={labelCls}>
          Legenda da foto
          <input value={legenda} onChange={(e) => setLegenda(e.target.value)} disabled={busy} className={inputCls} />
        </label>
        <label className={labelCls}>
          Crédito da foto
          <input value={credito} onChange={(e) => setCredito(e.target.value)} disabled={busy}
            placeholder="Foto: Divulgação" className={inputCls} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Fonte/referência (opcional)
          <input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} disabled={busy}
            placeholder="https://…" className={inputCls} />
        </label>
        <label className={labelCls}>
          Observações para a IA (opcional)
          <input value={obs} onChange={(e) => setObs(e.target.value)} disabled={busy}
            placeholder="Ex.: destacar impacto em Maringá" className={inputCls} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={publicarDireto} onChange={(e) => setPublicarDireto(e.target.checked)} disabled={busy} />
          Publicar imediatamente (desmarque para enviar à Fila como rascunho)
        </label>
        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A2540] to-[#0d3a6e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60">
          {busy ? (step ?? "Processando…") : publicarDireto ? "▶ Publicar matéria" : "▶ Enviar para a fila"}
        </button>
        {ok && <span className="text-[11px] font-semibold text-emerald-700">✓ {ok}</span>}
        {err && <span className="text-[11px] font-semibold text-red-700">✗ {err}</span>}
      </div>
    </form>
  );
}