import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

type Props = {
  articleId: string;
  currentUrl: string | null;
  originalUrl: string | null;
  currentCredito: string | null;
  currentLegenda: string | null;
  currentGaleria?: { url: string; legenda?: string | null; credito?: string | null }[] | null;
  onUpdated: () => void;
};

const MAX_UPLOAD_BYTES = 2.8 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1800;
const MIN_JPEG_QUALITY = 0.58;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui ler esta imagem. Se for HEIC/HEIF, converta para JPG ou PNG."));
    };
    img.src = url;
  });
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Arquivo inválido — selecione uma imagem.");
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    throw new Error("Fotos HEIC/HEIF do iPhone não são suportadas pelo navegador. Envie em JPG ou PNG.");
  }

  const img = await readImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não permitiu comprimir a imagem.");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = file.size > MAX_UPLOAD_BYTES || scale < 1 ? 0.82 : 0.9;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > MIN_JPEG_QUALITY) {
    quality = Math.max(MIN_JPEG_QUALITY, quality - 0.08);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("Falha ao comprimir a imagem.");

  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-") || "foto";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export function ArticleImageEditor({ articleId, currentUrl, originalUrl, currentCredito, currentLegenda, currentGaleria, onUpdated }: Props) {
  const [busy, setBusy] = useState<"ai" | "upload" | "original" | "meta" | "remove" | "gal-add" | "gal-save" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [legenda, setLegenda] = useState(currentLegenda ?? "");
  const [credito, setCredito] = useState(currentCredito ?? "");
  const [galeria, setGaleria] = useState<{ url: string; legenda?: string | null; credito?: string | null }[]>(currentGaleria ?? []);
  const usingOriginal = !!originalUrl && currentUrl === originalUrl;

  useEffect(() => { setLegenda(currentLegenda ?? ""); }, [currentLegenda]);
  useEffect(() => { setCredito(currentCredito ?? ""); }, [currentCredito]);
  useEffect(() => { setGaleria(currentGaleria ?? []); }, [currentGaleria]);

  async function removeCover() {
    if (!confirm("Publicar matéria sem foto de capa? A imagem atual será removida.")) return;
    setBusy("remove"); setMsg("Removendo capa…");
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb
        .from("generated_articles")
        .update({ imagem_capa_url: null, imagem_legenda: null, imagem_credito: null })
        .eq("id", articleId);
      if (error) throw error;
      setMsg("Capa removida — matéria sem foto.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  async function uploadToStorage(file: File): Promise<string> {
    const sb = await getExternalBrowser();
    const prepared = await compressImageForUpload(file);
    const ext = (prepared.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `galeria/${articleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage.from("article-covers").upload(path, prepared, {
      contentType: prepared.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data } = sb.storage.from("article-covers").getPublicUrl(path);
    return data.publicUrl;
  }

  async function addGaleriaFiles(files: File[]) {
    setBusy("gal-add"); setMsg("Enviando fotos para a galeria…");
    try {
      const selected = files;
      const sb = await getExternalBrowser();
      const novas = [...galeria];
      let enviadas = 0;
      for (const f of selected) {
        try {
          setMsg(`Preparando e comprimindo "${f.name}" (${formatBytes(f.size)})…`);
          const url = await uploadToStorage(f);
          novas.push({ url, legenda: null, credito: null });
          enviadas++;
          setMsg(`Enviando fotos para a galeria… (${enviadas}/${selected.length})`);
        } catch (upErr: unknown) {
          const msgErr = upErr instanceof Error ? upErr.message : String(upErr);
          console.error("[galeria] upload falhou para", f.name, upErr);
          throw new Error(`Upload de "${f.name}" falhou: ${msgErr}`);
        }
      }
      if (enviadas === 0) {
        setMsg("Nenhuma foto foi enviada. Confira se os arquivos são JPG/PNG/WebP válidos.");
        return;
      }
      const { error } = await sb.from("generated_articles").update({ imagem_galeria: novas }).eq("id", articleId);
      if (error) {
        console.error("[galeria] update imagem_galeria falhou", error);
        if (/column .*imagem_galeria.* does not exist/i.test(error.message)) {
          throw new Error(
            "A coluna imagem_galeria ainda não existe no banco. Rode a migração supabase-external/045_galeria.sql no Supabase externo e tente de novo.",
          );
        }
        throw error;
      }
      setGaleria(novas);
      setMsg(`Galeria atualizada (${novas.length} foto(s)).`);
      onUpdated();
    } catch (e: unknown) {
      console.error("[galeria] addGaleriaFiles error", e);
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  async function saveGaleria(next: typeof galeria) {
    setBusy("gal-save"); setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles").update({ imagem_galeria: next }).eq("id", articleId);
      if (error) throw error;
      setGaleria(next);
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

  function moveGaleria(idx: number, dir: -1 | 1) {
    const next = [...galeria];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    void saveGaleria(next);
  }

  function removeGaleriaItem(idx: number) {
    if (!confirm("Remover esta foto da galeria?")) return;
    const next = galeria.filter((_, i) => i !== idx);
    void saveGaleria(next);
  }

  async function setAsCover(idx: number) {
    const item = galeria[idx];
    if (!item) return;
    setBusy("gal-save"); setMsg("Definindo como capa…");
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("generated_articles").update({
        imagem_capa_url: item.url,
        imagem_legenda: item.legenda ?? null,
        imagem_credito: item.credito ?? null,
      }).eq("id", articleId);
      if (error) throw error;
      setMsg("Foto definida como capa.");
      onUpdated();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally { setBusy(null); }
  }

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
    setBusy("upload"); setMsg(`Preparando e comprimindo imagem (${formatBytes(file.size)})…`);
    try {
      const prepared = await compressImageForUpload(file);
      setMsg(`Enviando imagem comprimida (${formatBytes(prepared.size)})…`);
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(prepared);
      });
      const { data, error } = await supabase.functions.invoke("generate-article-image", {
        body: { article_id: articleId, mode: "upload", base64: b64, mime: prepared.type },
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
          {currentUrl && (
            <button
              type="button"
              onClick={removeCover}
              disabled={busy !== null}
              className="rounded border border-red-600 px-3 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              title="Publica a matéria sem foto de capa"
            >
              {busy === "remove" ? "Removendo…" : "🗑 Publicar sem foto"}
            </button>
          )}
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

      {/* Galeria de fotos */}
      <div className="mt-3 rounded border border-[#0A2540]/20 bg-white p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#0A2540]">
            Galeria ({galeria.length})
          </span>
          <label className="cursor-pointer rounded bg-[#0A2540] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#0d2f52]">
            {busy === "gal-add" ? "Enviando…" : "+ Adicionar fotos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                if (fs.length) void addGaleriaFiles(fs);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {galeria.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground">
            Nenhuma foto na galeria. A foto #1 sempre será o destaque (capa da matéria).
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {galeria.map((g, i) => (
              <div key={g.url + i} className="flex flex-col gap-1 rounded border bg-muted/30 p-1">
                <div className="relative h-24 w-full overflow-hidden rounded bg-muted">
                  <img src={g.url} alt={g.legenda ?? `Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-[#0A2540] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    #{i + 1}{i === 0 ? " (destaque)" : ""}
                  </span>
                </div>
                <input
                  value={g.legenda ?? ""}
                  onChange={(e) => {
                    const next = [...galeria];
                    next[i] = { ...next[i], legenda: e.target.value };
                    setGaleria(next);
                  }}
                  onBlur={() => saveGaleria(galeria)}
                  placeholder="Legenda"
                  className="rounded border bg-white px-1.5 py-1 text-[10px]"
                  disabled={busy !== null}
                />
                <input
                  value={g.credito ?? ""}
                  onChange={(e) => {
                    const next = [...galeria];
                    next[i] = { ...next[i], credito: e.target.value };
                    setGaleria(next);
                  }}
                  onBlur={() => saveGaleria(galeria)}
                  placeholder="Crédito"
                  className="rounded border bg-white px-1.5 py-1 text-[10px]"
                  disabled={busy !== null}
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => moveGaleria(i, -1)}
                    disabled={busy !== null || i === 0}
                    className="rounded border px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    title="Mover para cima"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => moveGaleria(i, 1)}
                    disabled={busy !== null || i === galeria.length - 1}
                    className="rounded border px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    title="Mover para baixo"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => setAsCover(i)}
                    disabled={busy !== null}
                    className="rounded border border-[#0A2540] px-1.5 py-0.5 text-[10px] font-semibold text-[#0A2540] disabled:opacity-40"
                    title="Definir esta foto como capa"
                  >★ Capa</button>
                  <button
                    type="button"
                    onClick={() => removeGaleriaItem(i)}
                    disabled={busy !== null}
                    className="rounded border border-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 disabled:opacity-40"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}