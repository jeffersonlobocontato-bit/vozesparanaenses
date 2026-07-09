import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArticle } from "@/lib/content.functions";

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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b-4 border-primary">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-2xl leading-none tracking-tight text-primary">
            VOZES <span className="text-secondary">PARANAENSES</span>
          </Link>
          <Link
            to="/$region"
            params={{ region }}
            className="text-sm text-slate-600 hover:text-secondary"
          >
            ← {article.region?.name ?? "Região"}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-xs font-bold uppercase tracking-widest text-secondary">
          {article.categoria?.name ?? article.region?.name}
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{article.title}</h1>
        {article.subtitle && (
          <p className="mt-3 text-lg text-slate-600">{article.subtitle}</p>
        )}
        {article.published_at && (
          <div className="mt-3 text-xs text-slate-500">
            {new Date(article.published_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        )}
        {article.cover_image_url && (
          <img
            src={article.cover_image_url}
            alt=""
            className="mt-6 aspect-video w-full rounded-lg object-cover"
          />
        )}
        {article.body_md && (
          <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
            {article.body_md}
          </div>
        )}

        <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
          <p className="text-sm text-slate-600">
            Recebeu essa matéria? Continue acompanhando as notícias da sua região.
          </p>
          <Link
            to="/$region"
            params={{ region }}
            className="mt-3 inline-block rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"
          >
            Ver mais de {article.region?.name}
          </Link>
        </div>
      </article>
    </div>
  );
}