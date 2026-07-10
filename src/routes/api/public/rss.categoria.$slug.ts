import { createFileRoute } from "@tanstack/react-router";
import { listFeedArticles } from "@/lib/feeds.functions";
import { renderRss, RSS_HEADERS } from "@/lib/rss-render";

export const Route = createFileRoute("/api/public/rss/categoria/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const origin = new URL(request.url).origin;
        const { articles, scopeName } = await listFeedArticles({
          data: { categoriaSlug: params.slug, limit: 40 },
        });
        const catName = scopeName ?? params.slug;
        const body = renderRss({
          origin,
          selfPath: `/api/public/rss/categoria/${params.slug}`,
          title: `Vozes Paranaenses — ${catName}`,
          description: `Últimas notícias de ${catName} no Paraná.`,
          articles,
        });
        return new Response(body, { headers: RSS_HEADERS });
      },
    },
  },
});