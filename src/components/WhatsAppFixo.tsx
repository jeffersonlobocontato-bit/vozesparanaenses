import { useEffect, useState } from "react";
import { WhatsAppIcon, trackShare } from "@/components/ShareButtons";

/**
 * Botão fixo "Compartilhar no WhatsApp" nas matérias, só no celular.
 * Aparece depois que o leitor rola um pouco (não cobre a capa) e some
 * quando ele chega aos botões de compartilhar do fim da matéria. Fica à
 * esquerda — o canto direito é do chat de anúncios.
 * No GA4 o clique sai como share com method = "whatsapp-fixo", para medir
 * o efeito do botão separado dos outros compartilhamentos.
 */
export function WhatsAppFixo({ url, title }: { url: string; title: string }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const medir = () => {
      const fim = document.querySelector("[data-compartilhar-fim]");
      const passouDoFim = !!fim && fim.getBoundingClientRect().top < window.innerHeight;
      setVisivel(window.scrollY > 500 && !passouDoFim);
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, [url]);

  const link = `${url}${url.includes("?") ? "&" : "?"}utm_source=whatsapp&utm_medium=social&utm_campaign=botao-fixo`;
  const href = `https://api.whatsapp.com/send?text=${encodeURIComponent(title)}%20${encodeURIComponent(link)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackShare("whatsapp-fixo", new URL(url).pathname)}
      aria-label="Compartilhar esta matéria no WhatsApp"
      aria-hidden={!visivel}
      tabIndex={visivel ? 0 : -1}
      className={`fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-6.5rem)] items-center gap-2 rounded-full bg-[#25D366] py-3 pl-4 pr-5 text-sm font-bold text-[#0B3D21] shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-all duration-300 md:hidden ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <WhatsAppIcon />
      <span className="truncate">Compartilhar no WhatsApp</span>
    </a>
  );
}
