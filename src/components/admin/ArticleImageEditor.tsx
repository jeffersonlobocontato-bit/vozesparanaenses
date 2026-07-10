import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  articleId: string;
  currentUrl: string | null;
  currentCredito: string | null;
  onUpdated: () => void;
};

export function ArticleImageEditor({ articleId, currentUrl, currentCredito, onUpdated }: Props) {
  const [busy, setBusy] = useState<"ai" | "upload" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
    <div className="mt-3 flex flex-col gap-2 rounded border bg-muted/40 p-2 sm:flex-row sm:items-center">
      <div className="h-20 w-32 shrink-0 overflow-hidden rounded bg-muted">
        {currentUrl ? (
          <img src={currentUrl} alt="capa" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sem imagem</div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateWithAI}
            disabled={busy !== null}
            className="rounded bg-[#0A2540] px-3 py-1 font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
          >
            {busy === "ai" ? "Gerando…" : "🎨 Gerar com IA"}
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
        {currentCredito && <span className="text-muted-foreground">{currentCredito}</span>}
        {msg && <span className="text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}