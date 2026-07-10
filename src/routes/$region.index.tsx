import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  getRegionBySlug,
  listArticlesByRegion,
} from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

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

export const Route = createFileRoute("/$region/")({
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
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: `'${fontBody}', system-ui, sans-serif`,
      }}
    >
      <SiteHeader />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accent }}>
            Região · Paraná
          </div>
          <h1
            className="mt-1 text-5xl leading-[1.02] md:text-6xl"
            style={{ fontFamily: `'${fontDisplay}', system-ui, sans-serif`, color: primary }}
          >
            {region.name}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            {region.description ?? `Notícias de ${region.main_city} e cidades vizinhas.`}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {articles.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-500">
              Ainda não há matérias publicadas para {region.name}. Volte em breve.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: slug, slug: a.slug }}
                className="group block"
              >
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-[16/10] w-full" style={{ background: `${primary}15` }} />
                )}
                <div className="pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                    {region.name}
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

// avoid unused import warning
void notFound;