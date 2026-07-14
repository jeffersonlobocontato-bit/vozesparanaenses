import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  listArticlesByCategoryGlobal,
  listCategorias,
} from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdsenseSlot } from "@/components/AdsenseSlot";

const catsQO = queryOptions({
  queryKey: ["categorias"],
  queryFn: () => listCategorias(),
});

const listQO = (categorySlug: string) =>
  queryOptions({
    queryKey: ["articles", "cat-global", categorySlug],
    queryFn: () => listArticlesByCategoryGlobal({ data: { categorySlug } }),
  });

export const Route = createFileRoute("/editoria/$categoria")({
  loader: async ({ context, params }) => {
    const [cats] = await Promise.all([
      context.queryClient.ensureQueryData(catsQO),
      context.queryClient.ensureQueryData(listQO(params.categoria)),
    ]);
    const categoria = cats.find((c) => c.slug === params.categoria) ?? {
      id: params.categoria,
      slug: params.categoria,
      name:
        params.categoria.charAt(0).toUpperCase() + params.categoria.slice(1),
    };
    return { categoria };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            {
              title: `${loaderData.categoria.name} — Vozes Paranaenses`,
            },
            {
              name: "description",
              content: `Últimas notícias de ${loaderData.categoria.name.toLowerCase()} com repercussão no Paraná.`,
            },
            {
              property: "og:title",
              content: `${loaderData.categoria.name} — Vozes Paranaenses`,
            },
            {
              property: "og:description",
              content: `Cobertura de ${loaderData.categoria.name.toLowerCase()} — Vozes Paranaenses.`,
            },
          ],
          links: [
            {
              rel: "alternate",
              type: "application/rss+xml",
              title: `RSS — ${loaderData.categoria.name}`,
              href: `/api/public/rss/categoria/${loaderData.categoria.slug}`,
            },
          ],
        }
      : { meta: [] },
  component: CategoryGlobalPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Editoria não encontrada.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Erro ao carregar: {error.message}
    </div>
  ),
});

function CategoryGlobalPage() {
  const { categoria: categoriaSlug } = Route.useParams();
  const { data: categorias } = useSuspenseQuery(catsQO);
  const cat =
    categorias.find((c) => c.slug === categoriaSlug) ?? {
      id: categoriaSlug,
      slug: categoriaSlug,
      name: categoriaSlug.charAt(0).toUpperCase() + categoriaSlug.slice(1),
    };
  const { data: articles } = useSuspenseQuery(listQO(categoriaSlug));

  const primary = "#0A2540";
  const accent = "#0066CC";

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Barlow',system-ui,sans-serif]">
      <SiteHeader />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
            Editoria
          </div>
          <h1
            className="mt-1 text-5xl leading-[1.02] md:text-6xl"
            style={{ color: primary }}
          >
            {cat.name}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {articles.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Ainda não há matérias publicadas nesta editoria.
          </div>
        ) : (
          <>
            {/* AdSense responsivo — no topo do feed global da editoria. */}
            <div className="mb-8">
              <AdsenseSlot slot="9449330789" />
            </div>
            <div className="grid gap-6 md:grid-cols-3">
            {articles.map((a) => (
              a.region ? (
                <Link
                  key={a.id}
                  to="/$region/$slug"
                  params={{ region: a.region.slug, slug: a.slug }}
                  className="group block"
                >
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
                  ) : (
                    <div className="aspect-[16/10] w-full" style={{ background: `${primary}15` }} />
                  )}
                  <div className="pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                      {cat.name} · {a.region.name}
                    </div>
                    <h3 className="mt-1 text-xl font-black leading-tight text-[#0A2540] group-hover:text-[#0d2f52] md:text-2xl">
                      {a.title}
                    </h3>
                    {a.summary && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.summary}</p>
                    )}
                  </div>
                </Link>
              ) : null
            ))}
            </div>
            {/* Multiplex ao final da grade global da editoria. */}
            <div className="mt-10">
              <AdsenseSlot slot="2880053002" format="autorelaxed" />
            </div>
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}