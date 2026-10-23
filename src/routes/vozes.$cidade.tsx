import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdsenseSlot } from "@/components/AdsenseSlot";
import { ColunaCidadeFeed } from "@/components/ColunaCidade";
import { listNotasCidade } from "@/lib/content.functions";
import { findMunicipioBySlug } from "@/lib/parana-municipios";

// Coluna "Vozes {Cidade}" — uma por município, alimentada pelo pipeline
// com as notas do dia (pautas que não viraram matéria). Formato blog.
export const Route = createFileRoute("/vozes/$cidade")({
  loader: async ({ params }) => {
    const municipio = findMunicipioBySlug(params.cidade);
    if (!municipio) throw notFound();
    const pagina = await listNotasCidade({ data: { citySlug: params.cidade, limit: 10 } });
    return { municipio, pagina };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Coluna — Vozes Paranaenses" }] };
    const { pagina, municipio } = loaderData;
    const url = `https://vozesparanaenses.com.br/vozes/${params.cidade}`;
    const title = `${pagina.colunaNome} — notas do dia de ${municipio.name} | Vozes Paranaenses`;
    const description = `As notas de ${municipio.name} (PR), em ordem de publicação: serviços, avisos, agenda e o que mais aconteceu na cidade.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        // Coluna sem nota ainda não é indexada (página vazia = baixo valor).
        { name: "robots", content: pagina.notas.length ? "index, follow" : "noindex, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ColunaCidadePage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Cidade não encontrada.</div>
  ),
});

function ColunaCidadePage() {
  const { municipio, pagina } = Route.useLoaderData();
  const { cidade } = Route.useParams();
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <Link to="/" className="hover:text-[#12201E]">Vozes Paranaenses</Link>
          {municipio.region && (
            <>
              <span className="text-slate-300">›</span>
              <Link
                to="/$region/cidade/$cidade"
                params={{ region: municipio.region, cidade }}
                className="hover:text-[#12201E]"
              >
                {municipio.name}
              </Link>
            </>
          )}
          <span className="text-slate-300">›</span>
          <span className="text-[#12201E]">Coluna</span>
        </nav>
        <header className="mb-8 border-b border-slate-200 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#12201E]">Coluna da cidade</div>
          <h1 className="mt-2 font-display text-5xl font-black leading-none tracking-tight text-[#12201E]">
            {pagina.colunaNome}
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            O que aconteceu em {municipio.name}, nota a nota. As mais recentes ficam no topo.
          </p>
        </header>
        <ColunaCidadeFeed citySlug={cidade} inicial={pagina} />
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
