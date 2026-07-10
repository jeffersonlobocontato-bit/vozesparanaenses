import { createFileRoute } from "@tanstack/react-router";
import { listLatestArticles } from "@/lib/content.functions";

/**
 * Sitemap para Google News. Apenas matérias publicadas nas últimas 48h,
 * com namespace news:news obrigatório.
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export const Route = createFileRoute("/api/public/sitemap-news.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const articles = await listLatestArticles({ data: { limit: 500 } }).catch(() => []);
        const cutoff = Date.now() - 1000 * 60 * 60 * 48;
        const recent = articles.filter((a) => {
          if (!a.region || !a.published_at) return false;
          const t = new Date(a.published_at).getTime();
          return Number.isFinite(t) && t >= cutoff;
        });

        const urls = recent.map((a) => {
          const loc = `${origin}/${a.region!.slug}/${a.slug}`;
          const keywords = [a.categoria?.name, a.region?.name, "Paraná"]
            .filter(Boolean)
            .map((k) => escapeXml(String(k)))
            .join(", ");
          return [
            `  <url>`,
            `    <loc>${escapeXml(loc)}</loc>`,
            `    <news:news>`,
            `      <news:publication>`,
            `        <news:name>Vozes Paranaenses</news:name>`,
            `        <news:language>pt</news:language>`,
            `      </news:publication>`,
            `      <news:publication_date>${a.published_at}</news:publication_date>`,
            `      <news:title>${escapeXml(a.title)}</news:title>`,
            keywords ? `      <news:keywords>${keywords}</news:keywords>` : "",
            `    </news:news>`,
            a.cover_image_url
              ? `    <image:image><image:loc>${escapeXml(a.cover_image_url)}</image:loc></image:image>`
              : "",
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n");
        });

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
          `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n` +
          `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
          urls.join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
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
