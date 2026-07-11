import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
  const insRef = useRef<HTMLModElement | null>(null);
  const [status, setStatus] = useState<"pending" | "filled" | "unfilled">(
    "pending",
  );

  useEffect(() => {
    if (!hydrated || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle ainda não disponível — ignora
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const el = insRef.current;
    if (!el) return;
    const check = () => {
      const s = el.getAttribute("data-ad-status");
      if (s === "filled") setStatus("filled");
      else if (s === "unfilled") setStatus("unfilled");
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    const timeout = window.setTimeout(() => {
      if (!el.getAttribute("data-ad-status")) setStatus("unfilled");
    }, 4000);
    return () => {
      obs.disconnect();
      window.clearTimeout(timeout);
    };
  }, [hydrated]);

  if (!hydrated) return null;
  if (status === "unfilled") return null;

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: "block", minHeight: status === "filled" ? undefined : 1, ...style }}
      data-ad-client="ca-pub-3867318545397573"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
}