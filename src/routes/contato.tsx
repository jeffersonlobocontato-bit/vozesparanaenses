import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Vozes Paranaenses" },
      {
        name: "description",
        content: "Fale com a redação do Vozes Paranaenses — pautas, assessoria, publicidade e imprensa.",
      },
      { property: "og:title", content: "Contato — Vozes Paranaenses" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "/contato" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contato — Vozes Paranaenses",
          url: "/contato",
          mainEntity: {
            "@type": "NewsMediaOrganization",
            name: "Vozes Paranaenses",
            contactPoint: [
              {
                "@type": "ContactPoint",
                contactType: "Redação",
                email: "contato@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
              {
                "@type": "ContactPoint",
                contactType: "Publicidade",
                email: "publicidade@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
              {
                "@type": "ContactPoint",
                contactType: "Privacidade / LGPD",
                email: "privacidade@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
            ],
          },
        }),
      },
    ],
  }),
  component: Contato,
});

function Card({ title, email, desc }: { title: string; email: string; desc: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A2540]">{title}</div>
      <a
        href={`mailto:${email}`}
        className="mt-2 block font-display text-xl font-bold text-slate-900 hover:text-[#0A2540]"
      >
        {email}
      </a>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function Contato() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Fale com a redação
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Sugestões de pauta, denúncias, direito de resposta, publicidade regional e imprensa —
          escolha o canal e escreva. Respondemos em até dois dias úteis.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="Redação"
            email="contato@vozesparanaenses.com.br"
            desc="Pautas, sugestões, denúncias e direito de resposta."
          />
          <Card
            title="Publicidade"
            email="publicidade@vozesparanaenses.com.br"
            desc="Anúncios regionais, patrocínios e branded content."
          />
          <Card
            title="Privacidade / LGPD"
            email="privacidade@vozesparanaenses.com.br"
            desc="Solicitações de acesso, correção ou exclusão de dados pessoais."
          />
        </div>

        <div className="mt-10 rounded-lg border-l-4 border-[#0A2540] bg-slate-50 p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0A2540]">
            Encontrou erro em uma matéria?
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Use o formulário dedicado em <a href="/correcoes" className="font-semibold text-[#0A2540] underline">correções</a> para
            que o registro fique vinculado à matéria original.
          </p>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}