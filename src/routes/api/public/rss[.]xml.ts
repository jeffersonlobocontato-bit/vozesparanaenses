import { createFileRoute } from "@tanstack/react-router";
import { listLatestArticles } from "@/lib/content.functions";

/** RSS 2.0 principal — todas as regiões. */
export const Route = createFileRoute("/api/public/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const articles = await listLatestArticles({ data: { limit: 60 } }).catch(() => []);
        const items = articles
          .filter((a) => a.region)
          .map((a) => {
            const url = `${origin}/${a.region!.slug}/${a.slug}`;
            const cat = a.categoria?.name ?? a.region!.name;
            const pub = a.published_at ? new Date(a.published_at).toUTCString() : new Date().toUTCString();
            return [
              `    <item>`,
              `      <title>${escapeXml(a.title)}</title>`,
              `      <link>${escapeXml(url)}</link>`,
              `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
              `      <pubDate>${pub}</pubDate>`,
              `      <category>${escapeXml(cat)}</category>`,
              a.summary ? `      <description>${escapeXml(a.summary)}</description>` : "",
              a.cover_image_url
                ? `      <enclosure url="${escapeXml(a.cover_image_url)}" type="image/jpeg" />`
                : "",
              `    </item>`,
            ]
              .filter(Boolean)
              .join("\n");
          });

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
          `  <channel>\n` +
          `    <title>Vozes Paranaenses</title>\n` +
          `    <link>${origin}/</link>\n` +
          `    <description>Portal de notícias das 10 macrorregiões do Paraná.</description>\n` +
          `    <language>pt-BR</language>\n` +
          `    <atom:link href="${origin}/api/public/rss.xml" rel="self" type="application/rss+xml" />\n` +
          items.join("\n") +
          `\n  </channel>\n` +
          `</rss>\n`;

        return new Response(body, {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=600",
            "x-robots-tag": "all, max-image-preview:large, max-snippet:-1",
          },
        });
      },
    },
  },
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
