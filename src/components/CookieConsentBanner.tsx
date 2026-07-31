import { useEffect, useState } from "react";
import { getConsentimento, setConsentimento, restaurarGA4SeJaAceito } from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    restaurarGA4SeJaAceito();
    setVisivel(getConsentimento() === null);
  }, []);

  if (!visivel) return null;

  function escolher(valor: "aceito" | "recusado") {
    setConsentimento(valor);
    setVisivel(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          Utilizamos cookies e tecnologias semelhantes para melhorar sua navegação. Ao continuar navegando você concorda com a nossa{" "}
          <a href="/privacidade" className="text-[#0066CC] underline">Política de Privacidade</a> e Política de Cookies.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => escolher("recusado")}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Recusar
          </button>
          <button
            onClick={() => escolher("aceito")}
            className="rounded-full bg-[#0066CC] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0055ab]"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
