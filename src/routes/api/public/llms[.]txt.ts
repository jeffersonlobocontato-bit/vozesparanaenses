import { createFileRoute } from "@tanstack/react-router";
import { listRegions, listLatestArticles } from "@/lib/content.functions";

/** /llms.txt — sumário curto do portal para LLMs. */
export const Route = createFileRoute("/api/public/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [regions, latest] = await Promise.all([
          listRegions().catch(() => []),
          listLatestArticles({ data: { limit: 20 } }).catch(() => []),
        ]);
        const lines: string[] = [];
        lines.push("# Vozes Paranaenses");
        lines.push("");
        lines.push(
          "> Portal regional de notícias das 10 macrorregiões do Paraná (IPARDES). Cobertura editorial local com Método DEL (Denso, Editorial, Local) e verificação 5W1H.",
        );
        lines.push("");
        lines.push(
          "O Vozes Paranaenses agrega, categoriza e reescreve com editoria matérias sobre política, economia, cultura, esporte, segurança e cotidiano das cidades paranaenses. Cada matéria é organizada por região e por cidade principal.",
        );
        lines.push("");
        lines.push("## Regiões");
        lines.push("");
        for (const r of regions) {
          const desc = r.description ? `: ${r.description}` : r.main_city ? `: ${r.main_city} e entorno` : "";
          lines.push(`- [${r.name}](${origin}/${r.slug})${desc}`);
        }
        lines.push("");
        lines.push("## Últimas matérias");
        lines.push("");
        for (const a of latest) {
          if (!a.region) continue;
          lines.push(`- [${a.title}](${origin}/${a.region.slug}/${a.slug})`);
        }
        lines.push("");
        lines.push("## Recursos indexáveis");
        lines.push("");
        lines.push(`- Sitemap XML: ${origin}/api/public/sitemap.xml`);
        lines.push(`- Sitemap Google News: ${origin}/api/public/sitemap-news.xml`);
        lines.push(`- Feed RSS: ${origin}/api/public/rss.xml`);
        lines.push(`- Índice completo (LLM): ${origin}/api/public/llms-full.txt`);
        lines.push(`- Sobre / política editorial: ${origin}/sobre`);
        lines.push("");
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
