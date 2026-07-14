import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  getRegionBySlug,
  listArticlesByRegion,
  cidadeSlug,
} from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { WeatherWidget } from "@/components/WeatherWidget";
import { AdsenseSlot } from "@/components/AdsenseSlot";
import { arrangePinnedSlots } from "@/lib/pinned-layout";

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
  head: ({ loaderData, params }) =>
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
          links: [
            {
              rel: "alternate",
              type: "application/rss+xml",
              title: `RSS — ${loaderData.region.name}`,
              href: `/api/public/rss/regiao/${params.region}`,
            },
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

  const { hero, side: sideCards, rest } = arrangePinnedSlots(articles, 4, { region: slug });

  return (
    <div
      className="min-h-screen"
      style={{ background: "#ffffff", color: "#0f172a" }}
    >
      <SiteHeader />

      {/* Region sub-header — thin bar CGN-style */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-baseline gap-4 px-4 py-3">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            {region.name}
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {region.description ?? `${region.main_city} e cidades vizinhas`}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6">
        <WeatherWidget citySlug={cidadeSlug(region.main_city)} cidadeNome={region.main_city} />
      </div>

      {articles.length === 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-500">
              Ainda não há matérias publicadas para {region.name}. Volte em breve.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* Hero + side 2x2 grid (CGN pattern) */}
          <section className="mx-auto max-w-7xl px-4 py-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {hero && (
                <Link
                  to="/$region/$slug"
                  params={{ region: slug, slug: hero.slug }}
                  className="group block lg:col-span-2"
                >
                  {hero.cover_image_url ? (
                    <img
                      src={hero.cover_image_url}
                      alt=""
                      className="aspect-[16/10] w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div
                      className="aspect-[16/10] w-full"
                      style={{ background: `${primary}15` }}
                    />
                  )}
                  <div className="pt-4">
                    <div
                      className="text-[11px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: accent }}
                    >
                      {region.name}
                    </div>
                    <h1
                      className="mt-2 text-4xl font-black leading-[1.05] md:text-5xl lg:text-6xl"
                      style={{ color: primary }}
                    >
                      {hero.title}
                    </h1>
                    {hero.summary && (
                      <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
                        {hero.summary}
                      </p>
                    )}
                  </div>
                </Link>
              )}

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {sideCards.map((a) => (
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
                        className="aspect-[16/10] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="aspect-[16/10] w-full"
                        style={{ background: `${primary}15` }}
                      />
                    )}
                    <div className="pt-3">
                      <div
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: accent }}
                      >
                        {region.name}
                      </div>
                      <h3
                        className="mt-1 text-lg font-black leading-tight md:text-xl"
                      style={{ color: primary }}
                      >
                        {a.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* AdSense — responsivo entre o hero regional e a lista "Mais de X".
              Só renderiza quando há artigos publicados (evita anúncio em página
              vazia, que viola política do AdSense). Reutiliza o slot auto
              responsivo — TODO: criar um slot dedicado no painel do AdSense
              para separar métricas por página. */}
          <div className="mx-auto max-w-7xl px-4 py-2">
            <AdsenseSlot slot="9449330789" />
          </div>

          {rest.length > 0 && (
            <section className="mx-auto max-w-7xl px-4 py-8">
              <div
                className="mb-6 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: primary }}
              >
                Mais de {region.name}
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {rest.map((a) => (
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
                        className="aspect-[16/10] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="aspect-[16/10] w-full"
                        style={{ background: `${primary}15` }}
                      />
                    )}
                    <div className="pt-3">
                      <div
                        className="text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: accent }}
                      >
                        {region.name}
                      </div>
                      <h3
                        className="mt-1 text-xl font-black leading-tight md:text-2xl"
                      style={{ color: primary }}
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
            </section>
          )}
        </>
      )}

      <SiteFooter />
    </div>
  );
}

// avoid unused import warning
void notFound;