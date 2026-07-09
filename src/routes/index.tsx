import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listRegions, listLatestArticles } from "@/lib/content.functions";

const regionsQO = queryOptions({
  queryKey: ["regions"],
  queryFn: () => listRegions(),
});
const latestQO = queryOptions({
  queryKey: ["articles", "latest", 12],
  queryFn: () => listLatestArticles({ data: { limit: 12 } }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paraná Total — Notícias das 10 regiões do Paraná" },
      {
        name: "description",
        content:
          "Cobertura completa e regional do Paraná: Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte Central, Noroeste, Oeste, Sudoeste e Centro-Sul.",
      },
      { property: "og:title", content: "Paraná Total" },
      {
        property: "og:description",
        content: "Notícias das 10 regiões do Paraná em um só lugar.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(regionsQO),
      context.queryClient.ensureQueryData(latestQO),
    ]);
  },
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar. {error.message}
    </div>
  ),
});

function Home() {
  const { data: regions } = useSuspenseQuery(regionsQO);
  const { data: articles } = useSuspenseQuery(latestQO);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            Paraná<span className="text-primary">Total</span>
          </Link>
          <nav className="hidden gap-4 text-sm md:flex">
            {regions.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                to="/$region"
                params={{ region: r.slug }}
                className="hover:text-primary"
              >
                {r.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold md:text-4xl">As 10 regiões do Paraná</h1>
        <p className="mt-2 text-muted-foreground">
          Escolha uma região para ver as notícias locais.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {regions.map((r) => (
            <Link
              key={r.id}
              to="/$region"
              params={{ region: r.slug }}
              className="group rounded-lg border p-4 transition-colors hover:border-primary"
              style={{ borderTop: `4px solid ${r.primary_color ?? "#0EA5E9"}` }}
            >
              <div className="text-sm font-semibold group-hover:text-primary">
                {r.name}
              </div>
              <div className="text-xs text-muted-foreground">{r.main_city}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-2xl font-bold">Últimas notícias</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há notícias publicadas. O pipeline editorial começa em breve.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: a.region?.slug ?? "", slug: a.slug }}
                className="group overflow-hidden rounded-lg border hover:border-primary"
              >
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 w-full bg-muted" />
                )}
                <div className="p-4">
                  <div className="text-xs uppercase tracking-wide text-primary">
                    {a.region?.name}
                  </div>
                  <h3 className="mt-1 font-semibold group-hover:text-primary">
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {a.summary}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Paraná Total
      </footer>
    </div>
  );
}
