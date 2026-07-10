import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArticle, listArticlesByRegion } from "@/lib/content.functions";
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
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.article.seo_title ?? loaderData.article.title} — Vozes Paranaenses` },
            {
              name: "description",
              content:
                loaderData.article.seo_description ??
                loaderData.article.summary ??
                loaderData.article.title,
            },
            {
              property: "og:title",
              content: loaderData.article.seo_title ?? loaderData.article.title,
            },
            {
              property: "og:description",
              content:
                loaderData.article.seo_description ??
                loaderData.article.summary ??
                loaderData.article.title,
            },
            { property: "og:type", content: "article" },
            ...(loaderData.article.og_image_url ?? loaderData.article.cover_image_url
              ? [
                  {
                    property: "og:image",
                    content:
                      loaderData.article.og_image_url ??
                      loaderData.article.cover_image_url!,
                  },
                  {
                    name: "twitter:image",
                    content:
                      loaderData.article.og_image_url ??
                      loaderData.article.cover_image_url!,
                  },
                ]
              : []),
          ],
          scripts: [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: loaderData.article.title,
                description:
                  loaderData.article.seo_description ?? loaderData.article.summary ?? undefined,
                image: loaderData.article.og_image_url ?? loaderData.article.cover_image_url ?? undefined,
                datePublished: loaderData.article.published_at ?? undefined,
                articleSection: loaderData.article.categoria?.name ?? undefined,
                publisher: {
                  "@type": "Organization",
                  name: "Vozes Paranaenses",
                },
              }),
            },
          ],
        }
      : { meta: [] },
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