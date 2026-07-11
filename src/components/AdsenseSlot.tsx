import { useEffect, useRef, useSyncExternalStore } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Slot do Google AdSense (ca-pub-3867318545397573).
 *
 * O <ins> só é inserido após a hidratação, por meio de useSyncExternalStore,
 * garantindo que o HTML do servidor e o primeiro render do cliente sejam
 * idênticos (um <div> placeholder). O push no array adsbygoogle acontece
 * somente quando o slot real é montado.
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
  const hydrated = useHydrated();
  const pushed = useRef(false);

  useEffect(() => {
    if (!hydrated || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle ainda não disponível — ignora
    }
  }, [hydrated]);

  if (!hydrated) return <div className={className} style={style} aria-hidden />;

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