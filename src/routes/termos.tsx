import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Vozes Paranaenses" },
      {
        name: "description",
        content: "Regras de uso do portal Vozes Paranaenses, propriedade intelectual e limites de responsabilidade.",
      },
      { property: "og:title", content: "Termos de Uso — Vozes Paranaenses" },
      { property: "og:type", content: "article" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "/termos" }],
  }),
  component: Termos,
});

function Termos() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Termos de uso
        </h1>
        <p className="mt-4 text-sm text-slate-500">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <section className="prose prose-slate mt-8 max-w-none">
          <h2>1. Aceitação</h2>
          <p>
            Ao acessar o Vozes Paranaenses você concorda com estes termos. Se não concordar,
            interrompa o uso do site.
          </p>

          <h2>2. Conteúdo editorial</h2>
          <p>
            Todo material publicado (textos, imagens, dados agregados) é protegido por direitos
            autorais e pertence à Vozes Paranaenses ou aos respectivos titulares indicados. É
            permitido citar trechos curtos com atribuição e link para a matéria original. Reprodução
            integral requer autorização prévia por escrito.
          </p>

          <h2>3. Uso permitido</h2>
          <ul>
            <li>Ler, compartilhar links e citar com atribuição.</li>
            <li>Enviar sugestões de pauta e correções.</li>
            <li>Cadastrar-se em serviços editoriais (ex.: notícias por WhatsApp).</li>
          </ul>

          <h2>4. Uso proibido</h2>
          <ul>
            <li>Raspar (scraping) o site em massa sem autorização.</li>
            <li>Republicar matérias integrais em outros sites ou aplicativos.</li>
            <li>Usar o portal para atividades ilegais ou spam.</li>
          </ul>

          <h2>5. Publicidade</h2>
          <p>
            Espaços publicitários são claramente demarcados. A veiculação de um anúncio não implica
            endosso editorial do anunciante nem de suas ofertas.
          </p>

          <h2>6. Uso por sistemas de IA</h2>
          <p>
            O conteúdo pode ser indexado e citado por motores de busca e assistentes de IA que
            respeitem nossa política em <code>/robots.txt</code>, <code>/llms.txt</code> e créditos
            de autoria/publicação. Uso para treinamento comercial exige autorização.
          </p>

          <h2>7. Responsabilidade</h2>
          <p>
            O conteúdo é oferecido com finalidade informativa. Não substitui aconselhamento
            profissional específico. Não nos responsabilizamos por decisões tomadas exclusivamente
            com base em matérias, tampouco por conteúdo de sites externos linkados.
          </p>

          <h2>8. Foro</h2>
          <p>Fica eleito o foro da comarca de Curitiba/PR para dirimir eventuais controvérsias.</p>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}