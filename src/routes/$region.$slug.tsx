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
            { title: loaderData.article.seo_title ?? loaderData.article.title },
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold">
            Paraná<span className="text-primary">Total</span>
          </Link>
          <Link
            to="/$region"
            params={{ region }}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← {article.region?.name ?? "Região"}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">
          {article.region?.name}
        </div>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{article.title}</h1>
        {article.subtitle && (
          <p className="mt-3 text-lg text-muted-foreground">{article.subtitle}</p>
        )}
        {article.published_at && (
          <div className="mt-3 text-xs text-muted-foreground">
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
          <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap text-base leading-relaxed">
            {article.body_md}
          </div>
        )}
      </article>
    </div>
  );
}