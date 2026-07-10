import { useEffect, useId, useRef } from "react";

/**
 * Camada programática (Google Ad Manager / GPT) — preenche o slot quando
 * não há campanha direta ativa para aquela posição (ver AdSlot.tsx, que
 * consulta `pickAd()` primeiro; isso aqui é o segundo degrau da hierarquia
 * de prioridade: 1) patrocínio/venda direta → 2) programática → 3) house ad).
 *
 * Sem configuração, este componente não faz nada (retorna null) e o AdSlot
 * cai direto para o house ad/mock — então é seguro ter isso no código antes
 * mesmo de existir uma conta Google Ad Manager configurada.
 *
 * PARA ATIVAR:
 *   1. Crie uma conta em admanager.google.com (gratuita até certo volume).
 *   2. Anote o "network code" (número, ex.: 123456789).
 *   3. Crie um ad unit chamado exatamente "vozesparanaenses" com os
 *      tamanhos: 970x90, 728x90, 320x50, 300x250, 300x600.
 *   4. Defina VITE_GAM_NETWORK_CODE=123456789 no .env do projeto.
 */

const NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE as string | undefined;

declare global {
  interface Window {
    googletag: any;
  }
}

const SIZE_MAP = {
  "970x90": [970, 90],
  "728x90": [728, 90],
  "320x50": [320, 50],
  "300x250": [300, 250],
  "300x600": [300, 600],
} as const;

type GamSize = keyof typeof SIZE_MAP;

let gptLoadPromise: Promise<void> | null = null;
function loadGpt(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  window.googletag = window.googletag || ({ cmd: [] } as any);
  if (window.googletag.apiReady) return Promise.resolve();
  if (gptLoadPromise) return gptLoadPromise;
  gptLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // falha de rede/adblock não deve travar a página
    document.head.appendChild(script);
  });
  return gptLoadPromise;
}

export function GamSlot({
  size,
  regiao,
  cidade,
  editoria,
  onFillChange,
}: {
  size: GamSize;
  regiao?: string;
  cidade?: string;
  editoria?: string;
  onFillChange: (filled: boolean) => void;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const domId = `gam-slot-${rawId}`;
  const slotRef = useRef<any>(null);
  const onFillChangeRef = useRef(onFillChange);
  onFillChangeRef.current = onFillChange;

  useEffect(() => {
    if (!NETWORK_CODE) {
      onFillChangeRef.current(false);
      return;
    }
    let destroyed = false;

    loadGpt().then(() => {
      if (destroyed) return;
      const gt = window.googletag;
      if (!gt?.cmd) { onFillChangeRef.current(false); return; }

      gt.cmd.push(() => {
        if (destroyed) return;
        const adUnitPath = `/${NETWORK_CODE}/vozesparanaenses`;
        const slot = gt.defineSlot(adUnitPath, [SIZE_MAP[size]], domId);
        if (!slot) { onFillChangeRef.current(false); return; }

        slot.addService(gt.pubads());
        if (regiao) slot.setTargeting("regiao", regiao);
        if (cidade) slot.setTargeting("cidade", cidade);
        if (editoria) slot.setTargeting("editoria", editoria);
        slotRef.current = slot;

        gt.pubads().addEventListener("slotRenderEnded", (event: any) => {
          if (event.slot === slot && !destroyed) onFillChangeRef.current(!event.isEmpty);
        });
        gt.pubads().enableSingleRequest();
        gt.enableServices();
        gt.display(domId);
      });
    });

    return () => {
      destroyed = true;
      if (slotRef.current) {
        try { window.googletag?.destroySlots?.([slotRef.current]); } catch { /* noop */ }
      }
    };
  }, [size, regiao, cidade, editoria, domId]);

  if (!NETWORK_CODE) return null;
  return <div id={domId} style={{ width: SIZE_MAP[size][0], height: SIZE_MAP[size][1] }} />;
}
