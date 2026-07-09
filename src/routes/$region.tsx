import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  getRegionBySlug,
  listArticlesByRegion,
} from "@/lib/content.functions";

const regionQO = (slug: string) =>
  queryOptions({
    queryKey: ["region", slug],
    queryFn: () => getRegionBySlug({ data: { slug } }),
  });
const articlesQO = (slug: string) =>
  queryOptions({
    queryKey: ["articles", "region", slug],
    queryFn: () => listArticlesByRegion({ data: { regionSlug: slug } }),
  });

export const Route = createFileRoute("/$region")({
  loader: async ({ context, params }) => {
    const region = await context.queryClient.ensureQueryData(
      regionQO(params.region),
    );
    await context.queryClient.ensureQueryData(articlesQO(params.region));
    return { region };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.region.name} — Paraná Total` },
            {
              name: "description",
              content:
                loaderData.region.description ??
                `Notícias da região ${loaderData.region.name}, PR.`,
            },
            {
              property: "og:title",
              content: `${loaderData.region.name} — Paraná Total`,
            },
            {
              property: "og:description",
              content:
                loaderData.region.description ??
                `Notícias da região ${loaderData.region.name}, PR.`,
            },
            ...(loaderData.region.hero_image_url
              ? [
                  {
                    property: "og:image",
                    content: loaderData.region.hero_image_url,
                  },
                ]
              : []),
          ],
        }
      : { meta: [] },
  component: RegionPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Região não encontrada.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Erro ao carregar região: {error.message}
    </div>
  ),
});

function RegionPage() {
  const { region: slug } = Route.useParams();
  const { data: region } = useSuspenseQuery(regionQO(slug));
  const { data: articles } = useSuspenseQuery(articlesQO(slug));

  const primary = region.primary_color ?? "#0EA5E9";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold">
            Paraná<span style={{ color: primary }}>Total</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← Todas as regiões
          </Link>
        </div>
      </header>

      <section
        className="border-b"
        style={{ background: `linear-gradient(135deg, ${primary}22, transparent)` }}
      >
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: primary }}>
            Região
          </div>
          <h1 className="mt-1 text-4xl font-bold">{region.name}</h1>
          <p className="mt-2 text-muted-foreground">
            {region.description ?? `Notícias de ${region.main_city} e cidades vizinhas.`}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há notícias publicadas para esta região.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: slug, slug: a.slug }}
                className="group overflow-hidden rounded-lg border hover:border-primary"
              >
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 w-full bg-muted" />
                )}
                <div className="p-4">
                  <h3 className="font-semibold group-hover:text-primary">{a.title}</h3>
                  {a.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {a.summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// avoid unused import warning
void notFound;