import { useEffect, useState } from "react";
import { getConsentimento, setConsentimento, restaurarGA4SeJaAceito } from "@/lib/cookie-consent";
import { registrarConsentimento } from "@/lib/busca.functions";

// Banner de cookies (LGPD). Conta, sem identificar ninguém, quantas vezes
// foi exibido/aceito/recusado (consentimento_contagem, migração 098) — é a
// taxa de aceite que diz que fração dos leitores o GA4 enxerga.
// Aceitar e Recusar têm o mesmo peso visual (exigência da ANPD).

function contar(evento: "exibido" | "aceito" | "recusado") {
  registrarConsentimento({ data: { evento } }).catch(() => {});
}

export function CookieConsentBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    restaurarGA4SeJaAceito();
    const mostrar = getConsentimento() === null;
    setVisivel(mostrar);
    if (mostrar) {
      // Uma exibição por sessão do navegador (não a cada troca de página).
      let jaContou = false;
      try {
        jaContou = sessionStorage.getItem("vp-banner-contado") === "1";
        sessionStorage.setItem("vp-banner-contado", "1");
      } catch { /* sem storage */ }
      if (!jaContou) contar("exibido");
    }
  }, []);

  if (!visivel) return null;

  function escolher(valor: "aceito" | "recusado") {
    setConsentimento(valor);
    contar(valor);
    setVisivel(false);
  }

  const botao =
    "min-w-[112px] rounded-full px-5 py-2.5 text-sm font-bold transition-colors";

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-snug text-slate-700">
          <strong className="text-[#12201E]">O Vozes é gratuito e feito para a sua região.</strong>{" "}
          Com o seu aceite, contamos as visitas para saber quais notícias interessam mais —
          só estatística: nunca anúncio personalizado, nunca para identificar você.{" "}
          <a href="/privacidade" className="text-[#12201E] underline">Política de Privacidade</a>
        </p>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <button
            onClick={() => escolher("recusado")}
            className={`${botao} flex-1 border-2 border-[#12201E] text-[#12201E] hover:bg-slate-50 sm:flex-none`}
          >
            Recusar
          </button>
          <button
            onClick={() => escolher("aceito")}
            className={`${botao} flex-1 border-2 border-[#E29F65] bg-[#E29F65] text-[#12201E] hover:bg-[#d08c52] sm:flex-none`}
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
