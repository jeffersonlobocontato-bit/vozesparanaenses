import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listRegions } from "@/lib/content.functions";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Cache em memória (dura a sessão da aba) do slug → id da região, pra não
// buscar a lista de regiões a cada pageview.
let regionMapPromise: Promise<Map<string, string>> | null = null;
function getRegionMap(): Promise<Map<string, string>> {
  if (!regionMapPromise) {
    regionMapPromise = listRegions()
      .then((regs) => new Map(regs.map((r) => [r.slug, r.id])))
      .catch(() => new Map());
  }
  return regionMapPromise;
}

// Classifica a origem do tráfego a partir do referrer — inclui uma categoria
// "ia" separada de "busca", porque distinguir quem chegou via ChatGPT/
// Perplexity de quem chegou via Google é exatamente o tipo de dado que
// justifica o investimento em otimização para buscadores de IA (Camada 9).
function classificarOrigem(referrer: string, host: string): string {
  if (!referrer) return "direto";
  let refHost = "";
  try { refHost = new URL(referrer).hostname.replace(/^www\./, ""); } catch { return "outro"; }
  if (refHost === host) return "direto";
  if (/chatgpt\.com|perplexity\.ai|copilot\.microsoft|gemini\.google/.test(refHost)) return "ia";
  if (/google\.|bing\.com|duckduckgo\.com|yahoo\./.test(refHost)) return "busca";
  if (/wa\.me|api\.whatsapp|web\.whatsapp/.test(refHost)) return "whatsapp";
  if (/facebook\.|instagram\.|twitter\.com|x\.com|t\.co|tiktok\.com|linkedin\./.test(refHost)) return "social";
  return "outro";
}

async function trackPageview(pathname: string) {
  // GA4: como o site navega por rotas client-side (sem recarregar a página),
  // o pageview automático do gtag só dispararia uma vez, no primeiro
  // carregamento. Desativamos esse automático (send_page_view: false, no
  // __root.tsx) e disparamos manualmente aqui, a cada troca de rota — sem
  // isso, o GA4 subcontaria quase todo o tráfego real do site.
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: typeof document !== "undefined" ? document.title : undefined,
    });
  }

  try {
    const parts = pathname.split("/").filter(Boolean);
    const regionMap = await getRegionMap();
    const regiaoSlug = parts[0];
    const regiao_id = regiaoSlug ? regionMap.get(regiaoSlug) ?? null : null;
    // /regiao/editoria/categoria ou /regiao/cidade/slug — só marca categoria
    // quando o segundo pedaço bate com o padrão conhecido de editoria.
    const categoria = parts[1] === "editoria" ? parts[2] ?? null : null;
    const cidade = parts[1] === "cidade" ? parts[2] ?? null : null;

    const origem_trafego = classificarOrigem(
      typeof document !== "undefined" ? document.referrer : "",
      typeof window !== "undefined" ? window.location.hostname : "",
    );

    // A cidade do leitor (por geolocalização de IP) só pode ser resolvida no
    // servidor — o navegador nunca tem acesso ao IP de quem o está usando.
    // Por isso isso vai pra uma Edge Function em vez de gravar direto aqui.
    await supabase.functions.invoke("track-pageview", {
      body: { regiao_id, categoria, cidade, tipo_evento: "pageview", pagina: pathname, origem_trafego },
    });
  } catch {
    // Analytics nunca deve quebrar a navegação do leitor — falha em silêncio.
  }
}

/**
 * Monte isso uma vez no layout raiz (__root.tsx). Dispara um evento de
 * pageview (próprio + GA4) a cada mudança de rota, sem bloquear a
 * renderização.
 */
export function PageviewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    // Não bloqueia: dispara e esquece.
    void trackPageview(pathname);
  }, [pathname]);

  return null;
}
