import type { ArticleListItem } from "./content.functions";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type RssChannel = {
  origin: string;
  selfPath: string; // absolute path do próprio feed (ex.: /api/public/rss/regiao/curitiba.xml)
  title: string;
  description: string;
  articles: ArticleListItem[];
};

/** Renderiza um canal RSS 2.0 com item por matéria. */
export function renderRss({
  origin,
  selfPath,
  title,
  description,
  articles,
}: RssChannel): string {
  const items = articles
    .filter((a) => a.region)
    .map((a) => {
      const url = `${origin}/${a.region!.slug}/${a.slug}`;
      const cat = a.categoria?.name ?? a.region!.name;
      const pub = a.published_at
        ? new Date(a.published_at).toUTCString()
        : new Date().toUTCString();
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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(title)}</title>\n` +
    `    <link>${origin}/</link>\n` +
    `    <description>${escapeXml(description)}</description>\n` +
    `    <language>pt-BR</language>\n` +
    `    <atom:link href="${escapeXml(origin + selfPath)}" rel="self" type="application/rss+xml" />\n` +
    items.join("\n") +
    `\n  </channel>\n` +
    `</rss>\n`
  );
}

export const RSS_HEADERS = {
  "content-type": "application/rss+xml; charset=utf-8",
  "cache-control": "public, max-age=600",
  "x-robots-tag": "all, max-image-preview:large, max-snippet:-1",
} as const;