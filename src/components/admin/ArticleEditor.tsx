import { useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

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
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

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
      const patch = {
        titulo: form.titulo.trim(),
        subtitulo: form.subtitulo.trim() || null,
        resumo: form.resumo.trim() || null,
        corpo: form.corpo,
        slug: form.slug.trim(),
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
      };
      const { error } = await sb.from("generated_articles").update(patch).eq("id", articleId);
      if (error) throw error;
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
