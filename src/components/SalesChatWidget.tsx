import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_COMERCIAL = "5545999864213";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

type Msg = { role: "user" | "assistant"; content: string };

function novaSessaoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sessao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isFormUrl(url: string): boolean {
  return url.includes("/vitrine-pessoal/novo");
}

function renderMessageContent(content: string) {
  const parts = content.split(URL_REGEX);
  const matches = content.match(URL_REGEX) ?? [];

  return (
    <>
      {parts.map((part, idx) => {
        const url = matches[idx];
        return (
          <span key={idx}>
            {part}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-full bg-[#0066CC] px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#0052a3]"
              >
                {isFormUrl(url) ? "RESPONDER FORMULÁRIO" : "ABRIR LINK"}
              </a>
            )}
          </span>
        );
      })}
    </>
  );
}

export function SalesChatWidget() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Msg[]>([
    { role: "assistant", content: "Oi! Quer anunciar no Vozes Paranaenses? Me conta um pouco sobre o seu negócio que eu já te mostro as melhores opções." },
  ]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarWhatsapp, setMostrarWhatsapp] = useState(false);
  const sessaoIdRef = useRef<string>(novaSessaoId());
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, aberto]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || enviando) return;
    const novasMensagens: Msg[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMensagens);
    setInput("");
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sales-chat", {
        body: {
          sessao_id: sessaoIdRef.current,
          mensagens: novasMensagens,
          contexto: { pagina: typeof window !== "undefined" ? window.location.pathname : undefined },
        },
      });
      if (error) throw error;
      const resposta = (data as { resposta?: string })?.resposta ?? "Desculpa, não consegui responder agora — tenta de novo?";
      setMensagens((prev) => [...prev, { role: "assistant", content: resposta }]);
      if ((data as { mostrar_whatsapp?: boolean })?.mostrar_whatsapp) setMostrarWhatsapp(true);
    } catch {
      setMensagens((prev) => [...prev, { role: "assistant", content: "Tive um problema técnico agora — pode tentar de novo em instantes?" }]);
    } finally {
      setEnviando(false);
    }
  }

  const whatsappHref = `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(
    "Olá! Vim do chat do site do Vozes Paranaenses e quero fechar um anúncio.",
  )}`;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {aberto && (
        <div className="flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#0A2540] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">Anuncie com a gente</p>
              <p className="text-[11px] opacity-80">Resposta na hora, sem compromisso</p>
            </div>
            <button onClick={() => setAberto(false)} aria-label="Fechar chat" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                  m.role === "user" ? "bg-[#0066CC] text-white" : "bg-slate-100 text-slate-800"
                }`}>
                  {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">digitando…</div>
              </div>
            )}

            {mostrarWhatsapp && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="mb-2 font-semibold text-emerald-900">Nosso time comercial fecha os detalhes com você por lá:</p>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white hover:bg-[#1ebe57]">
                  Abrir WhatsApp com o comercial
                </a>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form onSubmit={enviar} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua mensagem…"
              disabled={enviando}
              className="flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0066CC]"
            />
            <button disabled={enviando || !input.trim()} className="rounded-full bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-[#0A2540] px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
        aria-label="Abrir chat de anúncios"
      >
        📢 {aberto ? "Fechar" : "Anuncie aqui"}
      </button>
    </div>
  );
}
