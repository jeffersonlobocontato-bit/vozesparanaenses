import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getRegionBySlug, listArticlesByCity } from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import {
  getCityCoords,
  formatGeoPosition,
  formatICBM,
  getNeighboringCities,
} from "@/lib/geo-cities";

const cityQO = (regionSlug: string, citySlug: string) =>
  queryOptions({
    queryKey: ["city", regionSlug, citySlug],
    queryFn: () => listArticlesByCity({ data: { regionSlug, citySlug, limit: 50 } }),
  });

const regionQO = (regionSlug: string) =>
  queryOptions({
    queryKey: ["region", regionSlug],
    queryFn: () => getRegionBySlug({ data: { slug: regionSlug } }),
  });

export const Route = createFileRoute("/$region/cidade/$cidade")({
  loader: async ({ context, params }) => {
    const [city, region] = await Promise.all([
      context.queryClient.ensureQueryData(cityQO(params.region, params.cidade)),
      context.queryClient.ensureQueryData(regionQO(params.region)),
    ]);
    return { city, region };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Cidade — Vozes Paranaenses" }] };
    const cityName = loaderData.city.cityName;
    const regionName = loaderData.region.name;
    const url = `/${params.region}/cidade/${params.cidade}`;
    const coords = getCityCoords(params.cidade);
    const title = `Notícias de ${cityName} — ${regionName} | Vozes Paranaenses`;
    const description = `Últimas notícias, política, economia, esporte e cultura de ${cityName} e cidades vizinhas no ${regionName}, Paraná.`;

    const collectionPage = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Notícias de ${cityName}`,
      description,
      inLanguage: "pt-BR",
      about: {
        "@type": "City",
        name: cityName,
        ...(coords
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: coords.lat,
                longitude: coords.lng,
              },
            }
          : {}),
        containedInPlace: {
          "@type": "AdministrativeArea",
          name: regionName,
          containedInPlace: { "@type": "State", name: "Paraná" },
        },
      },
      isPartOf: { "@type": "WebSite", name: "Vozes Paranaenses" },
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Vozes Paranaenses", item: "/" },
        { "@type": "ListItem", position: 2, name: regionName, item: `/${params.region}` },
        { "@type": "ListItem", position: 3, name: cityName, item: url },
      ],
    };

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: `${cityName}, ${regionName}, Paraná, notícias` },
        { name: "geo.region", content: "BR-PR" },
        { name: "geo.placename", content: `${cityName}, Paraná, Brasil` },
        ...(coords
          ? [
              { name: "geo.position", content: formatGeoPosition(coords) },
              { name: "ICBM", content: formatICBM(coords) },
            ]
          : []),
        { name: "robots", content: "index, follow, max-image-preview:large" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "pt_BR" },
      ],
      links: [
        { rel: "canonical", href: url },
        {
          rel: "alternate",
          type: "application/rss+xml",
          title: `RSS — ${cityName}`,
          href: `/api/public/rss/cidade/${params.region}/${params.cidade}`,
        },
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(collectionPage) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumb) },
      ],
    };
  },
  component: CityPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Cidade não encontrada.</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">Erro: {error.message}</div>
  ),
});

function CityPage() {
  const { region, cidade } = Route.useParams();
  const { data: city } = useSuspenseQuery(cityQO(region, cidade));
  const { data: reg } = useSuspenseQuery(regionQO(region));
  const neighbors = getNeighboringCities(cidade, 8);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <Link to="/" className="hover:text-[#0A2540]">Vozes Paranaenses</Link>
          <span className="text-slate-300">›</span>
          <Link to="/$region" params={{ region }} className="hover:text-[#0A2540]">
            {reg.name}
          </Link>
          <span className="text-slate-300">›</span>
          <span className="text-[#0A2540]">{city.cityName}</span>
        </nav>

        <header className="mb-8 border-b border-slate-200 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#0A2540]">
            {reg.name} · Paraná
          </div>
          <h1 className="mt-2 font-display text-5xl font-black leading-none tracking-tight text-[#0A2540] md:text-6xl">
            Notícias de {city.cityName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Últimas matérias sobre {city.cityName} e cidades vizinhas — política, economia, cultura,
            esporte e cotidiano no {reg.name}.
          </p>
        </header>

        {city.articles.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ainda não temos matérias marcadas com esta cidade.{" "}
            <Link to="/$region" params={{ region }} className="text-[#0A2540] underline">
              Ver tudo do {reg.name}
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {city.articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region, slug: a.slug }}
                className="group block"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                  {a.cover_image_url ? (
                    <img
                      src={a.cover_image_url}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#0A2540]/10 text-xs uppercase tracking-widest text-[#0A2540]/60">
                      Sem imagem
                    </div>
                  )}
                </div>
                {a.categoria && (
                  <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2540]">
                    {a.categoria.name}
                  </div>
                )}
                <h2 className="mt-1 font-display text-xl font-bold leading-[1.1] text-slate-900 group-hover:text-[#0A2540]">
                  {a.title}
                </h2>
                {a.subtitle && (
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{a.subtitle}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {neighbors.length > 0 && (
          <section className="mt-14 border-t border-slate-200 pt-8">
            <h2 className="font-display text-2xl font-bold text-[#0A2540]">
              Cidades vizinhas
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Explore notícias das cidades mais próximas de {city.cityName}.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {neighbors.map((n) => (
                <li key={n.slug}>
                  <Link
                    to="/$region/cidade/$cidade"
                    params={{ region, cidade: n.slug }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A2540] transition-colors hover:border-[#0A2540] hover:bg-[#0A2540] hover:text-white"
                  >
                    <span>{n.name}</span>
                    <span className="text-[10px] font-normal text-slate-500 group-hover:text-white/80">
                      {Math.round(n.distanceKm)} km
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
