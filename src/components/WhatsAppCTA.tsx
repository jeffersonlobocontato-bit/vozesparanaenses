const WHATSAPP_URL = "https://chat.whatsapp.com/FMM6H86Ve6KLQqgigL7MG5";

type Variant = "banner" | "inline";

export function WhatsAppCTA({
  variant = "banner",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const isInline = variant === "inline";
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Entrar na Comunidade do WhatsApp da Vozes Paranaenses"
      className={
        (isInline
          ? "flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-slate-900 transition-colors hover:bg-[#25D366]/20"
          : "flex flex-wrap items-center justify-between gap-3 bg-[#25D366] px-4 py-3 text-white transition-colors hover:bg-[#1ebe57]") +
        " " +
        className
      }
    >
      <span className="flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="currentColor"
          className={isInline ? "text-[#25D366]" : "text-white"}
          aria-hidden="true"
        >
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.9c0 2.1.55 4.14 1.6 5.94L0 24l6.32-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.56 0 11.89-5.33 11.89-11.9 0-3.18-1.24-6.17-3.43-8.42ZM12.06 21.3h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.75.98 1-3.66-.22-.37a9.38 9.38 0 0 1-1.44-5.03c0-5.19 4.22-9.4 9.4-9.4 2.51 0 4.87.98 6.64 2.76a9.34 9.34 0 0 1 2.75 6.65c0 5.19-4.22 9.4-9.4 9.4Zm5.4-7.03c-.29-.14-1.75-.86-2.02-.96-.27-.1-.47-.14-.66.14-.2.29-.76.96-.94 1.16-.17.2-.34.22-.63.08-.29-.14-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.44.13-.58.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.14-.66-1.6-.91-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.02c.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.11.56-.08 1.75-.71 2-1.4.25-.68.25-1.27.17-1.4-.07-.13-.26-.2-.55-.34Z" />
        </svg>
        <span className="flex flex-col leading-tight">
          <span
            className={
              "text-[11px] font-bold uppercase tracking-[0.14em] " +
              (isInline ? "text-[#128C4B]" : "text-white/90")
            }
          >
            Comunidade no WhatsApp
          </span>
          <span className={"text-sm font-semibold " + (isInline ? "text-slate-800" : "text-white")}>
            Receba as notícias do Paraná direto no seu WhatsApp
          </span>
        </span>
      </span>
      <span
        className={
          "shrink-0 rounded-sm px-3 py-1.5 text-[11px] font-black uppercase tracking-wider " +
          (isInline
            ? "bg-[#25D366] text-white"
            : "bg-white text-[#128C4B]")
        }
      >
        Entrar
      </span>
    </a>
  );
}