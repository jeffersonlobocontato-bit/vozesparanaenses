import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArticle } from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

const articleQO = (regionSlug: string, slug: string) =>
  queryOptions({
    queryKey: ["article", regionSlug, slug],
    queryFn: () => getArticle({ data: { regionSlug, slug } }),
  });

export const Route = createFileRoute("/$region/$slug")({
  loader: async ({ context, params }) => {
    const article = await context.queryClient.ensureQueryData(
      articleQO(params.region, params.slug),
    );
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

  const publishedAt = article.published_at ? new Date(article.published_at) : null;
  const publishedLabel = publishedAt
    ? `${publishedAt.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })} às ${publishedAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
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

        {/* CTA voltar */}
        <div className="mx-auto mt-12 max-w-3xl">
          <Link
            to="/$region"
            params={{ region }}
            className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#0A2540] hover:text-[#0d2f52]"
          >
            <span className="inline-block h-px w-8 bg-[#0A2540] transition-all group-hover:w-12" />
            Mais de {article.region?.name ?? "sua região"}
          </Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}