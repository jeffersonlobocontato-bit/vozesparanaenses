import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Slot do Google AdSense (ca-pub-3867318545397573).
 *
 * Renderiza o <ins> tanto no SSR quanto no cliente para evitar troca de tag
 * durante a hidratação. O push no array adsbygoogle só acontece no cliente,
 * após a montagem, e `suppressHydrationWarning` evita alertas quando o script
 * do AdSense injeta atributos/iframe no elemento antes do React terminar.
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
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle ainda não disponível — ignora
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block", ...style }}
      data-ad-client="ca-pub-3867318545397573"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      suppressHydrationWarning
    />
  );
}