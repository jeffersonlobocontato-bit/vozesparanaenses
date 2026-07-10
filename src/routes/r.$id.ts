import { createFileRoute } from "@tanstack/react-router";

/**
 * Redirect intermediário para tracking de cliques em anúncios.
 * GET /r/:id?imp=<impression_id>
 * Registra o click, depois 302 pra destino_url do criativo.
 */
export const Route = createFileRoute("/r/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { getExternalServiceRole } = await import(
          "@/lib/external-supabase.server"
        );
        const sb = getExternalServiceRole();
        const url = new URL(request.url);
        const impRaw = url.searchParams.get("imp");
        const impressionId = impRaw ? Number(impRaw) : null;

        const { data: creative } = await sb
          .from("ad_creatives")
          .select("id, campaign_id, destino_url")
          .eq("id", params.id)
          .maybeSingle();

        if (!creative) {
          return new Response("Not found", { status: 404 });
        }

        // Enriquecer com escopo/valor da impressão original se houver
        let escopo: string | null = null;
        let valor: string | null = null;
        if (impressionId && Number.isFinite(impressionId)) {
          const { data: imp } = await sb
            .from("ad_impressions")
            .select("escopo, valor")
            .eq("id", impressionId)
            .maybeSingle();
          escopo = imp?.escopo ?? null;
          valor = imp?.valor ?? null;
        }

        await sb.from("ad_clicks").insert({
          creative_id: creative.id,
          campaign_id: creative.campaign_id,
          impression_id: impressionId,
          escopo,
          valor,
          user_agent: request.headers.get("user-agent"),
          referer: request.headers.get("referer"),
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: creative.destino_url,
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});