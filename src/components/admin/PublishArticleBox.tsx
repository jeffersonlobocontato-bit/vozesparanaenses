import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

type Categoria = { id: string; nome: string; slug: string };
type Regiao = { id: string; nome: string; slug: string };

/**
 * Card "Publicar matéria": o texto enviado é publicado LITERALMENTE, sem
 * reescrita da IA. A IA entra só para autopreencher os metadados de
 * indexação — SEO (title/description/slug), GEO (cidade/JSON-LD), TL;DR,
 * 5W1H e FAQ. Diferente do "Redator manual", que reescreve a partir de um
 * link ou texto-fonte.
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
  const [subtitulo, setSubtitulo] = useState("");
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
    if (texto.trim().length < 120) { setErr("O texto precisa ter ao menos 120 caracteres."); return; }
    if (!regiaoId) { setErr("Escolha a região."); return; }
    if (!categoriaId) { setErr("Escolha a editoria."); return; }

    setBusy(true);
    setStep("Montando SEO e GEO (o texto não será alterado)…");
    try {
      const { data, error } = await supabase.functions.invoke("publish-article", {
        body: {
          titulo: titulo.trim(),
          texto: texto.trim(),
          subtitulo: subtitulo.trim() || undefined,
          fonte_url: fonteUrl.trim() || undefined,
          regiao_id: regiaoId,
          categoria_id: categoriaId,
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
      setTitulo(""); setTexto(""); setSubtitulo(""); setFonteUrl(""); setImagem(""); setLegenda(""); setCredito("");
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
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
        O texto abaixo é publicado <strong>exatamente como você escreveu</strong> — a IA não reescreve
        nem resume o corpo. Ela só monta os metadados de indexação (SEO, GEO, TL;DR, 5W1H e FAQ).
        Para que a IA <em>escreva</em> a matéria a partir de um link ou texto-fonte, use o
        “Redator manual” na Fila editorial.
      </p>
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
        Subtítulo (opcional)
        <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} disabled={busy}
          placeholder="Linha de apoio, até 160 caracteres" className={inputCls} />
      </label>

      <label className={labelCls}>
        Texto final da matéria (publicado sem alteração)
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={busy} rows={10}
          placeholder="Cole aqui o texto pronto. Ele vai ao ar palavra por palavra como está."
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

      <label className={labelCls}>
        Fonte/referência (opcional)
        <input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} disabled={busy}
          placeholder="https://…" className={inputCls} />
      </label>

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