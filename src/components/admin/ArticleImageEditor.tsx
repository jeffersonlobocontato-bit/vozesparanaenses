import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

type Props = {
  articleId: string;
  currentUrl: string | null;
  originalUrl: string | null;
  currentCredito: string | null;
  currentLegenda: string | null;
  onUpdated: () => void;
};

export function ArticleImageEditor({ articleId, currentUrl, originalUrl, currentCredito, currentLegenda, onUpdated }: Props) {
  const [busy, setBusy] = useState<"ai" | "upload" | "original" | "meta" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [legenda, setLegenda] = useState(currentLegenda ?? "");
  const [credito, setCredito] = useState(currentCredito ?? "");
  const usingOriginal = !!originalUrl && currentUrl === originalUrl;

  useEffect(() => { setLegenda(currentLegenda ?? ""); }, [currentLegenda]);
  useEffect(() => { setCredito(currentCredito ?? ""); }, [currentCredito]);

  const metaDirty =
    (legenda.trim() || null) !== (currentLegenda?.trim() || null) ||
    (credito.trim() || null) !== (currentCredito?.trim() || null);

  async function saveMeta() {
    setBusy("meta"); setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb
        .from("generated_articles")
        .update({
          imagem_legenda: legenda.trim() || null,
          imagem_credito: credito.trim() || null,
        })
        .eq("id", articleId);
      if (error) {
        if (/column .* imagem_legenda .* does not exist/i.test(error.message)) {
          throw new Error("Coluna imagem_legenda ainda não existe — rode a migração 044_legendas_creditos.sql.");
        }
        throw error;
      }
      setMsg("Legenda/crédito salvos.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  async function useOriginal() {
    setBusy("original"); setMsg("Restaurando foto original…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-article-image", {
        body: { article_id: articleId, mode: "original" },
      });
      if (error) throw error;
      const d = data as { error?: string; detail?: string };
      if (d?.error) throw new Error(d.error + (d.detail ? `: ${d.detail}` : ""));
      setMsg("Foto original definida como capa.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  async function generateWithAI() {
    setBusy("ai"); setMsg("Gerando imagem com IA (leve variação da original)…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-article-image", {
        body: { article_id: articleId, mode: "ai" },
      });
      if (error) throw error;
      const d = data as { error?: string; detail?: string; url?: string };
      if (d?.error) throw new Error(d.error + (d.detail ? `: ${d.detail}` : ""));
      setMsg("Imagem gerada.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  async function handleUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) { setMsg("Arquivo acima de 8MB."); return; }
    setBusy("upload"); setMsg("Enviando imagem…");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("generate-article-image", {
        body: { article_id: articleId, mode: "upload", base64: b64, mime: file.type },
      });
      if (error) throw error;
      const d = data as { error?: string; detail?: string };
      if (d?.error) throw new Error(d.error + (d.detail ? `: ${d.detail}` : ""));
      setMsg("Imagem enviada.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded border bg-muted/40 p-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded border bg-muted">
            {currentUrl ? (
              <img src={currentUrl} alt="capa atual" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sem imagem</div>
            )}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Capa atual</span>
        </div>
        {originalUrl && (
          <div className="flex flex-col items-center gap-1">
            <div className={`relative h-20 w-32 shrink-0 overflow-hidden rounded border bg-muted ${usingOriginal ? "ring-2 ring-[#0A2540]" : ""}`}>
              <img src={originalUrl} alt="foto original scraping" className="h-full w-full object-cover" />
              {usingOriginal && (
                <span className="absolute right-1 top-1 rounded bg-[#0A2540] px-1.5 py-0.5 text-[9px] font-bold text-white">EM USO</span>
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Foto original (fonte)</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex flex-wrap gap-2">
          {originalUrl && (
            <button
              onClick={useOriginal}
              disabled={busy !== null || usingOriginal}
              className="rounded border border-[#0A2540] px-3 py-1 font-semibold text-[#0A2540] hover:bg-[#0A2540]/10 disabled:opacity-60"
              title="Usa a foto original da fonte já copiada para o storage"
            >
              {busy === "original" ? "Aplicando…" : usingOriginal ? "✓ Usando original" : "📷 Usar original"}
            </button>
          )}
          <button
            onClick={generateWithAI}
            disabled={busy !== null}
            className="rounded bg-[#0A2540] px-3 py-1 font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
            title={originalUrl ? "Gera uma variação com IA a partir da foto original" : "Gera uma imagem editorial com IA"}
          >
            {busy === "ai" ? "Gerando…" : originalUrl ? "🎨 Variação IA da original" : "🎨 Gerar com IA"}
          </button>
          <label className="cursor-pointer rounded border px-3 py-1 hover:bg-accent">
            {busy === "upload" ? "Enviando…" : "⬆ Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Legenda da foto
            </label>
            <input
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Ex.: Bombeiros combatem incêndio em Cascavel na manhã desta segunda-feira."
              className="rounded border bg-background px-2 py-1 text-xs"
              disabled={busy !== null}
            />
            <label className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Crédito da foto
            </label>
            <input
              value={credito}
              onChange={(e) => setCredito(e.target.value)}
              placeholder="Ex.: Foto: João Silva / Prefeitura de Cascavel"
              className="rounded border bg-background px-2 py-1 text-xs"
              disabled={busy !== null}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveMeta}
              disabled={busy !== null || !metaDirty}
              className="rounded bg-[#0A2540] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
            >
              {busy === "meta" ? "Salvando…" : "💾 Salvar legenda/crédito"}
            </button>
          </div>
        </div>
        {!originalUrl && (
          <span className="text-[10px] italic text-muted-foreground">
            Sem foto original — a fonte não trouxe imagem no scraping.
          </span>
        )}
        {msg && <span className="text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}