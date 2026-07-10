import { createFileRoute } from "@tanstack/react-router";

/**
 * Hook chamado por pg_cron a cada ~15 min. Coleta as matérias
 * publicadas na última janela de 90 minutos e envia ao IndexNow
 * para reindexação instantânea em Bing / Yandex / Seznam / Naver.
 *
 * Autenticação: exige `apikey` == SUPABASE_ANON_KEY (padrão dos
 * hooks públicos deste projeto).
 */
export const Route = createFileRoute("/api/public/hooks/indexnow-ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const origin = new URL(request.url).origin;
        const { getExternalSupabase } = await import("@/lib/external-supabase.server");
        const { pingIndexNow } = await import("@/lib/indexnow.server");

        const since = new Date(Date.now() - 90 * 60 * 1000).toISOString();

        const sb = getExternalSupabase();
        const { data: rows, error } = await sb
          .from("generated_articles")
          .select("slug, regiao:regioes(slug), publicado_em")
          .eq("status", "publicado")
          .gte("publicado_em", since)
          .order("publicado_em", { ascending: false })
          .limit(200);

        if (error) {
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }

        const urls: string[] = [];
        for (const r of (rows ?? []) as {
          slug: string;
          regiao: { slug: string } | { slug: string }[] | null;
        }[]) {
          const regionSlug = Array.isArray(r.regiao) ? r.regiao[0]?.slug : r.regiao?.slug;
          if (!regionSlug) continue;
          urls.push(`${origin}/${regionSlug}/${r.slug}`);
        }

        const result = await pingIndexNow({ origin, urls });
        return Response.json({
          scanned: rows?.length ?? 0,
          submitted: urls.length,
          ...result,
        });
      },
    },
  },
});