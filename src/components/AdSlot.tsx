import { useEffect, useMemo, useState } from "react";
import { pickAd, type PickedAd } from "@/lib/ads.functions";
import { GamSlot } from "@/components/GamSlot";

/**
 * Hierarquia de preenchimento do slot, do mais valioso pro mais genérico:
 *   1. Venda direta / patrocínio (pickAd() — respeita geo-targeting e cap diário)
 *   2. Programática via Google Ad Manager (GamSlot — só ativa com
 *      VITE_GAM_NETWORK_CODE configurado)
 *   3. House ad / mock — usado apenas se 1 e 2 não preencherem, para nunca
 *      deixar um espaço em branco no layout.
 * TODO: uma vez com o Google Ad Manager configurado, considerar remover o
 * mock em produção e deixar o espaço vazio "colapsar" em vez de mostrar
 * um anúncio falso — hoje ele existe só para visualizar o layout.
 */

type AdSize = "970x90" | "728x90" | "300x250" | "300x600" | "320x50";

type Creative = {
  brand: string;
  headline: string;
  cta: string;
  bg: string; // tailwind gradient classes
  seed: number; // picsum seed
};

const CREATIVES: Creative[] = [
  { brand: "Sicredi", headline: "Crédito rural com taxas exclusivas para produtores do Paraná", cta: "Simule agora", bg: "from-emerald-700 to-emerald-900", seed: 12 },
  { brand: "Copel", headline: "Energia solar residencial: economize até 95% na conta de luz", cta: "Peça orçamento", bg: "from-sky-700 to-sky-900", seed: 24 },
  { brand: "Unimed", headline: "Plano de saúde regional com a maior rede do Paraná", cta: "Contrate online", bg: "from-emerald-800 to-teal-900", seed: 58 },
  { brand: "Renault Paraná", headline: "Kwid 2026 com taxa zero em até 24x. Vem test-drive.", cta: "Agende teste", bg: "from-amber-600 to-orange-800", seed: 71 },
  { brand: "Sesc PR", headline: "Programação cultural gratuita nas unidades de todo o estado", cta: "Ver agenda", bg: "from-indigo-700 to-indigo-900", seed: 82 },
];

const DIMS: Record<AdSize, { w: number; h: number; layout: "wide" | "square" | "tall" }> = {
  "970x90":  { w: 970, h: 90,  layout: "wide" },
  "728x90":  { w: 728, h: 90,  layout: "wide" },
  "320x50":  { w: 320, h: 50,  layout: "wide" },
  "300x250": { w: 300, h: 250, layout: "square" },
  "300x600": { w: 300, h: 600, layout: "tall" },
};

export function AdSlot({
  size,
  className = "",
  regiao,
  cidade,
  editoria,
}: {
  size: AdSize;
  className?: string;
  regiao?: string;
  cidade?: string;
  editoria?: string;
}) {
  const dim = DIMS[size];
  const [real, setReal] = useState<PickedAd | null>(null);
  const [tried, setTried] = useState(false);
  const [gamFilled, setGamFilled] = useState(false);

  // House ad fallback (Sicredi/Copel/etc). Só liga se explicitamente
  // habilitado — em produção o slot vazio colapsa em vez de exibir mock.
  const houseFallback = import.meta.env.VITE_ADS_HOUSE_FALLBACK === "true";

  useEffect(() => {
    let alive = true;
    pickAd({
      data: {
        regiao,
        cidade,
        editoria,
        size,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    })
      .then((r) => { if (alive) { setReal(r); setTried(true); } })
      .catch(() => { if (alive) setTried(true); });
    return () => { alive = false; };
  }, [regiao, cidade, editoria, size]);

  const creative = useMemo(
    () => CREATIVES[Math.floor(Math.abs(hash(size + dim.w)) % CREATIVES.length)],
    [size, dim.w],
  );
  const img = `https://picsum.photos/seed/vozes-${creative.seed}/${dim.w}/${dim.h}`;

  if (real) {
    return (
      <a
        href={real.redirect_url}
        target="_blank"
        rel="sponsored noopener"
        className={`relative block overflow-hidden rounded border border-slate-200 bg-white ${className}`}
        style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
        aria-label={`Publicidade ${size}: ${real.headline}`}
      >
        <img src={real.imagem_url} alt={real.headline} className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          Publicidade
        </span>
      </a>
    );
  }

  if (!tried) {
    return (
      <div
        className={`relative overflow-hidden rounded border border-slate-200 bg-slate-100 ${className}`}
        style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
        aria-hidden
      />
    );
  }

  if (!houseFallback) {
    // Sem venda direta e sem house-ad: renderiza só o GAM. Se o GAM não
    // preencher, o container colapsa (min-height 0) em vez de exibir mock.
    return (
      <div
        className={className}
        style={gamFilled ? { aspectRatio: `${dim.w} / ${dim.h}` } : undefined}
        aria-label={`Publicidade ${size}`}
      >
        <GamSlot size={size} regiao={regiao} cidade={cidade} editoria={editoria} onFillChange={setGamFilled} />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded border border-slate-200 bg-slate-100 ${className}`}
      style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
      aria-label={`Publicidade ${size}`}
    >
      {!gamFilled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <GamSlot size={size} regiao={regiao} cidade={cidade} editoria={editoria} onFillChange={setGamFilled} />
        </div>
      )}
      {gamFilled ? null : (
        <>
          <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className={`absolute inset-0 bg-gradient-to-r ${creative.bg} opacity-80 mix-blend-multiply`} />

          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            Publicidade
          </span>

          {dim.layout === "wide" ? (
            <div className="absolute inset-0 flex items-center gap-4 px-5 text-white">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 text-xs font-black text-slate-900">
                {creative.brand.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider opacity-90">{creative.brand}</p>
                <p className="truncate text-sm font-bold leading-tight sm:text-base">{creative.headline}</p>
              </div>
              <button className="shrink-0 rounded bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">
                {creative.cta}
              </button>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[10px] font-black text-slate-900">
                  {creative.brand.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider">{creative.brand}</p>
              </div>
              <div>
                <p className={`font-display font-bold leading-tight ${dim.layout === "tall" ? "text-2xl" : "text-lg"}`}>
                  {creative.headline}
                </p>
                <button className="mt-3 rounded bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">
                  {creative.cta}
                </button>
              </div>
              <p className="text-[9px] uppercase tracking-widest opacity-80">{size}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}