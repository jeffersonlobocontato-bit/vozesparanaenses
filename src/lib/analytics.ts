import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listRegions } from "@/lib/content.functions";
import { getConsentimento, carregarGA4 } from "@/lib/cookie-consent";

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
function classificarOrigem(referrer: string, host: string, search = ""): string {
  // UTM manda (link da bio do Instagram, links compartilhados): o navegador
  // interno do Instagram/WhatsApp não informa referrer.
  const utm = new URLSearchParams(search).get("utm_source")?.toLowerCase() ?? "";
  if (utm === "whatsapp") return "whatsapp";
  // Endereço curto digitado (/toledo visto no card, rádio, impresso).
  if (utm === "atalho") return "atalho";
  if (/instagram|facebook|telegram|twitter|^x$|tiktok|threads|linkedin/.test(utm)) return "social";
  if (utm) return "outro";
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

// ---------------------------------------------------------------------------
// Contexto editorial da página (dimensões personalizadas do GA4, escopo de
// evento: regiao, editoria, cidade, tipo_conteudo, autoria, data_publicacao).
// Páginas de matéria publicam o próprio contexto com definirContextoPagina;
// o page_view dessas rotas espera por ele (até 8 s — na primeira visita a
// matéria só monta depois de carregar os dados) antes de sair.
// ---------------------------------------------------------------------------

export type ContextoPagina = {
  regiao?: string | null;
  editoria?: string | null;
  cidade?: string | null;
  tipo_conteudo?: "materia" | "nota" | "coluna" | "home" | "regiao" | "editoria" | "cidade" | "outro";
  autoria?: "ia" | "redacao" | "imprensa" | null;
  data_publicacao?: string | null; // AAAA-MM-DD (fuso de Brasília)
};

const contextos = new Map<string, ContextoPagina>();
const esperando = new Map<string, (c: ContextoPagina) => void>();
let contextoAtual: ContextoPagina = {};

export function definirContextoPagina(pathname: string, ctx: ContextoPagina) {
  contextos.set(pathname, ctx);
  const r = esperando.get(pathname);
  if (r) { esperando.delete(pathname); r(ctx); }
}

function esperarContexto(pathname: string, ms: number): Promise<ContextoPagina | null> {
  const ja = contextos.get(pathname);
  if (ja) return Promise.resolve(ja);
  return new Promise((resolve) => {
    const t = setTimeout(() => { esperando.delete(pathname); resolve(null); }, ms);
    esperando.set(pathname, (c) => { clearTimeout(t); resolve(c); });
  });
}

/** Data AAAA-MM-DD no fuso de Brasília. */
export function dataBrasilia(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function limpar(p: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined && v !== "") out[k] = v;
  return out;
}

/** Evento GA4 com o contexto editorial da página atual anexado. */
export function eventoGA(nome: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  carregarGA4();
  window.gtag?.("event", nome, limpar({ ...contextoAtual, ...params }));
}

async function contextoDaRota(pathname: string, parts: string[]): Promise<ContextoPagina> {
  if (parts.length === 0) return { tipo_conteudo: "home" };
  const [a, b, c] = parts;
  if (a === "coluna") return { tipo_conteudo: "coluna" };
  if (a === "vozes") return { tipo_conteudo: "coluna", cidade: b ?? null };
  if (a === "editoria") return { tipo_conteudo: "editoria", editoria: b ?? null };
  const regionMap = await getRegionMap();
  if (!regionMap.has(a)) return { tipo_conteudo: "outro" };
  if (parts.length === 1) return { tipo_conteudo: "regiao", regiao: a };
  if (b === "editoria") return { tipo_conteudo: "editoria", regiao: a, editoria: c ?? null };
  if (b === "cidade") return { tipo_conteudo: "cidade", regiao: a, cidade: c ?? null };
  if (parts.length === 2) {
    const ctx = await esperarContexto(pathname, 8000);
    return { tipo_conteudo: "materia", regiao: a, ...(ctx ?? {}) };
  }
  return { tipo_conteudo: "outro", regiao: a };
}

async function trackPageview(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  // GA4 (Consent Mode v2): sai para todo visitante — sem "Aceitar" o gtag
  // manda só o ping sem cookie, que o Google usa para modelar a audiência.
  // O page_view automático fica desligado (send_page_view: false) porque o
  // site navega por rotas client-side; disparamos aqui a cada troca de rota,
  // já com o contexto editorial da página.
  try {
    const ctx = await contextoDaRota(pathname, parts);
    contextoAtual = ctx;
    // O <title> da rota nova é aplicado depois da navegação: espera um
    // instante para o page_view não sair com o título da página anterior.
    await new Promise((r) => setTimeout(r, 400));
    if (typeof window !== "undefined") {
      carregarGA4();
      window.gtag?.("event", "page_view", limpar({
        page_path: pathname,
        page_location: window.location.href,
        page_title: typeof document !== "undefined" ? document.title : undefined,
        content_group: ctx.editoria ?? ctx.tipo_conteudo,
        ...ctx,
      }));
    }
  } catch {
    // métrica nunca quebra a navegação
  }

  // Nosso próprio analytics_events (com cidade do leitor por IP no
  // servidor) continua só depois do "Aceitar" (LGPD).
  if (getConsentimento() !== "aceito") return;

  try {
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
      typeof window !== "undefined" ? window.location.search : "",
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
    // Nunca rastrear /admin — é uso interno da equipe, não audiência do
    // portal. Sem isso, cada matéria revisada, cada tela do painel aberta
    // virava "pageview" no Analytics, inflando o número real de leitores
    // (chegou a 1317 visualizações só do painel editorial numa semana,
    // quase toda a atividade registrada no período).
    if (pathname.startsWith("/admin")) return;
    // Não bloqueia: dispara e esquece.
    void trackPageview(pathname);
  }, [pathname]);

  return null;
}
