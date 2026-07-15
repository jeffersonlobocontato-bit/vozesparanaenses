import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/publieditorial/$token")({
  head: () => ({
    meta: [
      { title: "Entrevista para seu Publieditorial — Vozes Paranaenses" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublieditorialEntrevista,
});

type Status = "aguardando_preenchimento" | "preenchido" | "gerado" | "erro";

type Briefing = {
  id: string; status: Status; nome_anunciante: string | null;
  campaign: { nome: string } | { nome: string }[] | null;
  generated_article: { slug: string; regiao: { slug: string } | { slug: string }[] | null } | { slug: string; regiao: { slug: string } | { slug: string }[] | null }[] | null;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function PublieditorialEntrevista() {
  const { token } = Route.useParams();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [finalizado, setFinalizado] = useState<{ aviso?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("publieditorial-obter", { body: { token } });
        if (error) throw error;
        const payload = data as { briefing?: Briefing; chat?: ChatMsg[] };
        const b = payload?.briefing;
        if (!b) throw new Error("Link inválido ou briefing não encontrado.");
        setBriefing(b);
        const histInicial = (payload.chat ?? []).filter((m) => m.role === "user" || m.role === "assistant");
        setMensagens(histInicial);

        // Se está aguardando preenchimento e ainda não tem nenhuma mensagem, pede a saudação inicial do agente
        if (b.status === "aguardando_preenchimento" && histInicial.length === 0) {
          const { data: initData, error: initErr } = await supabase.functions.invoke("publieditorial-chat", {
            body: { token, init: true },
          });
          if (initErr) throw initErr;
          const primeira = (initData as { mensagem?: string }).mensagem;
          if (primeira) setMensagens([{ role: "assistant", content: primeira }]);
        }
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (!carregando && !finalizado && briefing?.status === "aguardando_preenchimento") {
      inputRef.current?.focus();
    }
  }, [carregando, finalizado, briefing?.status, mensagens.length]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const texto = rascunho.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setMensagens((m) => [...m, { role: "user", content: texto }]);
    setRascunho("");
    try {
      const { data, error } = await supabase.functions.invoke("publieditorial-preencher", {
        // (mantido por compat, não é chamado — o fluxo vive em publieditorial-chat)
        body: { token, __noop: true },
      });
      // no-op — chamada real logo abaixo
      void data; void error;

      const { data: chatData, error: chatErr } = await supabase.functions.invoke("publieditorial-chat", {
        body: { token, mensagem: texto },
      });
      if (chatErr) throw chatErr;
      const res = chatData as { mensagem: string; finalizado: boolean; aviso?: string };
      setMensagens((m) => [...m, { role: "assistant", content: res.mensagem }]);
      if (res.finalizado) setFinalizado({ aviso: res.aviso });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar sua mensagem. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Carregando…</main>
        <SiteFooter />
      </div>
    );
  }

  if (erro && !briefing) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const encerrado = finalizado || briefing?.status === "preenchido" || briefing?.status === "gerado";

  if (encerrado && mensagens.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
            <p className="text-4xl">✅</p>
            <h1 className="font-display mt-3 text-2xl font-black text-emerald-900">Respostas recebidas!</h1>
            <p className="mt-2 text-sm text-emerald-800">
              Nossa equipe já está com o rascunho da sua matéria em produção. Assim que for aprovada,
              entraremos em contato pra combinar a publicação.
            </p>
            {finalizado?.aviso && <p className="mt-3 text-xs text-amber-700">{finalizado.aviso}</p>}
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const campanha = first(briefing?.campaign ?? null);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-2xl flex-col px-4 py-8">
        <div className="mb-4 text-center">
          <span className="rounded-full bg-[#0066CC]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Publieditorial{campanha ? ` — ${campanha.nome}` : ""}
          </span>
          <h1 className="font-display mt-3 text-2xl font-black text-[#0A2540] md:text-3xl">
            Entrevista pra sua matéria
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Nosso redator vai te fazer algumas perguntas por aqui. Responda com naturalidade — quanto
            mais detalhe, melhor sai a matéria.
          </p>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[#0066CC] px-4 py-2.5 text-sm text-white"
                      : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-800"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "120ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "240ms" }} />
                  </span>
                </div>
              </div>
            )}
            {encerrado && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
                ✅ Entrevista encerrada — sua matéria já entrou em produção.
                {finalizado?.aviso && <p className="mt-2 text-xs text-amber-700">{finalizado.aviso}</p>}
              </div>
            )}
          </div>

          <form onSubmit={enviar} className="border-t border-slate-200 bg-slate-50 p-3">
            {erro && <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={enviando || Boolean(encerrado)}
                placeholder={encerrado ? "Entrevista encerrada." : "Escreva sua resposta e aperte Enter…"}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0066CC] disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={enviando || Boolean(encerrado) || !rascunho.trim()}
                className="shrink-0 rounded-xl bg-[#0066CC] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
