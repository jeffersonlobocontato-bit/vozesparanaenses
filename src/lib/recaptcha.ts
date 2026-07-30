// reCAPTCHA v3 — invisível, sem exigir clique do usuário. Compartilhado por
// todos os formulários públicos (contato, Vitrine Pessoal, Publieditorial,
// chat de vendas) que agora exigem token antes de aceitar a submissão.
//
// TROCAR o placeholder abaixo pela Site Key real, gerada em
// https://www.google.com/recaptcha/admin (escolha reCAPTCHA v3). A Site Key
// é pública por natureza — pode ficar direto no código do front-end. A
// Secret Key (essa sim, sigilosa) vai como variável de ambiente do lado do
// servidor (RECAPTCHA_SECRET_KEY), nunca aqui.
export const RECAPTCHA_SITE_KEY = "COLE_AQUI_A_SITE_KEY_DO_RECAPTCHA_V3";

let scriptPromise: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src*="recaptcha/api.js"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar reCAPTCHA"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

/** Retorna um token de reCAPTCHA v3 pra essa ação, ou null se não der pra carregar
 * (ex.: rede bloqueando o script) — nesse caso o back-end decide se aceita
 * sem token (hoje aceita, registrando aviso, até a Site Key ser configurada). */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (RECAPTCHA_SITE_KEY.startsWith("COLE_AQUI")) return null;
  try {
    await carregarScript();
    return await new Promise((resolve) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}
