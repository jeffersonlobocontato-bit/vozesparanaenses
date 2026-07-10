import { createFileRoute } from "@tanstack/react-router";
import { listFeedArticles } from "@/lib/feeds.functions";
import { renderRss, RSS_HEADERS } from "@/lib/rss-render";

export const Route = createFileRoute("/api/public/rss/regiao/$region.xml")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const origin = new URL(request.url).origin;
        const { articles, scopeName } = await listFeedArticles({
          data: { regionSlug: params.region, limit: 40 },
        });
        const regionName = scopeName ?? params.region;
        const body = renderRss({
          origin,
          selfPath: `/api/public/rss/regiao/${params.region}.xml`,
          title: `Vozes Paranaenses — ${regionName}`,
          description: `Últimas notícias da região ${regionName}, Paraná.`,
          articles,
        });
        return new Response(body, { headers: RSS_HEADERS });
      },
    },
  },
});