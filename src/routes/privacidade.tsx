import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Vozes Paranaenses" },
      {
        name: "description",
        content:
          "Como o Vozes Paranaenses coleta, usa e protege dados pessoais dos leitores, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Vozes Paranaenses" },
      { property: "og:type", content: "article" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Política de privacidade
        </h1>
        <p className="mt-4 text-sm text-slate-500">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <section className="prose prose-slate mt-8 max-w-none">
          <h2>1. Quem somos</h2>
          <p>
            Vozes Paranaenses é um portal jornalístico regional que opera em vozesparanaenses.lovable.app.
            Esta política descreve como tratamos dados pessoais conforme a Lei Geral de Proteção de
            Dados (LGPD — Lei nº 13.709/2018).
          </p>

          <h2>2. Dados que coletamos</h2>
          <ul>
            <li>
              <strong>Navegação:</strong> endereço IP aproximado, tipo de dispositivo, páginas
              visitadas e origem do acesso — usados para métricas agregadas e detecção de abuso.
            </li>
            <li>
              <strong>Cadastro no WhatsApp:</strong> nome e telefone quando você opta por receber
              notícias, usados exclusivamente para envio editorial.
            </li>
            <li>
              <strong>Correções e contato:</strong> informações que você voluntariamente envia
              através de formulários (nome, e-mail, mensagem).
            </li>
          </ul>

          <h2>3. Cookies</h2>
          <p>
            Usamos cookies próprios para preferências de navegação e cookies de terceiros para
            métricas anônimas. Você pode desativá-los no seu navegador; algumas funções podem
            deixar de funcionar.
          </p>

          <h2>4. Compartilhamento</h2>
          <p>
            Não vendemos dados pessoais. Compartilhamos apenas com operadores estritamente
            necessários (hospedagem, envio de mensagens) sob contrato e obrigação de sigilo.
          </p>

          <h2>5. Seus direitos</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, bem
            como revogar consentimentos, escrevendo para{" "}
            <a href="mailto:privacidade@vozesparanaenses.com.br">privacidade@vozesparanaenses.com.br</a>.
          </p>

          <h2>6. Retenção</h2>
          <p>
            Dados de leitores WhatsApp são mantidos enquanto o cadastro estiver ativo. Logs de
            navegação são anonimizados em até 12 meses. Registros de correções ficam preservados
            para transparência editorial.
          </p>

          <h2>7. Alterações</h2>
          <p>Alterações a esta política são publicadas nesta mesma página com nova data.</p>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}