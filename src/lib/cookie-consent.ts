// Consentimento de cookies/rastreamento (LGPD).
//
// GA4 com Consent Mode v2 (modo avançado): o gtag carrega em toda visita,
// mas com tudo NEGADO por padrão. Sem "Aceitar", o Google só recebe pings
// sem cookie e sem identificador (que ele usa para modelar a audiência) —
// nada é gravado no navegador do leitor. Ao aceitar, liberamos só a
// medição (analytics_storage); anúncio/personalização seguem negados.
// O nosso próprio analytics_events continua só depois de "Aceitar".

export type ConsentimentoCookies = "aceito" | "recusado" | null;

const CHAVE = "vp-cookie-consent";

export function getConsentimento(): ConsentimentoCookies {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "aceito" || v === "recusado" ? v : null;
  } catch {
    return null;
  }
}

export function setConsentimento(valor: "aceito" | "recusado") {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CHAVE, valor); } catch { /* modo privado */ }
  window.dispatchEvent(new CustomEvent("vp-consent-changed", { detail: valor }));
  carregarGA4();
  window.gtag?.("consent", "update", {
    analytics_storage: valor === "aceito" ? "granted" : "denied",
  });
}

export const GA4_ID = "G-HPX9FLN7XV";
let ga4Carregado = false;

/** Injeta o gtag com o consentimento padrão (negado, salvo aceite anterior). */
export function carregarGA4() {
  if (typeof window === "undefined" || ga4Carregado) return;
  ga4Carregado = true;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); };
  const aceito = getConsentimento() === "aceito";
  w.gtag("consent", "default", {
    analytics_storage: aceito ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  w.gtag("js", new Date());
  // page_view é manual (analytics.ts), a cada troca de rota, com os
  // parâmetros editoriais (região, editoria, cidade, autoria...).
  w.gtag("config", GA4_ID, { send_page_view: false });
  if (!document.querySelector(`script[src*="gtag/js?id=${GA4_ID}"]`)) {
    const s = document.createElement("script");
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    s.async = true;
    document.head.appendChild(s);
  }
}

/** Chamado no carregamento do site: o gtag sobe em toda visita (Consent
 * Mode decide o que ele pode gravar). Nome mantido por compatibilidade. */
export function restaurarGA4SeJaAceito() {
  carregarGA4();
}
