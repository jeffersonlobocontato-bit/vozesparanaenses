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

  // Banner em destaque (30/10/2026): cartão escuro grande no rodapé, texto
  // grande e botões largos. Recusar tem o mesmo tamanho de Aceitar (ANPD:
  // recusar tão fácil quanto aceitar; "continuar navegando" não é aceite).
  const botao =
    "w-full rounded-2xl px-6 py-4 text-lg font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="vp-cookies-texto"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-3xl bg-[#12201E]/95 p-6 text-white shadow-[0_-8px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
        <p id="vp-cookies-texto" className="text-lg leading-relaxed sm:text-xl">
          Usamos cookies para medir a audiência e saber quais notícias da sua região interessam mais.
          Só estatística: <strong className="font-bold">nunca anúncio personalizado, nunca para identificar você</strong>.
          Saiba mais na nossa{" "}
          <a href="/privacidade" className="font-bold text-[#E29F65] underline-offset-4 hover:underline">
            Política de Privacidade
          </a>
          .
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => escolher("aceito")}
            className={`${botao} bg-[#E29F65] text-[#12201E] hover:bg-[#ECB585]`}
          >
            Aceitar e continuar
          </button>
          <button
            onClick={() => escolher("recusado")}
            className={`${botao} border-2 border-white/70 text-white hover:bg-white/10`}
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
