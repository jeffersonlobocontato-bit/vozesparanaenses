import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listArticlesByAuthor } from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

const authorQO = (slug: string) =>
  queryOptions({
    queryKey: ["author", slug],
    queryFn: () => listArticlesByAuthor({ data: { authorSlug: slug } }),
  });

const SITE = "https://vozesparanaenses.lovable.app";

export const Route = createFileRoute("/autor/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      authorQO(params.slug),
    );
    if (!data.authorName) throw notFound();
    return { authorName: data.authorName, count: data.articles.length };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Autor não encontrado — Vozes Paranaenses" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `${SITE}/autor/${params.slug}`;
    const desc = `Matérias assinadas por ${loaderData.authorName} no Vozes Paranaenses. ${loaderData.count} publicação(ões) editadas.`;
    return {
      meta: [
        { title: `${loaderData.authorName} — Vozes Paranaenses` },
        { name: "description", content: desc },
        { property: "og:title", content: loaderData.authorName },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: loaderData.authorName,
              url,
              jobTitle: "Editor(a) responsável",
              worksFor: {
                "@type": "NewsMediaOrganization",
                name: "Vozes Paranaenses",
                url: SITE,
              },
            },
          }),
        },
      ],
    };
  },
  component: AuthorPage,
  notFoundComponent: () => (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Autor não encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Não localizamos matérias assinadas por este editor.
        </p>
      </div>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Erro: {error.message}
    </div>
  ),
});

function AuthorPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(authorQO(slug));
  const { authorName, articles } = data;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Barlow',system-ui,sans-serif]">
      <SiteHeader />

      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Editor(a) responsável
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            {authorName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {articles.length} matéria(s) publicada(s) no Vozes Paranaenses.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <ul className="divide-y divide-slate-200">
          {articles.map((a) => (
            <li key={a.id} className="py-5">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {a.region?.name}
                {a.categoria ? ` · ${a.categoria.name}` : ""}
                {a.published_at
                  ? ` · ${new Date(a.published_at).toLocaleDateString("pt-BR")}`
                  : ""}
              </div>
              {a.region ? (
                <Link
                  to="/$region/$slug"
                  params={{ region: a.region.slug, slug: a.slug }}
                  className="mt-1 block text-lg font-semibold text-slate-900 hover:underline"
                >
                  {a.title}
                </Link>
              ) : (
                <span className="mt-1 block text-lg font-semibold">
                  {a.title}
                </span>
              )}
              {a.summary ? (
                <p className="mt-1 text-sm text-slate-600">{a.summary}</p>
              ) : null}
            </li>
          ))}
          {articles.length === 0 ? (
            <li className="py-5 text-sm text-slate-500">
              Nenhuma matéria publicada ainda.
            </li>
          ) : null}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}