import { useEffect, useState } from "react";
import { Link2, Check, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Botões de compartilhamento — de propósito, sem SDK nenhum de terceiro
 * (nada de script do Facebook/Twitter/etc carregado no site). Cada botão é
 * só um link para o endpoint de compartilhamento público de cada rede —
 * mais rápido, sem cookie de rastreamento de terceiro, sem risco de
 * violação de política do AdSense por script externo pesado.
 */

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.37-.5.08-1.12.11-1.8-.11-.42-.13-.95-.3-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.57-.36.76-.36h.54c.17 0 .4-.03.63.48.24.55.8 1.9.87 2.04.07.14.12.3.02.49-.1.19-.15.3-.29.46-.15.17-.31.37-.44.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.35 1.45.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.7-.17 1.38z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2H21l-6.34 7.25L22.14 22H16.4l-4.5-5.88L6.7 22H3.94l6.78-7.75L2.86 2h5.88l4.07 5.38L18.24 2Zm-1.05 18.17h1.53L7.9 3.73H6.26l10.93 16.44Z" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.4 2.6 11.9c-1 .4-1 1.5.1 1.8l4.6 1.5 1.8 5.5c.2.7 1.1.9 1.6.4l2.5-2.4 4.8 3.5c.7.5 1.7.1 1.9-.7L23.9 5.4c.3-.9-.6-1.6-2-1Zm-3.1 3.4-8 7.2-.3 3.4-1.5-4.5 9.3-6.6c.2-.1.4.1.2.3l-7 6.1c-.1.1-.2.3-.2.5l-.2 2.3Z" />
    </svg>
  );
}

async function trackShare(canal: string, pagina: string) {
  try {
    await supabase.functions.invoke("track-pageview", {
      body: { tipo_evento: "compartilhamento", origem_trafego: canal, pagina },
    });
  } catch {
    // compartilhamento não deve travar por causa de métrica
  }
}

export function ShareButtons({ url, title, compact = false }: { url: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "share" in navigator) setCanNativeShare(true);
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const canais = [
    { nome: "WhatsApp", href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`, Icon: WhatsAppIcon, cor: "#25D366" },
    { nome: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, Icon: FacebookIcon, cor: "#1877F2" },
    { nome: "X", href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, Icon: XIcon, cor: "#000000" },
    { nome: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, Icon: TelegramIcon, cor: "#26A5E4" },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      void trackShare("copiar_link", url);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (contexto não seguro, permissão negada, etc.)
    }
  }

  async function handleNativeShare() {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title, url });
      void trackShare("nativo", url);
    } catch {
      // usuário cancelou o share sheet — não é erro
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "border-y border-slate-200 py-4"}`}>
      {!compact && <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">Compartilhar</span>}
      {canais.map(({ nome, href, Icon, cor }) => (
        <a
          key={nome}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => trackShare(nome.toLowerCase(), url)}
          aria-label={`Compartilhar no ${nome}`}
          title={`Compartilhar no ${nome}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          style={{ backgroundColor: cor }}
        >
          <Icon />
        </a>
      ))}
      <button
        onClick={handleCopy}
        aria-label="Copiar link da matéria"
        title="Copiar link"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100"
      >
        {copied ? <Check size={16} /> : <Link2 size={16} />}
      </button>
      {canNativeShare && (
        <button
          onClick={handleNativeShare}
          aria-label="Mais opções de compartilhamento"
          title="Mais opções"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <Share2 size={16} />
        </button>
      )}
    </div>
  );
}
