import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArticle, listArticlesByRegion, cidadeSlug } from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

const articleQO = (regionSlug: string, slug: string) =>
  queryOptions({
    queryKey: ["article", regionSlug, slug],
    queryFn: () => getArticle({ data: { regionSlug, slug } }),
  });

const relatedQO = (regionSlug: string) =>
  queryOptions({
    queryKey: ["region-related", regionSlug],
    queryFn: () => listArticlesByRegion({ data: { regionSlug, limit: 9 } }),
  });

export const Route = createFileRoute("/$region/$slug")({
  loader: async ({ context, params }) => {
    const [article] = await Promise.all([
      context.queryClient.ensureQueryData(articleQO(params.region, params.slug)),
      context.queryClient.ensureQueryData(relatedQO(params.region)),
    ]);
    return { article };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Matéria indisponível — Vozes Paranaenses" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const a = loaderData.article;
    const title = a.seo_title ?? a.title;
    const description = a.seo_description ?? a.summary ?? a.title;
    const image = a.og_image_url ?? a.cover_image_url ?? null;
    const regionName = a.region?.name ?? null;
    const regionSlug = a.region?.slug ?? params.region;
    const cidade = a.cidade_principal ?? null;
    const url = `/${regionSlug}/${a.slug}`;
    const keywords = [
      cidade,
      regionName,
      a.categoria?.name,
      ...(a.cidades_mencionadas ?? []),
      "Paraná",
      "notícias",
    ]
      .filter(Boolean)
      .join(", ");

    const meta: Array<Record<string, string>> = [
      { title: `${title} — Vozes Paranaenses` },
      { name: "description", content: description },
      { name: "keywords", content: keywords },
      { name: "news_keywords", content: keywords },
      { name: "author", content: "Redação Vozes Paranaenses" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      // Geo tags — o site inteiro é PR
      { name: "geo.region", content: "BR-PR" },
      { name: "geo.country", content: "BR" },
      ...(cidade
        ? [{ name: "geo.placename", content: `${cidade}, Paraná, Brasil` }]
        : regionName
          ? [{ name: "geo.placename", content: `${regionName}, Paraná, Brasil` }]
          : []),
      // Open Graph
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Vozes Paranaenses" },
      { property: "og:locale", content: "pt_BR" },
      { property: "article:published_time", content: a.published_at ?? "" },
      { property: "article:modified_time", content: a.updated_at ?? a.published_at ?? "" },
      { property: "article:section", content: a.categoria?.name ?? "Notícia" },
      ...(cidade ? [{ property: "article:tag", content: cidade }] : []),
      ...(regionName ? [{ property: "article:tag", content: regionName }] : []),
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image
        ? [
            { property: "og:image", content: image },
            { property: "og:image:alt", content: a.title },
            { name: "twitter:image", content: image },
          ]
        : []),
    ];

    // JSON-LD: NewsArticle enriquecido geograficamente
    const contentLocation = cidade
      ? {
          "@type": "City",
          name: cidade,
          containedInPlace: {
            "@type": "AdministrativeArea",
            name: regionName ?? "Paraná",
            containedInPlace: {
              "@type": "State",
              name: "Paraná",
              containedInPlace: { "@type": "Country", name: "Brasil" },
            },
          },
        }
      : undefined;

    const spatialCoverage = (a.cidades_mencionadas ?? [])
      .filter((c) => !!c)
      .map((c) => ({
        "@type": "Place",
        name: c,
        containedInPlace: { "@type": "State", name: "Paraná" },
      }));

    const wordCount = a.body_md ? a.body_md.trim().split(/\s+/).filter(Boolean).length : undefined;

    const newsArticle = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: a.title,
      alternativeHeadline: a.subtitle ?? undefined,
      description,
      image: image ? [image] : undefined,
      datePublished: a.published_at ?? undefined,
      dateModified: a.updated_at ?? a.published_at ?? undefined,
      inLanguage: "pt-BR",
      isAccessibleForFree: true,
      articleSection: a.categoria?.name ?? undefined,
      wordCount,
      keywords,
      author: { "@type": "Organization", name: "Redação Vozes Paranaenses" },
      publisher: {
        "@type": "NewsMediaOrganization",
        name: "Vozes Paranaenses",
        url: "/",
        logo: {
          "@type": "ImageObject",
          url: "/favicon.ico",
        },
        areaServed: { "@type": "State", name: "Paraná", containedInPlace: { "@type": "Country", name: "Brasil" } },
      },
      contentLocation,
      spatialCoverage: spatialCoverage.length > 0 ? spatialCoverage : undefined,
      about: contentLocation ? [contentLocation] : undefined,
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["h1", ".article-lead", ".article-tldr"],
      },
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Vozes Paranaenses", item: "/" },
        ...(regionName
          ? [{ "@type": "ListItem", position: 2, name: regionName, item: `/${regionSlug}` }]
          : []),
        ...(cidade
          ? [
              {
                "@type": "ListItem",
                position: 3,
                name: cidade,
                item: `/${regionSlug}/cidade/${cidadeSlug(cidade)}`,
              },
              { "@type": "ListItem", position: 4, name: a.title, item: url },
            ]
          : [{ "@type": "ListItem", position: 3, name: a.title, item: url }]),
      ],
    };

    const faqSchema =
      a.faq && a.faq.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: a.faq.map((f) => ({
              "@type": "Question",
              name: f.pergunta,
              acceptedAnswer: { "@type": "Answer", text: f.resposta },
            })),
          }
        : null;

    return {
      meta,
      links: [
        { rel: "canonical", href: url },
        ...(cidade
          ? [{ rel: "alternate", href: `/${regionSlug}/cidade/${cidadeSlug(cidade)}` }]
          : []),
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(newsArticle) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumb) },
        ...(faqSchema
          ? [{ type: "application/ld+json", children: JSON.stringify(faqSchema) }]
          : []),
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Matéria não encontrada.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Erro ao carregar matéria: {error.message}
    </div>
  ),
});

