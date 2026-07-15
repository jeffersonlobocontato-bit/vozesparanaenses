import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vitrine-pessoal/novo")({
  head: () => ({
    meta: [
      { title: "Vitrine Pessoal — Sua matéria no Vozes Paranaenses" },
      { name: "description", content: "Tenha uma matéria sobre o seu trabalho publicada com a credibilidade de um portal estadual, por R$ 199." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: VitrinePessoalChat,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function VitrinePessoalChat() {
  const navigate = useNavigate();
  const [tokenSessao, setTokenSessao] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [redirecionando, setRedirecionando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [tempoGrav, setTempoGrav] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("vitrine-pessoal-chat", { body: { init: true } });
        if (error) throw error;
        const res = data as { mensagem?: string; token?: string };
        if (!res.token || !res.mensagem) throw new Error("Não foi possível iniciar a entrevista.");
        setTokenSessao(res.token);
        setMensagens([{ role: "assistant", content: res.mensagem }]);
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (!carregando && !redirecionando) inputRef.current?.focus();
  }, [carregando, redirecionando, mensagens.length]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const texto = rascunho.trim();
    if (!texto || enviando || !tokenSessao) return;
    setEnviando(true);
    setMensagens((m) => [...m, { role: "user", content: texto }]);
    setRascunho("");
    try {
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-chat", {
        body: { token: tokenSessao, mensagem: texto },
      });
      if (error) throw error;
      const res = data as { mensagem: string; finalizado: boolean; token: string; aviso?: string };
      setMensagens((m) => [...m, { role: "assistant", content: res.mensagem }]);
      if (res.finalizado) {
        setRedirecionando(true);
        setTimeout(() => {
          navigate({ to: "/vitrine/$token", params: { token: res.token } });
        }, 1800);
      }
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

  function pickMime(): string {
    const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const m of candidatos) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  }

  async function iniciarGravacao() {
    if (gravando || transcrevendo || enviando || redirecionando) return;
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        const tipo = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: tipo });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setTempoGrav(0);
        if (blob.size < 2048) {
          setErro("Gravação muito curta. Fale por pelo menos 1 segundo.");
          return;
        }
        await transcrever(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setGravando(true);
      setTempoGrav(0);
      timerRef.current = setInterval(() => setTempoGrav((s) => s + 1), 1000);
    } catch {
      setErro("Não consegui acessar seu microfone. Verifique as permissões do navegador.");
    }
  }

  function pararGravacao() {
    const rec = recorderRef.current;
    if (!rec) return;
    setGravando(false);
    if (rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }

  function cancelarGravacao() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onstop = null;
      rec.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    chunksRef.current = [];
    setGravando(false);
    setTempoGrav(0);
  }

  async function transcrever(blob: Blob) {
    setTranscrevendo(true);
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("wav") ? "wav" : "webm";
      form.append("file", blob, `resposta.${ext}`);
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-transcrever", { body: form });
      if (error) throw error;
      const texto = (data as { text?: string })?.text?.trim();
      if (!texto) { setErro("Não entendi o áudio. Tente falar mais claro."); return; }
      setRascunho((r) => (r ? r + " " + texto : texto));
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Falha ao transcrever o áudio.");
    } finally {
      setTranscrevendo(false);
    }
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  function formatTempo(s: number) {
    const m = Math.floor(s / 60); const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
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

  if (erro && mensagens.length === 0) {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-2xl flex-col px-4 py-8">
        <div className="mb-4 text-center">
          <span className="rounded-full bg-[#0066CC]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Vitrine Pessoal — R$ 199
          </span>
          <h1 className="font-display mt-3 text-2xl font-black text-[#0A2540] md:text-3xl">
            Vamos conversar sobre o seu trabalho
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Responda por texto ou por voz — quanto mais detalhe, melhor sai a matéria.
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
            {redirecionando && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
                ✅ Rascunho gerado! Te levando pra revisar e editar…
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
                disabled={enviando || transcrevendo || gravando || redirecionando}
                placeholder={
                  redirecionando
                    ? "Entrevista concluída."
                    : gravando
                      ? "🎤 Gravando… fale sua resposta."
                      : transcrevendo
                        ? "Transcrevendo seu áudio…"
                        : "Escreva ou grave sua resposta. Depois clique em Enviar."
                }
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0066CC] disabled:bg-slate-100"
              />
              {!redirecionando && (
                gravando ? (
                  <>
                    <button type="button" onClick={cancelarGravacao} title="Cancelar gravação"
                      className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-600">
                      ✕
                    </button>
                    <button type="button" onClick={pararGravacao} title="Parar e transcrever"
                      className="shrink-0 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white">
                      ⏹ {formatTempo(tempoGrav)}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={iniciarGravacao} disabled={enviando || transcrevendo} title="Responder por voz"
                    className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
                    {transcrevendo ? "…" : "🎤"}
                  </button>
                )
              )}
              <button
                type="submit"
                disabled={enviando || transcrevendo || gravando || redirecionando || !rascunho.trim()}
                className="shrink-0 rounded-xl bg-[#0066CC] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            {(gravando || transcrevendo) && (
              <p className="mt-2 text-xs text-slate-500">
                {gravando
                  ? "Fale com calma. Clique em ⏹ pra parar e transcrever, ou ✕ pra cancelar."
                  : "Transcrevendo… revise o texto antes de enviar."}
              </p>
            )}
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
