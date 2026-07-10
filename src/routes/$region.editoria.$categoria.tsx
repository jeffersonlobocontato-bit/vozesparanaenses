import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  getRegionBySlug,
  listArticlesByCategory,
  listCategorias,
} from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

const regionQO = (slug: string) =>
  queryOptions({
    queryKey: ["region", slug],
    queryFn: () => getRegionBySlug({ data: { slug } }),
  });

const catsQO = queryOptions({
  queryKey: ["categorias"],
  queryFn: () => listCategorias(),
});

const listQO = (regionSlug: string, categorySlug: string) =>
  queryOptions({
    queryKey: ["articles", "cat", regionSlug, categorySlug],
    queryFn: () =>
      listArticlesByCategory({ data: { regionSlug, categorySlug } }),
  });

export const Route = createFileRoute("/$region/editoria/$categoria")({
  loader: async ({ context, params }) => {
    const [region, cats] = await Promise.all([
      context.queryClient.ensureQueryData(regionQO(params.region)),
      context.queryClient.ensureQueryData(catsQO),
    ]);
    await context.queryClient.ensureQueryData(
      listQO(params.region, params.categoria),
    );
    const categoria = cats.find((c) => c.slug === params.categoria) ?? {
      id: params.categoria,
      slug: params.categoria,
      name:
        params.categoria.charAt(0).toUpperCase() + params.categoria.slice(1),
    };
    return { region, categoria };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            {
              title: `${loaderData.categoria.name} em ${loaderData.region.name} — Vozes Paranaenses`,
            },
            {
              name: "description",
              content: `Últimas notícias de ${loaderData.categoria.name.toLowerCase()} em ${loaderData.region.name}, Paraná.`,
            },
            {
              property: "og:title",
              content: `${loaderData.categoria.name} em ${loaderData.region.name}`,
            },
            {
              property: "og:description",
              content: `Cobertura de ${loaderData.categoria.name.toLowerCase()} em ${loaderData.region.name}.`,
            },
          ],
        }
      : { meta: [] },
  component: CategoryPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Categoria não encontrada.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Erro ao carregar: {error.message}
    </div>
  ),
});

function CategoryPage() {
  const { region: regionSlug, categoria: categoriaSlug } = Route.useParams();
  const { data: region } = useSuspenseQuery(regionQO(regionSlug));
  const { data: categoria } = useSuspenseQuery(catsQO);
  const cat =
    categoria.find((c) => c.slug === categoriaSlug) ?? {
      id: categoriaSlug,
      slug: categoriaSlug,
      name: categoriaSlug.charAt(0).toUpperCase() + categoriaSlug.slice(1),
    };
  const { data: articles } = useSuspenseQuery(listQO(regionSlug, categoriaSlug));

  const primary = region.tema_config?.paleta?.primaria ?? "#0A2540";
  const accent = region.tema_config?.paleta?.acento ?? "#0066CC";
  const fontDisplay = region.tema_config?.tipografia_destaque ?? "Bebas Neue";

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Barlow',system-ui,sans-serif]">
      <SiteHeader />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
            {region.name} · Editoria
          </div>
          <h1
            className="mt-1 text-5xl leading-[1.02] md:text-6xl"
            style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif`, color: primary }}
          >
            {cat.name}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {articles.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Ainda não há matérias publicadas nesta editoria para {region.name}.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: regionSlug, slug: a.slug }}
                className="group block"
              >
                {a.cover_image_url ? (
                  <img src={a.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
                ) : (
                  <div className="aspect-[16/10] w-full" style={{ background: `${primary}15` }} />
                )}
                <div className="pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                    {cat.name}
                  </div>
                  <h3
                    className="mt-1 text-xl font-black leading-tight text-[#0A2540] group-hover:text-[#0d2f52] md:text-2xl"
                    style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif` }}
                  >
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.summary}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}