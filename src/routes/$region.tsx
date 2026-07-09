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
            { title: `${loaderData.region.name} — Vozes Paranaenses` },
            {
              name: "description",
              content:
                loaderData.region.description ??
                `Notícias da região ${loaderData.region.name}, PR.`,
            },
            {
              property: "og:title",
              content: `${loaderData.region.name} — Vozes Paranaenses`,
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

  const tema = region.tema_config ?? {};
  const primary = tema.paleta?.primaria ?? "#0A2540";
  const accent = tema.paleta?.acento ?? "#0066CC";
  const bg = tema.paleta?.fundo ?? "#FFFFFF";
  const fontDisplay = tema.tipografia_destaque ?? "Bebas Neue";
  const fontBody = tema.tipografia_corpo ?? "Barlow";

  return (
    <div
      className="min-h-screen"
      style={{
        background: bg,
        color: "#0f172a",
        fontFamily: `'${fontBody}', system-ui, sans-serif`,
      }}
    >
      <header className="border-b-4" style={{ borderColor: primary, background: "#fff" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="text-2xl leading-none tracking-tight"
            style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif`, color: primary }}
          >
            VOZES <span style={{ color: accent }}>PARANAENSES</span>
          </Link>
          <Link to="/" className="text-sm text-slate-600 hover:opacity-70">
            ← Todas as regiões
          </Link>
        </div>
      </header>

      <section
        className="border-b border-slate-200"
        style={{ background: `linear-gradient(135deg, ${primary}18, transparent)` }}
      >
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            Região
          </div>
          <h1
            className="mt-1 text-5xl md:text-6xl leading-none"
            style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif`, color: primary }}
          >
            {region.name}
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            {region.description ?? `Notícias de ${region.main_city} e cidades vizinhas.`}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {articles.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-500">
              Ainda não há matérias publicadas para {region.name}. Volte em breve.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: slug, slug: a.slug }}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md"
                style={{ borderTopWidth: 3, borderTopColor: accent }}
              >
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 w-full" style={{ background: `${primary}15` }} />
                )}
                <div className="p-4">
                  <h3
                    className="text-lg leading-tight group-hover:underline"
                    style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif`, color: primary }}
                  >
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
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