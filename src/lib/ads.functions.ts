import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PickAdInput = z.object({
  regiao: z.string().optional(),
  cidade: z.string().optional(),
  editoria: z.string().optional(),
  size: z.string().optional(),
  userAgent: z.string().optional(),
});

export type PickedAd = {
  creative_id: string;
  campaign_id: string;
  imagem_url: string;
  headline: string;
  cta_texto: string;
  destino_url: string;
  redirect_url: string;
  impression_id: number | null;
};

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Seleciona um anúncio elegível respeitando targeting geo (cidade > regiao >
 * estado), editoria e cap diário de impressões por localização. Registra a
 * impressão e devolve o creative escolhido com URL de redirect /r/:id.
 */
export const pickAd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PickAdInput.parse(d))
  .handler(async ({ data }) => {
    const { getExternalServiceRole } = await import("./external-supabase.server");
    const sb = getExternalServiceRole();

    const cidadeSlug = data.cidade ? slugify(data.cidade) : null;
    const scopes: Array<{ escopo: "cidade" | "regiao" | "estado"; valor: string }> = [];
    if (cidadeSlug) scopes.push({ escopo: "cidade", valor: cidadeSlug });
    if (data.regiao) scopes.push({ escopo: "regiao", valor: data.regiao });
    scopes.push({ escopo: "estado", valor: "pr" });

    for (const scope of scopes) {
      // Targets ativos para este escopo
      const { data: targets } = await sb
        .from("ad_targets")
        .select("id, campaign_id, cap_impressoes_dia")
        .eq("escopo", scope.escopo)
        .eq("valor", scope.valor);
      if (!targets || targets.length === 0) continue;

      const campaignIds = Array.from(new Set(targets.map((t) => t.campaign_id)));
      const { data: creatives } = await sb
        .from("ads_eligible")
        .select("creative_id, campaign_id, imagem_url, headline, cta_texto, destino_url, peso, editorias")
        .in("campaign_id", campaignIds);
      if (!creatives || creatives.length === 0) continue;

      // Filtro por editoria (vazio = todas)
      const eligible = creatives.filter((c) => {
        const eds = (c.editorias ?? []) as string[];
        if (!eds.length) return true;
        if (!data.editoria) return false;
        return eds.includes(data.editoria);
      });
      if (!eligible.length) continue;

      // Cap por target: contar impressões de hoje
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const capByTarget = new Map<string, number>();
      for (const t of targets) capByTarget.set(t.id, t.cap_impressoes_dia);

      const { data: impsToday } = await sb
        .from("ad_impressions")
        .select("target_id")
        .in("target_id", targets.map((t) => t.id))
        .gte("servido_em", startOfDay.toISOString());

      const countByTarget = new Map<string, number>();
      for (const row of impsToday ?? []) {
        if (!row.target_id) continue;
        countByTarget.set(row.target_id, (countByTarget.get(row.target_id) ?? 0) + 1);
      }

      // Junta creative -> primeiro target disponível daquela campanha ainda com cap
      const withCap = eligible
        .map((c) => {
          const target = targets.find(
            (t) =>
              t.campaign_id === c.campaign_id &&
              (countByTarget.get(t.id) ?? 0) < (capByTarget.get(t.id) ?? 0),
          );
          return target ? { c, target } : null;
        })
        .filter((v): v is { c: (typeof eligible)[number]; target: (typeof targets)[number] } => !!v);
      if (!withCap.length) continue;

      // Seleção ponderada
      const total = withCap.reduce((s, x) => s + Math.max(1, x.c.peso), 0);
      let r = Math.random() * total;
      let pick = withCap[0];
      for (const x of withCap) {
        r -= Math.max(1, x.c.peso);
        if (r <= 0) { pick = x; break; }
      }

      const { data: inserted } = await sb
        .from("ad_impressions")
        .insert({
          creative_id: pick.c.creative_id,
          campaign_id: pick.c.campaign_id,
          target_id: pick.target.id,
          escopo: scope.escopo,
          valor: scope.valor,
          editoria: data.editoria ?? null,
          user_agent: data.userAgent ?? null,
        })
        .select("id")
        .single();

      const impId = inserted?.id ?? null;
      const result: PickedAd = {
        creative_id: pick.c.creative_id,
        campaign_id: pick.c.campaign_id,
        imagem_url: pick.c.imagem_url,
        headline: pick.c.headline,
        cta_texto: pick.c.cta_texto,
        destino_url: pick.c.destino_url,
        redirect_url: `/r/${pick.c.creative_id}${impId ? `?imp=${impId}` : ""}`,
        impression_id: impId,
      };
      return result;
    }

    return null;
  });