import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Slot do Google AdSense (ca-pub-3867318545397573).
 * Renderiza apenas no cliente para evitar mismatch de hidratação —
 * o script do AdSense injeta atributos/estilos no <ins> assim que carrega.
 */
export function AdsenseSlot({
  slot,
  format = "auto",
  fullWidthResponsive = true,
  className = "",
  style,
}: {
  slot: string;
  format?: string;
  fullWidthResponsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);
  const pushed = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle ainda não disponível — ignora
    }
  }, [mounted]);

  if (!mounted) return <div className={className} style={style} aria-hidden />;

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-3867318545397573"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
}