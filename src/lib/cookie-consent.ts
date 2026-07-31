// Consentimento de cookies/rastreamento (LGPD) — antes, o GA4 e o nosso
// próprio analytics disparavam pra todo visitante sem perguntar nada.
// Agora, nada de rastreamento roda antes do usuário escolher.

export type ConsentimentoCookies = "aceito" | "recusado" | null;

const CHAVE = "vp-cookie-consent";

export function getConsentimento(): ConsentimentoCookies {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CHAVE);
  return v === "aceito" || v === "recusado" ? v : null;
}

export function setConsentimento(valor: "aceito" | "recusado") {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE, valor);
  window.dispatchEvent(new CustomEvent("vp-consent-changed", { detail: valor }));
  if (valor === "aceito") carregarGA4();
}

const GA4_ID = "G-HPX9FLN7XV";
let ga4Carregado = false;

/** Injeta o script do GA4 dinamicamente — só chamado depois do "Aceitar". */
export function carregarGA4() {
  if (typeof window === "undefined" || ga4Carregado) return;
  if (document.querySelector(`script[src*="gtag/js?id=${GA4_ID}"]`)) { ga4Carregado = true; return; }
  ga4Carregado = true;
  const s1 = document.createElement("script");
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  s1.async = true;
  document.head.appendChild(s1);
  const s2 = document.createElement("script");
  s2.textContent =
    "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '" +
    GA4_ID + "', { send_page_view: false });";
  document.head.appendChild(s2);
}

/** Se o consentimento já tinha sido dado numa visita anterior, carrega o
 * GA4 de novo nesta (localStorage persiste entre sessões, mas o script
 * precisa ser reinjetado a cada carregamento de página). */
export function restaurarGA4SeJaAceito() {
  if (getConsentimento() === "aceito") carregarGA4();
}
