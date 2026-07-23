import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { getSobreConfig, renderRichText, DEFAULT_SOBRE } from "@/lib/sobre.functions";

export const Route = createFileRoute("/sobre")({
  loader: async () => {
    try {
      return await getSobreConfig();
    } catch {
      return DEFAULT_SOBRE;
    }
  },
  head: () => ({
    meta: [
      { title: "Sobre — Vozes Paranaenses" },
      {
        name: "description",
        content:
          "Vozes Paranaenses é o portal regional de notícias das 10 macrorregiões do Paraná. Conheça nossa missão, método editorial e política de correções.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Sobre — Vozes Paranaenses" },
      { property: "og:description", content: "Missão, método editorial e política de correções do Vozes Paranaenses." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/sobre" },
    ],
    links: [{ rel: "canonical", href: "/sobre" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Sobre — Vozes Paranaenses",
          inLanguage: "pt-BR",
          about: {
            "@type": "NewsMediaOrganization",
            name: "Vozes Paranaenses",
            areaServed: { "@type": "State", name: "Paraná" },
            founder: { "@type": "Person", name: "Jefferson Lobo" },
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const cfg = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-5xl font-black tracking-tight text-[#0A2540] md:text-6xl">
          {cfg.hero_title}
        </h1>
        <div className="mt-6 text-lg [&>p]:mt-4 [&>p:first-child]:mt-0 [&>p]:leading-relaxed [&>p]:text-slate-700">
          {renderRichText(cfg.intro)}
        </div>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Quem somos</h2>
          {renderRichText(cfg.quem_somos)}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Missão</h2>
          {renderRichText(cfg.missao)}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Método editorial (DEL)</h2>
          {renderRichText(cfg.metodo_editorial)}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Transparência sobre IA</h2>
          {renderRichText(cfg.transparencia_ia)}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Política de correções</h2>
          {renderRichText(cfg.correcoes)}
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            Envie para{" "}
            <a href={`mailto:${cfg.email_redacao}`} className="text-[#0A2540] underline">
              {cfg.email_redacao}
            </a>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Contato</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-slate-700">
            <li>Redação: <a href={`mailto:${cfg.email_redacao}`} className="text-[#0A2540] underline">{cfg.email_redacao}</a></li>
            <li>Comercial: <a href={`mailto:${cfg.email_comercial}`} className="text-[#0A2540] underline">{cfg.email_comercial}</a></li>
            <li><Link to="/whatsapp" className="text-[#0A2540] underline">Receber notícias por WhatsApp</Link></li>
          </ul>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}
