import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

const searchSchema = z.object({
  materia: z.string().optional(),
});

export const Route = createFileRoute("/correcoes")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Política de Correções — Vozes Paranaenses" },
      {
        name: "description",
        content:
          "Como reportar erros e como o Vozes Paranaenses corrige matérias publicadas — política pública de correções.",
      },
      { property: "og:title", content: "Política de Correções — Vozes Paranaenses" },
      { property: "og:type", content: "article" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "/correcoes" }],
  }),
  component: Correcoes,
});

function Correcoes() {
  const { materia } = Route.useSearch();
  const [form, setForm] = useState({
    materia_slug: materia ?? "",
    descricao: "",
    contato: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.descricao.trim().length < 10) {
      setStatus("err");
      setErrMsg("Descreva o erro com pelo menos 10 caracteres.");
      return;
    }
    setStatus("sending");
    setErrMsg(null);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("correcoes").insert({
        materia_slug: form.materia_slug.trim() || null,
        descricao: form.descricao.trim(),
        contato: form.contato.trim() || null,
      });
      if (error) throw error;
      setStatus("ok");
      setForm({ materia_slug: "", descricao: "", contato: "" });
    } catch (err: unknown) {
      setStatus("err");
      setErrMsg(err instanceof Error ? err.message : "Falha ao enviar.");
    }
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0A2540] focus:outline-none";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Política de correções
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Errar é humano — reconhecer publicamente e corrigir é parte do jornalismo que praticamos.
        </p>

        <section className="prose prose-slate mt-8 max-w-none">
          <h2>Como corrigimos</h2>
          <ul>
            <li>
              Erros factuais são corrigidos assim que verificados. A matéria recebe uma nota de
              correção com data e descrição resumida do que foi alterado.
            </li>
            <li>
              Alterações apenas de estilo (ortografia, clareza) são feitas silenciosamente.
            </li>
            <li>
              Direito de resposta é atendido conforme legislação vigente; escreva para{" "}
              <a href="mailto:contato@vozesparanaenses.com.br">contato@vozesparanaenses.com.br</a>.
            </li>
          </ul>
        </section>

        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-display text-2xl font-black text-[#0A2540]">Reportar um erro</h2>
          <p className="mt-1 text-sm text-slate-600">
            Todos os campos são revisados pela redação. Não publicamos seus dados.
          </p>

          {status === "ok" ? (
            <div className="mt-6 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
              Recebemos seu registro. Obrigado — vamos analisar e responder, se necessário.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Matéria (URL ou slug)
                </label>
                <input
                  className={inputCls}
                  placeholder="ex.: curitiba/aprovado-plano-diretor"
                  value={form.materia_slug}
                  onChange={(e) => setForm((f) => ({ ...f, materia_slug: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Descreva o erro *
                </label>
                <textarea
                  className={inputCls}
                  rows={5}
                  required
                  minLength={10}
                  placeholder="Aponte o trecho, o que está incorreto e, se possível, a fonte da informação correta."
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Contato (opcional)
                </label>
                <input
                  className={inputCls}
                  placeholder="e-mail ou telefone, caso queira retorno"
                  value={form.contato}
                  onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                />
              </div>

              {status === "err" && errMsg && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {errMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-md bg-[#0A2540] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2f52] disabled:opacity-60"
              >
                {status === "sending" ? "Enviando…" : "Enviar correção"}
              </button>
            </form>
          )}
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}