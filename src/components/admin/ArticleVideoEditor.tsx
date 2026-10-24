import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { parseVideoEmbed } from "@/lib/video-embed";
import { Save, Trash2, Upload, Video } from "lucide-react";
import { btn, campoClass } from "@/components/admin/ui";

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

  const rotulo = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const campo = `${campoClass} w-full text-xs`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 ${rotulo}`}>
          <Video className="h-3.5 w-3.5" /> Vídeo da matéria
        </span>
        {currentUrl && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              save(null);
            }}
            disabled={busy !== null}
            className={btn("danger", "sm")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover vídeo
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link do YouTube, Vimeo ou de um arquivo MP4"
          className={`${campoClass} min-w-[240px] flex-1`}
          disabled={busy !== null}
        />
        <button
          type="button"
          onClick={() => save(url.trim() || null)}
          disabled={busy !== null || url.trim() === (currentUrl ?? "")}
          className={btn("primary")}
        >
          <Save className="h-4 w-4" />
          {busy === "save" ? "Salvando…" : "Salvar link"}
        </button>
        <label className={`${btn("secondary")} cursor-pointer`}>
          <Upload className="h-4 w-4" />
          {busy === "upload" ? "Enviando…" : "Enviar vídeo"}
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
        <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-black">
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
          className="w-full max-w-md rounded-lg border border-slate-200 bg-black"
          src={preview.src}
        />
      )}
      {url && !preview && (
        <p className="text-[11px] text-amber-700">
          Link não reconhecido. Use YouTube, Vimeo ou um arquivo .mp4, .webm, .ogg ou .mov.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label className={rotulo}>Legenda do vídeo</label>
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Ex.: Momento em que a equipe da PRF aborda o veículo suspeito."
            className={campo}
            disabled={busy !== null}
          />
          <label className={`mt-1 ${rotulo}`}>Crédito do vídeo</label>
          <input
            value={credito}
            onChange={(e) => setCredito(e.target.value)}
            placeholder="Ex.: Vídeo: PRF / Divulgação"
            className={campo}
            disabled={busy !== null}
          />
        </div>
        <button
          type="button"
          onClick={saveMeta}
          disabled={busy !== null || !metaDirty}
          className={btn("primary", "sm")}
        >
          <Save className="h-3.5 w-3.5" />
          {busy === "meta" ? "Salvando…" : "Salvar legenda e crédito"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Vídeos longos: hospede no YouTube ou Vimeo e cole o link. Envio direto só para clipes curtos (até 200 MB).
      </p>
      {msg && <span className={`text-[11px] ${msg.startsWith("Falha") ? "text-red-700" : "text-slate-600"}`}>{msg}</span>}
    </div>
  );
}
