import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdsenseSlot } from "@/components/AdsenseSlot";
import { ColunaCidadeFeed } from "@/components/ColunaCidade";
import { listNotasRegiao } from "@/lib/content.functions";
import { findMunicipioBySlug } from "@/lib/parana-municipios";

// Coluna regional "Vozes {Região}" — uma por região do PR, alimentada pelo
// pipeline com os releases das prefeituras da região, em formato blog.
//
// O segmento da URL é o slug da REGIÃO (/vozes/oeste). O nome do parâmetro
// continua `cidade` por compatibilidade com os links antigos: /vozes/{cidade}
// (coluna por cidade, antes da 070) redireciona para /vozes/{regiao}?cidade=…,
// a coluna da região já filtrada pela cidade.
type Busca = { cidade?: string };

const FORA_DO_PR = new Set(["nacional", "internacional"]);

export const Route = createFileRoute("/vozes/$cidade")({
  validateSearch: (search: Record<string, unknown>): Busca => ({
    cidade: typeof search.cidade === "string" && search.cidade ? search.cidade : undefined,
  }),
  loaderDeps: ({ search }) => ({ filtro: search.cidade ?? null }),
  loader: async ({ params, deps }) => {
    const municipio = findMunicipioBySlug(params.cidade);
    if (municipio?.region) {
      throw redirect({
        to: "/vozes/$cidade",
        params: { cidade: municipio.region },
        search: { cidade: municipio.slug },
        statusCode: 301,
      });
    }
    if (FORA_DO_PR.has(params.cidade)) throw notFound();
    const filtro = deps.filtro ? findMunicipioBySlug(deps.filtro) : null;
    const pagina = await listNotasRegiao({
      data: {
        regionSlug: params.cidade,
        citySlug: filtro?.region === params.cidade ? filtro.slug : null,
        limit: 10,
      },
    });
    return { pagina };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Coluna — Vozes Paranaenses" }] };
    const { pagina } = loaderData;
    const url = `https://vozesparanaenses.com.br/vozes/${params.cidade}`;
    const title = pagina.cidadeNome
      ? `${pagina.colunaNome}: notas de ${pagina.cidadeNome} | Vozes Paranaenses`
      : `${pagina.colunaNome} — notas das cidades da região | Vozes Paranaenses`;
    const description = pagina.cidadeNome
      ? `As notas de ${pagina.cidadeNome} (PR) na coluna ${pagina.colunaNome}: serviços, avisos, agenda e o que mais a prefeitura divulgou.`
      : `As notas das cidades da região ${pagina.regiaoNome} (PR), em ordem de publicação: serviços, avisos, agenda e o que mais as prefeituras divulgaram.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Coluna sem nota não é indexada (página vazia = baixo valor); a
        // versão filtrada por cidade aponta o canonical para a coluna inteira.
        { name: "robots", content: pagina.notas.length ? "index, follow" : "noindex, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ColunaRegionalPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Coluna não encontrada.</div>
  ),
});

function ColunaRegionalPage() {
  const { pagina } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <Link to="/" className="hover:text-[#12201E]">
            Vozes Paranaenses
          </Link>
          <span className="text-slate-300">›</span>
          <Link
            to="/$region"
            params={{ region: pagina.regiaoSlug }}
            className="hover:text-[#12201E]"
          >
            {pagina.regiaoNome}
          </Link>
          <span className="text-slate-300">›</span>
          <span className="text-[#12201E]">Coluna</span>
        </nav>
        <header className="mb-8 border-b border-slate-200 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#12201E]">
            Coluna da região
          </div>
          <h1 className="mt-2 font-display text-5xl font-black leading-none tracking-tight text-[#12201E]">
            {pagina.colunaNome}
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            O que as cidades da região {pagina.regiaoNome} divulgaram, nota a nota. As mais recentes
            ficam no topo.
          </p>
          {pagina.cidadeNome && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Mostrando só {pagina.cidadeNome}
              <Link
                to="/vozes/$cidade"
                params={{ cidade: pagina.regiaoSlug }}
                search={{}}
                className="text-[#12201E] underline"
              >
                ver todas as cidades
              </Link>
            </p>
          )}
        </header>
        <ColunaCidadeFeed
          key={pagina.cidadeSlug ?? "todas"}
          regionSlug={pagina.regiaoSlug}
          citySlug={pagina.cidadeSlug}
          inicial={pagina}
        />
        {pagina.notas.length > 0 && (
          <div className="mt-10">
            <AdsenseSlot slot="1955103709" format="autorelaxed" />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
