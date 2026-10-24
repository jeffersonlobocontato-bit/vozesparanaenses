import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  ImagePlus,
  Link2,
  MapPin,
  MapPinOff,
  Megaphone,
  MessageCircle,
  Pin,
  Radar,
  Send,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { LogoIcon } from "@/components/Logo";

// Landing page de venda do Portal da Imprensa para os gestores de comunicação
// das prefeituras. Visual do design system da Academia jeffersonlobo.tech
// (fundo quase preto, acento verde-água, Inter + IBM Plex Mono), não o do
// portal — é página de produto, não editorial.
// Números: retrato de 24/10/2026 (fontes ativas e publicações dos últimos dias).

const IMG = "/cidadesdoparana";
const INTER = "Inter, ui-sans-serif, system-ui, sans-serif";
const CADASTRO = "/imprensa/cadastro";
const whats = (texto: string) => `https://wa.me/5545999864213?text=${encodeURIComponent(texto)}`;

export const Route = createFileRoute("/cidadesdoparana")({
  head: () => ({
    meta: [
      { title: "Sua cidade no portal do Paraná, sem custo | Vozes Paranaenses para prefeituras" },
      {
        name: "description",
        content:
          "O único portal que dá espaço às 399 cidades do Paraná. Assessorias de prefeitura publicam direto, com redação por IA no padrão do portal, sem custo.",
      },
      { property: "og:title", content: "Sua cidade nas notícias do Paraná. Sem custo." },
      {
        property: "og:description",
        content: "Cadastre a assessoria da sua prefeitura no Vozes Paranaenses e publique direto, com link pronto para compartilhar.",
      },
      { property: "og:image", content: `https://vozesparanaenses.com.br${IMG}/home.jpg` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://vozesparanaenses.com.br/cidadesdoparana" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: CidadesDoParana,
});

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/[0.08] px-3 py-1 font-[family-name:IBM_Plex_Mono,monospace] text-[11px] font-medium uppercase tracking-[0.12em] text-[#2DD4BF]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF] shadow-[0_0_8px_#2DD4BF]" />
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-[family-name:IBM_Plex_Mono,monospace] text-[11px] font-medium uppercase tracking-[0.18em] text-[#2DD4BF]">{children}</p>;
}

function Cta({ children, to = CADASTRO, variante = "primario" }: { children: ReactNode; to?: string; variante?: "primario" | "secundario" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium transition";
  const cls =
    variante === "primario"
      ? `${base} bg-gradient-to-br from-[#0D9488] to-[#14B8A6] text-white shadow-[0_0_24px_-6px_rgba(45,212,191,0.55)] hover:shadow-[0_0_32px_-4px_rgba(45,212,191,0.7)]`
      : `${base} border border-[#5EEAD4]/40 bg-[#050505]/70 text-white hover:border-[#5EEAD4]/80`;
  if (to.startsWith("#")) {
    return <a href={to} className={cls}>{children}</a>;
  }
  return <Link to={to} className={cls}>{children}</Link>;
}

/** Captura de tela com moldura de navegador. */
function Tela({ src, alt, url, className = "" }: { src: string; alt: string; url?: string; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-[18px] border border-white/10 bg-[#0d0d0d] shadow-[0_20px_40px_rgba(0,0,0,0.55)] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        {url && <span className="ml-2 truncate rounded-full bg-white/[0.05] px-3 py-0.5 font-[family-name:IBM_Plex_Mono,monospace] text-[10px] text-white/50">{url}</span>}
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </figure>
  );
}

function Numero({ valor, rotulo, nota }: { valor: string; rotulo: string; nota?: string }) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6">
      <p className="font-[family-name:IBM_Plex_Mono,monospace] text-4xl font-medium tracking-tight text-white sm:text-5xl">{valor}</p>
      <p className="mt-2 text-[15px] font-medium text-white">{rotulo}</p>
      {nota && <p className="mt-1 text-sm text-[#b4b4b4]">{nota}</p>}
    </div>
  );
}

const PASSOS: Array<{ n: string; titulo: string; texto: string; img?: string; alt?: string; icone: ReactNode }> = [
  {
    n: "01",
    titulo: "Cadastre a assessoria",
    texto:
      "Escolha a sua prefeitura, informe nome completo, CPF e a sua função (secretário, diretor, coordenador, assessor de imprensa…) e crie a sua própria senha. Ninguém precisa te enviar acesso.",
    img: `${IMG}/p-cadastro.jpg`,
    alt: "Formulário de cadastro do Portal da Imprensa preenchido",
    icone: <UserCheck className="h-5 w-5" />,
  },
  {
    n: "02",
    titulo: "Aprovação da equipe",
    texto:
      "A redação confere se você é mesmo o responsável pela comunicação do município. Aprovado, o painel libera o envio. É a garantia de que só fala pela prefeitura quem responde por ela.",
    icone: <ShieldCheck className="h-5 w-5" />,
  },
  {
    n: "03",
    titulo: "Envie a matéria da semana",
    texto:
      "Escolha a pauta mais importante da semana da sua prefeitura. Cole o release ou escreva o que quer divulgar, envie uma ou mais fotos e escolha a principal, que vira a capa da matéria.",
    img: `${IMG}/p-envio.jpg`,
    alt: "Painel do assessor com release colado e duas fotos, uma marcada como principal",
    icone: <ImagePlus className="h-5 w-5" />,
  },
  {
    n: "04",
    titulo: "A IA redige, você revisa",
    texto:
      "Em segundos a matéria é escrita no padrão editorial do portal, com a editoria identificada. Você confere nomes, datas e números e ajusta o que precisar.",
    img: `${IMG}/p-revisao.jpg`,
    alt: "Tela de revisão com título, subtítulo, texto e fotos da matéria",
    icone: <Sparkles className="h-5 w-5" />,
  },
  {
    n: "05",
    titulo: "Publique e compartilhe",
    texto:
      "Clique em Publicar: a matéria entra no ar na hora, com o link e os botões de WhatsApp, Facebook, X e Telegram prontos para você espalhar.",
    img: `${IMG}/p-publicada.jpg`,
    alt: "Tela de matéria publicada com o link e os botões de compartilhamento",
    icone: <Send className="h-5 w-5" />,
  },
];

const FAQ: Array<{ p: string; r: string }> = [
  { p: "Tem algum custo para a prefeitura?", r: "Não. O cadastro e a publicação de 1 matéria por semana pelo Portal da Imprensa são gratuitos." },
  {
    p: "Por que só 1 matéria por semana?",
    r: "Porque as notícias do dia a dia a varredura automática já publica, duas vezes por dia, a partir do site da prefeitura. O canal do assessor é a vitrine da semana: a pauta que vocês escolhem como a mais importante, com fotos próprias, revisão de vocês e destaque fixo para os leitores da cidade. Se precisar de mais publicações, fale com a nossa equipe.",
  },
  {
    p: "Quem pode se cadastrar?",
    r: "O responsável pela comunicação da prefeitura: secretário, diretor, coordenador, supervisor, assessor de imprensa ou outra função equivalente. O cadastro é pessoal, com CPF, e passa por aprovação.",
  },
  {
    p: "A IA muda o que a prefeitura disse?",
    r: "Não inventa nada. Ela reescreve o material no formato de notícia do portal (título, linha fina, texto) usando só as informações enviadas, e você revisa antes de publicar.",
  },
  {
    p: "E se o portal já tiver publicado a mesma notícia?",
    r: "A varredura automática pode chegar antes. Nesse caso o painel avisa e mostra o link da matéria que já está no ar, para você compartilhar em vez de duplicar.",
  },
  {
    p: "Quanto tempo leva para a matéria ir ao ar?",
    r: "Depois da aprovação do cadastro, a publicação é imediata: você clica em Publicar e recebe o link na mesma tela.",
  },
  {
    p: "Quem responde pelo conteúdo publicado?",
    r: "O assessor, que aceita um termo de responsabilidade no cadastro e a cada publicação. Os dados pessoais seguem a LGPD e o CPF nunca aparece no site.",
  },
];

function CidadesDoParana() {
  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased" style={{ fontFamily: INTER, ["--font-display" as string]: INTER, ["--font-sans" as string]: INTER }}>
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Vozes Paranaenses">
            <LogoIcon size={30} onDark />
            <span className="text-[15px] font-semibold tracking-tight">Vozes Paranaenses</span>
            <span className="hidden rounded-full border border-[#14B8A6]/30 px-2 py-0.5 font-[family-name:IBM_Plex_Mono,monospace] text-[10px] uppercase tracking-[0.12em] text-[#2DD4BF] sm:inline">
              Prefeituras
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] text-white/75 md:flex">
            <a href="#varredura" className="hover:text-white">Como funciona</a>
            <a href="#cobertura" className="hover:text-white">Cobertura</a>
            <a href="#passo-a-passo" className="hover:text-white">Passo a passo</a>
            <a href="#perguntas" className="hover:text-white">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/imprensa/entrar" className="hidden rounded-full border border-[#14B8A6]/25 px-4 py-2 text-sm text-white/90 hover:border-[#14B8A6]/60 sm:inline-flex">
              Entrar
            </Link>
            <Link to={CADASTRO} className="rounded-full bg-gradient-to-br from-[#0D9488] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white">
              Cadastrar
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Topo */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[720px]"
            style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(20,184,166,0.22), rgba(5,5,5,0) 70%)" }}
          />
          <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
            <Pill>Portal da Imprensa · 399 cidades do Paraná</Pill>
            <h1 className="mx-auto mt-6 max-w-4xl text-[2.6rem] font-medium leading-[0.98] tracking-[-0.045em] sm:text-7xl">
              Sua cidade nas notícias do Paraná.
              <span className="block bg-gradient-to-b from-white/90 to-white/40 bg-clip-text text-transparent">Sem custo.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#b4b4b4]">
              O Vozes Paranaenses é o único portal do Paraná que dá espaço às 399 cidades do estado. Cadastre a assessoria
              da sua prefeitura e publique direto: a inteligência artificial redige no padrão do portal e você recebe o
              link pronto para compartilhar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Cta>
                Cadastrar minha prefeitura <ArrowRight className="h-4 w-4" />
              </Cta>
              <Cta to="#passo-a-passo" variante="secundario">
                Ver o passo a passo
              </Cta>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-[13px] text-[#b4b4b4]">
              {["Gratuito", "Publicação na hora", "Redação por IA", "Link para WhatsApp"].map((t) => (
                <span key={t} className="rounded-full border border-white/[0.08] px-3 py-1">{t}</span>
              ))}
            </div>

            {/* Vídeo de apresentação */}
            <div className="relative mx-auto mt-12 max-w-4xl">
              <div aria-hidden="true" className="absolute -inset-6 rounded-[32px] bg-[#14B8A6]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[24px] border border-[#5EEAD4]/20 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                <video
                  className="block aspect-video w-full"
                  controls
                  preload="metadata"
                  playsInline
                  poster={`${IMG}/video-capa.jpg`}
                >
                  <source src={`${IMG}/apresentacao.mp4`} type="video/mp4" />
                </video>
              </div>
              <p className="mt-3 font-[family-name:IBM_Plex_Mono,monospace] text-[11px] uppercase tracking-[0.14em] text-white/45">
                2 minutos · como a sua prefeitura entra no portal
              </p>
            </div>
          </div>
        </section>

        {/* Varredura automática + canal direto */}
        <section id="varredura" className="border-t border-white/[0.06] py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow>Já estamos de olho na sua cidade</Eyebrow>
              <h2 className="mt-3 text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
                Duas vezes por dia, a IA lê o site da sua prefeitura.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[#b4b4b4]">
                Às 12h e às 18h, nossos agentes visitam os sites das prefeituras do Paraná, identificam as notícias do dia e
                publicam espontaneamente, com crédito da fonte. Sua cidade já aparece no portal, mesmo sem cadastro.
              </p>
              <ul className="mt-7 space-y-4">
                {[
                  { i: <Radar className="h-5 w-5" />, t: "Varredura automática", d: "Notícia do dia no site oficial vira matéria ou nota na coluna da sua região." },
                  { i: <Send className="h-5 w-5" />, t: "A matéria da semana, escolhida por você", d: "A varredura cobre o dia a dia. Pelo canal do assessor, a prefeitura publica a pauta que considera a mais importante da semana, com as próprias fotos e destaque para quem lê da cidade." },
                  { i: <Link2 className="h-5 w-5" />, t: "Aviso de duplicidade", d: "Se a notícia já foi publicada por nós, o painel avisa e mostra o link da matéria que está no ar." },
                ].map((x) => (
                  <li key={x.t} className="flex gap-4">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/[0.08] text-[#5EEAD4]">{x.i}</span>
                    <span>
                      <span className="block font-medium text-white">{x.t}</span>
                      <span className="block text-[15px] text-[#b4b4b4]">{x.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <Tela src={`${IMG}/p-duplicata.jpg`} alt="Aviso no painel: esta notícia já foi publicada, com o link da matéria" url="vozesparanaenses.com.br/imprensa/painel" />
              <p className="text-sm text-white/50">
                Exemplo real do aviso: a varredura já tinha publicado a licitação de Cascavel, e o assessor recebe o link para compartilhar.
              </p>
            </div>
          </div>
        </section>

        {/* Cobertura */}
        <section id="cobertura" className="border-t border-white/[0.06] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <Eyebrow>Cobertura e abrangência</Eyebrow>
              <h2 className="mt-3 text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
                O Paraná inteiro, cidade por cidade.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[#b4b4b4]">
                Grandes portais olham para a capital e para as maiores cidades. O Vozes Paranaenses foi feito para dar voz a
                todas as 399, organizadas nas 10 regiões do estado, cada uma com a sua editoria e a sua coluna.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Numero valor="399" rotulo="cidades no mapa editorial" nota="Todos os municípios do Paraná, sem exceção." />
              <Numero valor="188" rotulo="sites de prefeituras monitorados" nota="E a lista cresce a cada semana." />
              <Numero valor="~40" rotulo="matérias publicadas por dia" nota="121 nos últimos três dias, em todas as regiões." />
              <Numero valor="2×" rotulo="varreduras por dia" nota="Às 12h e às 18h, só notícia do dia." />
              <Numero valor="10" rotulo="regiões com editoria própria" nota="Metropolitana, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul." />
              <Numero valor="48" rotulo="portais e agências na curadoria" nota="Contexto estadual, nacional e internacional ao lado da sua notícia." />
            </div>
            <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.618fr_1fr]">
              <div>
                <Tela src={`${IMG}/home.jpg`} alt="Página inicial do Vozes Paranaenses com a matéria da Prefeitura de Cascavel como manchete" url="vozesparanaenses.com.br" />
                <p className="mt-3 text-sm text-white/50">
                  A matéria enviada pela assessoria de Cascavel, na manchete do portal.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6">
                <MapPin className="h-6 w-6 text-[#5EEAD4]" />
                <h3 className="mt-4 text-xl font-medium tracking-[-0.02em]">Primeiro a notícia da cidade de quem lê</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#b4b4b4]">
                  O portal identifica a cidade do leitor e monta a primeira dobra por proximidade: a notícia da cidade dele
                  vem primeiro, depois a região, o Paraná, o Brasil e o mundo. A matéria da sua prefeitura fica fixada no
                  topo para quem lê da sua cidade.
                </p>
                <ul className="mt-5 space-y-2 text-[15px] text-white/85">
                  {["Página própria da região e da cidade", "Coluna “Vozes” da sua região", "SEO e resumo automáticos para o Google e para as IAs de busca"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5EEAD4]" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-6 font-[family-name:IBM_Plex_Mono,monospace] text-[11px] uppercase tracking-[0.14em] text-white/35">
              Números de outubro de 2026
            </p>
          </div>
        </section>

        {/* Passo a passo */}
        <section id="passo-a-passo" className="border-t border-white/[0.06] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <Eyebrow>Passo a passo</Eyebrow>
              <h2 className="mt-3 text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
                Do release ao link no WhatsApp em cinco passos.
              </h2>
            </div>
            <ol className="mt-12 space-y-16">
              {PASSOS.map((p, i) => (
                <li key={p.n} className={`grid items-center gap-8 ${p.img ? "lg:grid-cols-2" : ""}`}>
                  <div className={p.img && i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="flex items-center gap-3">
                      <span className="font-[family-name:IBM_Plex_Mono,monospace] text-sm text-[#2DD4BF]">{p.n}</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/[0.08] text-[#5EEAD4]">{p.icone}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-medium tracking-[-0.02em] sm:text-3xl">{p.titulo}</h3>
                    <p className="mt-3 max-w-xl text-lg leading-relaxed text-[#b4b4b4]">{p.texto}</p>
                    {p.n === "01" && (
                      <div className="mt-6"><Cta>Fazer meu cadastro <ArrowRight className="h-4 w-4" /></Cta></div>
                    )}
                  </div>
                  {p.img && (
                    <Tela src={p.img} alt={p.alt ?? ""} url={p.n === "01" ? "vozesparanaenses.com.br/imprensa/cadastro" : "vozesparanaenses.com.br/imprensa/painel"} className="mx-auto w-full max-w-xl" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Engajamento */}
        <section className="border-t border-white/[0.06] py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="order-2 grid grid-cols-[0.62fr_1fr] items-center gap-4 lg:order-1">
              <Tela src={`${IMG}/materia-mobile.jpg`} alt="A matéria publicada aberta no celular, com os botões de compartilhar" />
              <Tela src={`${IMG}/p-publicada.jpg`} alt="Tela de matéria publicada com o link e os botões de compartilhamento" url="…/imprensa/painel" />
            </div>
            <div className="order-1 lg:order-2">
              <Eyebrow>Engaje a população</Eyebrow>
              <h2 className="mt-3 text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
                Publicou? O link já está na sua mão.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[#b4b4b4]">
                Na própria tela de publicação ficam os botões de compartilhar. Um toque e a matéria segue para onde a sua
                cidade conversa:
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { i: <Users className="h-4 w-4" />, t: "Grupos de WhatsApp de bairros e comunidades" },
                  { i: <Megaphone className="h-4 w-4" />, t: "Lista de transmissão e canal da prefeitura" },
                  { i: <Share2 className="h-4 w-4" />, t: "Facebook, X e Telegram da prefeitura" },
                  { i: <Copy className="h-4 w-4" />, t: "Link na bio e nos stories do Instagram" },
                  { i: <FileText className="h-4 w-4" />, t: "Clipping para vereadores e secretarias" },
                  { i: <Clock className="h-4 w-4" />, t: "Matéria fixada para os leitores da sua cidade" },
                ].map((x) => (
                  <li key={x.t} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-[15px] text-white/85">
                    <span className="mt-0.5 text-[#5EEAD4]">{x.i}</span>
                    {x.t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] text-[#b4b4b4]">
                Notícia de portal com link próprio circula mais e passa mais credibilidade do que um card solto: quem
                recebe abre, lê a matéria completa e conhece o que acontece na cidade.
              </p>
            </div>
          </div>
        </section>

        {/* Projeto */}
        <section className="border-t border-white/[0.06] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-[28px] border border-[#5EEAD4]/15 bg-gradient-to-br from-[#14B8A6]/[0.09] via-white/[0.02] to-transparent p-8 sm:p-12">
              <Pill>Projeto inédito no Brasil</Pill>
              <h2 className="mt-5 max-w-3xl text-3xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
                Um portal operado por agentes autônomos de inteligência artificial, com supervisão humana.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#b4b4b4]">
                O Vozes Paranaenses é 100% desenvolvido e operado por agentes de IA: eles leem as fontes, agrupam o que é a
                mesma notícia, conferem se a pauta responde quem, o quê, quando, onde, como e por quê, escrevem no padrão
                editorial e avaliam o que pode ir ao ar. Uma equipe humana supervisiona o processo e responde pela linha
                editorial.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { t: "Agente de coleta", d: "Lê os sites oficiais e os portais duas vezes ao dia." },
                  { t: "Agente editor", d: "Separa pauta, checa o 5W1H e evita duplicidade." },
                  { t: "Agente redator", d: "Escreve no padrão do portal, sem inventar fatos." },
                  { t: "Supervisão humana", d: "Revisão, correções e decisões editoriais." },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl border border-white/[0.08] bg-[#050505]/60 p-5">
                    <Bot className="h-5 w-5 text-[#5EEAD4]" />
                    <p className="mt-3 font-medium">{x.t}</p>
                    <p className="mt-1 text-sm text-[#b4b4b4]">{x.d}</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-[15px] text-white/80">
                Desenvolvido pela <strong className="font-semibold text-white">Agência de Inteligência Vozes</strong>, pelo
                especialista em IA <strong className="font-semibold text-white">Jefferson Lobo</strong>.{" "}
                <a href="https://jeffersonlobo.tech" target="_blank" rel="noopener noreferrer" className="text-[#5EEAD4] underline-offset-4 hover:underline">
                  jeffersonlobo.tech
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Perguntas */}
        <section id="perguntas" className="border-t border-white/[0.06] py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Eyebrow>Dúvidas</Eyebrow>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-[2.6rem]">Perguntas frequentes</h2>
            <div className="mt-8 divide-y divide-white/[0.08] rounded-[24px] border border-white/[0.08] bg-white/[0.03]">
              {FAQ.map((f) => (
                <details key={f.p} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
                    {f.p}
                    <span className="text-[#5EEAD4] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#b4b4b4]">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Bom saber */}
        <section id="bom-saber" className="border-t border-white/[0.06] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Eyebrow>Bom saber</Eyebrow>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] sm:text-[2.6rem]">Antes de começar</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  i: <MapPinOff className="h-5 w-5" />,
                  t: "Sua prefeitura não tem página de notícias?",
                  d: "Então a varredura automática não tem onde ler, e a sua cidade pode estar ficando de fora. O Portal da Imprensa resolve: você envia as notícias direto, sem depender de site.",
                  cta: { rotulo: "Cadastrar minha prefeitura", to: CADASTRO },
                },
                {
                  i: <Search className="h-5 w-5" />,
                  t: "Não encontrou as notícias da sua prefeitura no portal?",
                  d: "O endereço da página de notícias pode ter mudado. Mande o link pelo WhatsApp que a nossa equipe ajusta a leitura do site.",
                  cta: { rotulo: "Avisar pelo WhatsApp", href: whats("Olá! Sou da comunicação de uma prefeitura e não encontrei as nossas notícias no Vozes Paranaenses. O link da nossa página de notícias é: ") },
                },
                {
                  i: <CalendarDays className="h-5 w-5" />,
                  t: "A matéria mais importante da semana",
                  d: "O dia a dia da prefeitura a varredura já publica. O canal do assessor é para a pauta que vocês consideram a principal da semana: 1 matéria a cada 7 dias, sem custo, com as suas fotos, o seu texto revisado e destaque para a sua cidade. Precisa de mais espaço? Fale com a gente.",
                  cta: { rotulo: "Quero publicar mais", href: whats("Olá! Sou da comunicação de uma prefeitura e quero publicar mais de 1 matéria por semana no Vozes Paranaenses.") },
                },
                {
                  i: <Pin className="h-5 w-5" />,
                  t: "Destaque no topo do portal",
                  d: "A sua matéria já aparece em destaque para quem lê da sua cidade. Para fixá-la no topo do portal, à vista de leitores de todo o Paraná, fale com a nossa equipe.",
                  cta: { rotulo: "Quero destaque no topo", href: whats("Olá! Sou da comunicação de uma prefeitura e quero uma matéria fixada no topo do Vozes Paranaenses.") },
                },
              ].map((n) => (
                <div key={n.t} className="flex flex-col rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/[0.08] text-[#5EEAD4]">{n.i}</span>
                  <h3 className="mt-4 text-xl font-medium tracking-[-0.02em]">{n.t}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[#b4b4b4]">{n.d}</p>
                  {"to" in n.cta && n.cta.to ? (
                    <Link to={n.cta.to} className="mt-5 inline-flex items-center gap-2 self-start text-[15px] font-medium text-[#5EEAD4] hover:underline">
                      {n.cta.rotulo} <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <a href={(n.cta as { href: string }).href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 self-start text-[15px] font-medium text-[#5EEAD4] hover:underline">
                      <MessageCircle className="h-4 w-4" /> {n.cta.rotulo}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Convite final */}
        <section className="relative overflow-hidden border-t border-white/[0.06] py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(50% 60% at 50% 100%, rgba(20,184,166,0.18), rgba(5,5,5,0) 70%)" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Dê voz à sua cidade.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-[#b4b4b4]">
              Cadastre a assessoria da sua prefeitura hoje. É gratuito, leva poucos minutos e a próxima notícia da sua
              cidade já pode sair com o link pronto para compartilhar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Cta>Cadastrar minha prefeitura <ArrowRight className="h-4 w-4" /></Cta>
              <Cta to="/imprensa/entrar" variante="secundario">Já tenho cadastro</Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-white/45 sm:flex-row sm:px-6">
          <span className="flex items-center gap-2"><LogoIcon size={20} onDark /> Vozes Paranaenses · o portal das 399 cidades do Paraná</span>
          <span>
            Agência de Inteligência Vozes ·{" "}
            <a href="https://jeffersonlobo.tech" target="_blank" rel="noopener noreferrer" className="hover:text-white">Jefferson Lobo</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
