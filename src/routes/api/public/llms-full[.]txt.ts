import { createFileRoute } from "@tanstack/react-router";
import { listLatestArticles, listRegions } from "@/lib/content.functions";

/** /llms-full.txt — índice denso das últimas ~500 matérias para ingestão por LLM. */
export const Route = createFileRoute("/api/public/llms-full.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [regions, articles] = await Promise.all([
          listRegions().catch(() => []),
          listLatestArticles({ data: { limit: 500 } }).catch(() => []),
        ]);
        const lines: string[] = [];
        lines.push("# Vozes Paranaenses — Índice completo para LLMs");
        lines.push("");
        lines.push(
          `Portal regional cobrindo ${regions.length} macrorregiões do Paraná, Brasil. Lista abaixo cada matéria publicada com título, resumo curto, região, categoria, data e URL canônica.`,
        );
        lines.push("");
        for (const a of articles) {
          if (!a.region) continue;
          lines.push(`## ${a.title}`);
          lines.push("");
          if (a.subtitle) lines.push(`Subtítulo: ${a.subtitle}`);
          lines.push(`Região: ${a.region.name}`);
          if (a.categoria) lines.push(`Editoria: ${a.categoria.name}`);
          if (a.published_at) lines.push(`Publicado: ${a.published_at}`);
          lines.push(`URL: ${origin}/${a.region.slug}/${a.slug}`);
          if (a.summary) {
            lines.push("");
            lines.push(a.summary);
          }
          lines.push("");
        }
        return new Response(lines.join("\n"), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
