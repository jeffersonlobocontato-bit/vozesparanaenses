import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

function parseFormato(formato: string): { w: number; h: number } {
  const [w, h] = formato.split("x").map(Number);
  return { w, h };
}

/** Mostra a imagem escolhida já encaixada na proporção real do espaço,
 * exatamente como o `AdSlot` renderiza em produção (object-contain — a
 * imagem inteira aparece, sem cortar; se a proporção não bater, sobra
 * tarja em cima/embaixo ou nas laterais, e é isso que queremos que o
 * operador veja ANTES de confirmar o upload). */
export function CreativeFitPreview({ file, formato }: { file: File | null; formato: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); setNaturalDims(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file || !previewUrl) return null;

  const target = parseFormato(formato);
  const targetRatio = target.w / target.h;
  const realRatio = naturalDims ? naturalDims.w / naturalDims.h : targetRatio;
  const diffPct = Math.abs(realRatio - targetRatio) / targetRatio;
  const proporcaoOk = diffPct <= 0.08;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Como fica no espaço ({formato})
      </p>
      <div
        className="mx-auto flex items-center justify-center overflow-hidden rounded border border-slate-300 bg-[repeating-conic-gradient(#e2e8f0_0%_25%,white_0%_50%)] bg-[length:16px_16px]"
        style={{ aspectRatio: `${target.w} / ${target.h}`, maxWidth: "100%" }}
      >
        <img src={previewUrl} alt="Pré-visualização do criativo" className="h-full w-full object-contain" />
      </div>
      {naturalDims && (
        proporcaoOk ? (
          <p className="flex items-start gap-1 text-[11px] text-emerald-700">
            <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {naturalDims.w}×{naturalDims.h}px: proporção compatível com {formato}.
          </p>
        ) : (
          <p className="flex items-start gap-1 text-[11px] text-amber-700">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {naturalDims.w}×{naturalDims.h}px não tem a proporção de {formato}: vai sobrar faixa vazia nas laterais
              ou em cima e embaixo, como mostrado acima. Recorte a imagem antes de enviar.
            </span>
          </p>
        )
      )}
    </div>
  );
}
