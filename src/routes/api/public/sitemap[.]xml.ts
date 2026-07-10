import { createFileRoute } from "@tanstack/react-router";
import {
  listRegions,
  listLatestArticles,
  listAllCityLandings,
  listAuthors,
} from "@/lib/content.functions";

export const Route = createFileRoute("/api/public/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [regions, articles, cities, authors] = await Promise.all([
          listRegions().catch(() => []),
          listLatestArticles({ data: { limit: 1000 } }).catch(() => []),
          listAllCityLandings().catch(() => []),
          listAuthors().catch(() => []),
        ]);

        const urls: { loc: string; lastmod?: string; priority?: string }[] = [
          { loc: `${origin}/`, priority: "1.0" },
          { loc: `${origin}/sobre`, priority: "0.5" },
          { loc: `${origin}/whatsapp`, priority: "0.6" },
          { loc: `${origin}/contato`, priority: "0.4" },
          { loc: `${origin}/politica-editorial`, priority: "0.4" },
          { loc: `${origin}/correcoes`, priority: "0.4" },
          { loc: `${origin}/privacidade`, priority: "0.3" },
          { loc: `${origin}/termos`, priority: "0.3" },
        ];
        for (const r of regions) {
          urls.push({ loc: `${origin}/${r.slug}`, priority: "0.8" });
          urls.push({ loc: `${origin}/${r.slug}/classificados`, priority: "0.5" });
        }

        for (const c of cities) {
          urls.push({
            loc: `${origin}/${c.regionSlug}/cidade/${c.citySlug}`,
            lastmod: c.lastmod ?? undefined,
            priority: "0.7",
          });
        }

        for (const a of articles) {
          if (!a.region) continue;
          urls.push({
            loc: `${origin}/${a.region.slug}/${a.slug}`,
            lastmod: a.published_at ?? undefined,
            priority: "0.9",
          });
        }

        for (const au of authors) {
          urls.push({
            loc: `${origin}/autor/${au.slug}`,
            lastmod: au.lastmod ?? undefined,
            priority: "0.5",
          });
        }

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url><loc>${escapeXml(u.loc)}</loc>` +
                (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
                (u.priority ? `<priority>${u.priority}</priority>` : "") +
                `</url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=1800",
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