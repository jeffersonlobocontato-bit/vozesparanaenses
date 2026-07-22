import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/sobre")({
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
            // foundingDate: ainda não informado — adicionar quando o
            // Jefferson confirmar a data (e o CNPJ/razão social, quando
            // definidos).
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-5xl font-black tracking-tight text-[#0A2540] md:text-6xl">
          Sobre o Vozes Paranaenses
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-700">
          Somos um portal regional que cobre as 10 macrorregiões do Paraná (recorte IPARDES) com
          foco no impacto local. Cada matéria é organizada por região e por cidade principal, de
          forma que o leitor encontre primeiro o que acontece perto de casa.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Quem somos</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            O Vozes Paranaenses foi fundado por <strong>Jefferson Lobo</strong>, responsável
            editorial pelo projeto. A formalização da empresa (razão social e CNPJ) está em
            andamento — atualizaremos esta seção assim que estiver concluída.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Missão</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            Ampliar as vozes das regiões paranaenses e garantir que informação de qualidade sobre
            política, economia, cultura, esporte, segurança e cotidiano chegue a quem mora nas
            cidades cobertas.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Método editorial (DEL)</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            Trabalhamos com o Método <strong>DEL — Denso, Editorial, Local</strong>. A partir da
            coleta de fontes públicas (portais oficiais, RSS, veículos regionais), aplicamos
            reescrita editorial com verificação factual pelo padrão jornalístico <strong>5W1H</strong>
            (o quê, quem, quando, onde, por quê e como). Nenhuma matéria vai ao ar sem passar por
            editoria humana.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Transparência sobre IA</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            Usamos assistência de inteligência artificial para consolidar informações de múltiplas
            fontes públicas, extrair 5W1H e sugerir estruturas de matéria. A decisão editorial,
            titulação e publicação são sempre humanas.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Política de correções</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-700">
            Erros acontecem — e devem ser corrigidos rapidamente. Se você identificou um erro em
            alguma matéria, envie o link e o que deve ser corrigido para{" "}
            <a href="mailto:redacao@vozesparanaenses.com.br" className="text-[#0A2540] underline">
              redacao@vozesparanaenses.com.br
            </a>
            . Toda correção material é sinalizada no próprio texto com data.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">Contato</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-slate-700">
            <li>Redação: <a href="mailto:redacao@vozesparanaenses.com.br" className="text-[#0A2540] underline">redacao@vozesparanaenses.com.br</a></li>
            <li>Comercial: <a href="mailto:comercial@vozesparanaenses.com.br" className="text-[#0A2540] underline">comercial@vozesparanaenses.com.br</a></li>
            <li><Link to="/whatsapp" className="text-[#0A2540] underline">Receber notícias por WhatsApp</Link></li>
          </ul>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}