function ArticlePage() {
  const { region, slug } = Route.useParams();
  const { data: article } = useSuspenseQuery(articleQO(region, slug));
  const { data: relatedAll } = useSuspenseQuery(relatedQO(region));
  const related = relatedAll.filter((r) => r.slug !== slug).slice(0, 8);

  const publishedAt = article.published_at ? new Date(article.published_at) : null;
  const publishedLabel = publishedAt
    ? `${publishedAt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })} às ${publishedAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })}`
    : null;
  const categoria = article.categoria?.name ?? article.region?.name ?? "Notícia";
  const categoriaSlug = article.categoria?.slug ?? null;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-4 pb-16 pt-8 md:pt-12">
        {/* Breadcrumb + categoria */}
        <div className="mb-6 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <Link to="/$region" params={{ region }} className="hover:text-[#0A2540]">
            {article.region?.name}
          </Link>
          <span className="text-slate-300">›</span>
          {categoriaSlug ? (
            <Link
              to="/$region/editoria/$categoria"
              params={{ region, categoria: categoriaSlug }}
              className="rounded-sm bg-[#0A2540] px-2 py-1 text-white transition-colors hover:bg-[#0d2f52]"
            >
              {categoria}
            </Link>
          ) : (
            <span className="rounded-sm bg-[#0A2540] px-2 py-1 text-white">{categoria}</span>
          )}
        </div>

        {/* Headline massivo, no acento da marca */}
        <h1 className="font-display text-4xl font-black leading-[1.02] tracking-tight text-[#0A2540] md:text-6xl lg:text-7xl">
          {article.title}
        </h1>

        {/* Publicação */}
        {publishedLabel && (
          <div className="mt-6 border-l-2 border-[#0A2540]/20 pl-3 text-sm text-slate-600">
            Publicado em <span className="font-semibold text-slate-800">{publishedLabel}</span>
          </div>
        )}

        {/* Lead (subtítulo) */}
        {article.subtitle && (
          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-slate-700 md:text-2xl">
            {article.subtitle}
          </p>
        )}

        {/* TL;DR — resposta direta (answer-first para motores de IA) */}
        {article.tldr && (
          <aside
            className="article-tldr mx-auto mt-8 max-w-3xl border-l-4 border-[#0A2540] bg-slate-50 p-4"
            aria-label="Resumo rápido"
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0A2540]">
              Em resumo
            </div>
            <p className="text-base leading-relaxed text-slate-800">{article.tldr}</p>
          </aside>
        )}

        {/* Hero visual */}
        {article.cover_image_url && (
          <figure className="mt-8">
            <img
              src={article.cover_image_url}
              alt={article.title}
              className="w-full rounded-sm object-cover shadow-[0_20px_60px_-20px_rgba(10,37,64,0.35)]"
            />
            {"imagem_credito" in article && (article as { imagem_credito?: string }).imagem_credito && (
              <figcaption className="mt-2 text-xs italic text-slate-500">
                {(article as { imagem_credito?: string }).imagem_credito}
              </figcaption>
            )}
          </figure>
        )}

        {/* 5W1H — os fatos essenciais */}
        {article.fatos_5w1h && (
          <section className="mx-auto mt-10 max-w-3xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0A2540]">
              Os fatos
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {(
                [
                  ["quem", "Quem"],
                  ["o_que", "O quê"],
                  ["quando", "Quando"],
                  ["onde", "Onde"],
                  ["por_que", "Por quê"],
                  ["como", "Como"],
                ] as const
              ).map(([k, label]) => {
                const v = article.fatos_5w1h?.[k];
                if (!v) return null;
                return (
                  <div key={k} className="border-l-2 border-slate-200 pl-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800">{v}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {/* Corpo */}
        {article.body_md && (
          <div
            className="mx-auto mt-10 max-w-3xl whitespace-pre-wrap font-body text-lg leading-[1.75] text-slate-800
                       [&>p]:mb-6 first-letter:float-left first-letter:mr-3 first-letter:pt-1
                       first-letter:font-display first-letter:text-6xl first-letter:font-black
                       first-letter:leading-[0.85] first-letter:text-[#0A2540]"
          >
            {article.body_md}
          </div>
        )}

        {/* FAQ — perguntas frequentes */}
        {article.faq && article.faq.length > 0 && (
          <section className="mx-auto mt-12 max-w-3xl border-t border-slate-200 pt-8">
            <h2 className="mb-6 font-display text-2xl font-black text-[#0A2540]">
              Perguntas frequentes
            </h2>
            <div className="space-y-5">
              {article.faq.map((f, i) => (
                <details
                  key={i}
                  className="group border-b border-slate-200 pb-4"
                  {...(i === 0 ? { open: true } : {})}
                >
                  <summary className="cursor-pointer list-none text-base font-bold text-slate-900 marker:hidden hover:text-[#0A2540]">
                    <span className="mr-2 text-[#0A2540] group-open:rotate-90 inline-block transition-transform">›</span>
                    {f.pergunta}
                  </summary>
                  <p className="mt-3 pl-5 text-[15px] leading-relaxed text-slate-700">
                    {f.resposta}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Assinatura / marca no fim do texto */}
        <div className="mx-auto mt-10 max-w-3xl border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500">
            <span>
              Redação <span className="font-bold text-[#0A2540]">Vozes Paranaenses</span>
            </span>
            {article.region?.name && <span>{article.region.name} · PR</span>}
          </div>
        </div>

      </article>

      {/* MAIS {REGIÃO} — grade de miniaturas ao estilo CGN */}
      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-block bg-[#0A2540] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">
                Mais {article.region?.name ?? "da região"}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
              <Link
                to="/$region"
                params={{ region }}
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0A2540] hover:text-[#0d2f52]"
              >
                Ver todas ›
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to="/$region/$slug"
                  params={{ region, slug: r.slug }}
                  className="group block"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                    {r.cover_image_url ? (
                      <img
                        src={r.cover_image_url}
                        alt={r.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#0A2540]/10 text-xs uppercase tracking-widest text-[#0A2540]/60">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  {r.categoria && (
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2540]">
                      {r.categoria.name}
                    </div>
                  )}
                  <h3 className="mt-1 font-display text-xl font-bold leading-[1.1] text-slate-900 group-hover:text-[#0A2540]">
                    {r.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}