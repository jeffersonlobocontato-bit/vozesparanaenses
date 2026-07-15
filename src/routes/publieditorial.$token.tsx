import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PERGUNTAS = [
  {
    campo: "o_que_faz" as const,
    etapa: "1. Quem vocês são",
    pergunta: "Em poucas frases: o que a empresa faz, e há quanto tempo atua?",
    placeholder: "Ex.: Somos uma clínica de fisioterapia em Cascavel, fundada em 2015, especializada em reabilitação esportiva.",
  },
  {
    campo: "contexto_mercado" as const,
    etapa: "2. O cenário",
    pergunta: "Como está o mercado/cenário em que vocês atuam hoje? O que motivou divulgar isso agora?",
    placeholder: "Ex.: A procura por fisioterapia esportiva cresceu na região depois da chegada de novas academias no bairro.",
  },
  {
    campo: "diferenciais" as const,
    etapa: "3. Diferenciais",
    pergunta: "O que diferencia vocês da concorrência? Cite de 2 a 4 pontos reais.",
    placeholder: "Ex.: Equipamento X exclusivo na região, atendimento em até 24h, equipe com pós-graduação em Y.",
  },
  {
    campo: "evidencias" as const,
    etapa: "4. Evidências",
    pergunta: "Tem algum dado concreto? (nº de clientes atendidos, anos de mercado, prêmio, certificação, case). Só cite o que puder comprovar — não inventamos números.",
    placeholder: "Ex.: Mais de 3 mil pacientes atendidos desde 2015; certificação X; parceria com o time Y.",
  },
  {
    campo: "impacto_leitor" as const,
    etapa: "5. Impacto",
    pergunta: "Qual é o principal benefício prático que quem ler vai entender que ganha ao te procurar?",
    placeholder: "Ex.: Volta a treinar sem dor em menos tempo, com acompanhamento de perto.",
  },
  {
    campo: "cta_texto" as const,
    etapa: "6. Fechamento",
    pergunta: "O que você quer que o leitor faça depois de ler? (agendar, visitar, ligar, seguir nas redes)",
    placeholder: "Ex.: Agendar uma avaliação gratuita.",
  },
] as const;

function PublieditorialEntrevista() {
  const { token } = Route.useParams();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_anunciante: "", o_que_faz: "", contexto_mercado: "", diferenciais: "",
    evidencias: "", impacto_leitor: "", cta_texto: "", link_destino: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ gerado: boolean; aviso?: string } | null>(null);

  useEffect(() => {
    supabase.functions.invoke("publieditorial-obter", { body: { token } })
      .then(({ data, error }) => {
        if (error) throw error;
        const b = (data as { briefing?: Briefing })?.briefing;
        if (!b) throw new Error("Link inválido ou briefing não encontrado.");
        setBriefing(b);
        if (b.nome_anunciante) setForm((f) => ({ ...f, nome_anunciante: b.nome_anunciante ?? "" }));
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível carregar."))
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("publieditorial-preencher", {
        body: { token, ...form },
      });
      if (error) throw error;
      setEnviado(data as { gerado: boolean; aviso?: string });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar suas respostas. Tente novamente.");
    } finally {
      setEnviando(false);
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

  if (enviado || briefing?.status === "preenchido" || briefing?.status === "gerado") {
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
            {enviado?.aviso && <p className="mt-3 text-xs text-amber-700">{enviado.aviso}</p>}
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
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <span className="rounded-full bg-[#0066CC]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Publieditorial{campanha ? ` — ${campanha.nome}` : ""}
          </span>
          <h1 className="font-display mt-3 text-3xl font-black text-[#0A2540] md:text-4xl">
            Vamos escrever a sua matéria
          </h1>
          <p className="mt-3 text-slate-600">
            Responda as perguntas abaixo com o máximo de detalhe que puder — é isso que vira o texto.
            Quanto mais completa a resposta, mais completa sai a matéria.
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nome da empresa/marca*</span>
            <input required value={form.nome_anunciante} onChange={(e) => setForm({ ...form, nome_anunciante: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>

          {PERGUNTAS.map((p) => (
            <label key={p.campo} className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#0066CC]">{p.etapa}</span>
              <span className="mb-1 block font-medium text-slate-700">{p.pergunta}</span>
              <textarea
                rows={3}
                placeholder={p.placeholder}
                value={form[p.campo]}
                onChange={(e) => setForm({ ...form, [p.campo]: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ))}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Link ou contato pro fechamento (opcional)</span>
            <input value={form.link_destino} onChange={(e) => setForm({ ...form, link_destino: e.target.value })}
              placeholder="Ex.: www.seusite.com.br ou (44) 99999-9999"
              className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>

          {erro && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

          <button disabled={enviando} className="w-full rounded-lg bg-[#0066CC] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {enviando ? "Enviando…" : "Enviar respostas e gerar minha matéria"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
