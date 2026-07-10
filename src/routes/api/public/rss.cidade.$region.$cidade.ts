import { createFileRoute } from "@tanstack/react-router";
import { listFeedArticles } from "@/lib/feeds.functions";
import { cidadeFromSlug } from "@/lib/content.functions";
import { renderRss, RSS_HEADERS } from "@/lib/rss-render";

export const Route = createFileRoute("/api/public/rss/cidade/$region/$cidade")(
  {
    server: {
      handlers: {
        GET: async ({ request, params }) => {
          const origin = new URL(request.url).origin;
          const { articles } = await listFeedArticles({
            data: {
              regionSlug: params.region,
              citySlug: params.cidade,
              limit: 40,
            },
          });
          const cityName = cidadeFromSlug(params.cidade);
          const body = renderRss({
            origin,
            selfPath: `/api/public/rss/cidade/${params.region}/${params.cidade}`,
            title: `Vozes Paranaenses — ${cityName}`,
            description: `Últimas notícias de ${cityName} e cidades vizinhas, Paraná.`,
            articles,
          });
          return new Response(body, { headers: RSS_HEADERS });
        },
      },
    },
  },
);