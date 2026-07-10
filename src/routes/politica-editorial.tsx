import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/politica-editorial")({
  head: () => ({
    meta: [
      { title: "Política Editorial — Vozes Paranaenses" },
      {
        name: "description",
        content:
          "Como o Vozes Paranaenses apura, edita, revisa e publica suas notícias — princípios editoriais, uso de IA assistida e política de correções.",
      },
      { property: "og:title", content: "Política Editorial — Vozes Paranaenses" },
      {
        property: "og:description",
        content:
          "Princípios editoriais, transparência sobre uso de IA e revisão humana, apuração regional e correções.",
      },
      { property: "og:type", content: "article" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    ],
    links: [{ rel: "canonical", href: "/politica-editorial" }],
  }),
  component: PoliticaEditorial,
});

function PoliticaEditorial() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Política editorial
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Como o Vozes Paranaenses apura, escreve, revisa e publica cada matéria.
        </p>

        <section className="prose prose-slate mt-10 max-w-none">
          <h2>Missão editorial</h2>
          <p>
            Cobrir com profundidade jornalística as 10 macrorregiões do Paraná, aproximando o leitor
            do que acontece na sua cidade e devolvendo o protagonismo regional ao noticiário.
          </p>

          <h2>Independência</h2>
          <p>
            A pauta editorial é definida exclusivamente pela redação. Anunciantes e parceiros
            comerciais não influenciam decisões de cobertura, ângulo ou publicação.
          </p>

          <h2>Apuração e fontes</h2>
          <ul>
            <li>Cada matéria referencia fontes primárias verificáveis (órgãos públicos, veículos consolidados, documentos).</li>
            <li>Boatos, redes sociais isolados e conteúdo não confirmado não viram matéria.</li>
            <li>Erros identificados após a publicação são corrigidos e sinalizados com data.</li>
          </ul>

          <h2>Uso de inteligência artificial</h2>
          <p>
            O Vozes Paranaenses utiliza modelos de linguagem para acelerar a produção editorial —
            monitoramento de fontes, sumarização, sugestão de estrutura e geração de rascunhos.
            <strong> Toda matéria publicada passa por revisão humana</strong> de um(a) editor(a)
            responsável, identificado(a) ao final do texto. Não publicamos conteúdo sem revisão.
          </p>
          <p>
            Sinalizamos a assistência de IA com o cabeçalho{" "}
            <code>ai-content-declaration: assisted; editorial-review-by-human</code> e com um aviso
            visível ao rodapé de cada matéria.
          </p>

          <h2>Correções</h2>
          <p>
            Erros factuais são corrigidos assim que verificados. Leitores podem reportar imprecisões
            pela página de <a href="/correcoes">correções</a>. Correções relevantes ficam registradas
            na própria matéria com data e descrição.
          </p>

          <h2>Diversidade e pluralidade</h2>
          <p>
            Buscamos representar as diferentes regiões, cidades e comunidades do Paraná — inclusive
            municípios pequenos historicamente sub-cobertos pela mídia estadual.
          </p>

          <h2>Contato editorial</h2>
          <p>
            Redação: <a href="mailto:contato@vozesparanaenses.com.br">contato@vozesparanaenses.com.br</a>.
          </p>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}