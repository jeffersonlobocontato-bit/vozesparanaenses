import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { parseVideoEmbed } from "@/lib/video-embed";

type Props = {
  articleId: string;
  currentUrl: string | null;
  currentLegenda: string | null;
  currentCredito: string | null;
  onUpdated: () => void;
};

export function ArticleVideoEditor({ articleId, currentUrl, currentLegenda, currentCredito, onUpdated }: Props) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [legenda, setLegenda] = useState(currentLegenda ?? "");
  const [credito, setCredito] = useState(currentCredito ?? "");
  const [busy, setBusy] = useState<"save" | "upload" | "clear" | "meta" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setUrl(currentUrl ?? "");
  }, [currentUrl]);
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
          video_legenda: legenda.trim() || null,
          video_credito: credito.trim() || null,
        })
        .eq("id", articleId);
      if (error) {
        if (/column .* (video_legenda|video_credito) .* does not exist/i.test(error.message)) {
          throw new Error("Colunas video_legenda/video_credito ainda não existem — rode a migração 044_legendas_creditos.sql.");
        }
        throw error;
      }
      setMsg("Legenda/crédito do vídeo salvos.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  const preview = parseVideoEmbed(url);

  async function save(nextUrl: string | null) {
    setBusy("save");
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb
        .from("generated_articles")
        .update({ video_embed_url: nextUrl })
        .eq("id", articleId);
      if (error) {
        if (/column .* video_embed_url .* does not exist/i.test(error.message)) {
          throw new Error(
            "Coluna video_embed_url ainda não existe — rode a migração 043_video.sql.",
          );
        }
        throw error;
      }
      setMsg(nextUrl ? "Vídeo salvo." : "Vídeo removido.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File) {
    if (file.size > 200 * 1024 * 1024) {
      setMsg("Arquivo acima de 200MB — hospede em YouTube/Vimeo e cole a URL.");
      return;
    }
    setBusy("upload");
    setMsg("Enviando vídeo…");
    try {
      const sb = await getExternalBrowser();
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${articleId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("article-videos")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from("article-videos").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      setUrl(publicUrl);
      await save(publicUrl);
    } catch (e: unknown) {
      setMsg("Falha no upload: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded border bg-muted/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          🎬 Vídeo da matéria
        </span>
        {currentUrl && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              save(null);
            }}
            disabled={busy !== null}
            className="text-[11px] text-red-600 hover:underline disabled:opacity-60"
          >
            Remover
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole URL do YouTube, Vimeo ou MP4"
          className="min-w-[240px] flex-1 rounded border bg-background px-2 py-1.5 text-sm"
          disabled={busy !== null}
        />
        <button
          type="button"
          onClick={() => save(url.trim() || null)}
          disabled={busy !== null || url.trim() === (currentUrl ?? "")}
          className="rounded bg-[#0A2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
        >
          {busy === "save" ? "Salvando…" : "Salvar URL"}
        </button>
        <label className="cursor-pointer rounded border px-3 py-1.5 text-xs hover:bg-accent">
          {busy === "upload" ? "Enviando…" : "⬆ Upload de vídeo"}
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
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
      {preview && preview.kind !== "file" && (
        <div className="aspect-video w-full max-w-md overflow-hidden rounded border bg-black">
          <iframe
            src={preview.embedUrl}
            title="Prévia do vídeo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
      {preview && preview.kind === "file" && (
        <video
          controls
          className="w-full max-w-md rounded border bg-black"
          src={preview.src}
        />
      )}
      {url && !preview && (
        <p className="text-[11px] text-amber-700">
          URL não reconhecida. Use YouTube, Vimeo ou um arquivo .mp4/.webm/.ogg/.mov.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Legenda do vídeo
          </label>
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Ex.: Momento em que a equipe da PRF aborda o veículo suspeito."
            className="rounded border bg-background px-2 py-1 text-xs"
            disabled={busy !== null}
          />
          <label className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Crédito do vídeo
          </label>
          <input
            value={credito}
            onChange={(e) => setCredito(e.target.value)}
            placeholder="Ex.: Vídeo: PRF / Divulgação"
            className="rounded border bg-background px-2 py-1 text-xs"
            disabled={busy !== null}
          />
        </div>
        <button
          type="button"
          onClick={saveMeta}
          disabled={busy !== null || !metaDirty}
          className="rounded bg-[#0A2540] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
        >
          {busy === "meta" ? "Salvando…" : "💾 Salvar legenda/crédito"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Recomendado: hospede vídeos longos no YouTube/Vimeo e cole a URL. Upload direto só para clipes curtos (até 200MB).
      </p>
      {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
    </div>
  );
}