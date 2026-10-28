// Rótulos exibidos publicamente para regiões (mantendo o slug original).
export const REGION_NAME_OVERRIDES: Record<string, string> = {
  "norte-central": "Norte",
  "centro-ocidental": "Centro Oeste",
};

export function displayRegionName(slug: string | null | undefined, fallback: string): string {
  if (!slug) return fallback;
  return REGION_NAME_OVERRIDES[slug] ?? fallback;
}
/**
 * Regiões de curadoria fora do Paraná. Ficam no site para o leitor, mas fora
 * do índice do Google (noindex + fora dos sitemaps): reescrita de notícia que
 * os grandes portais já cobrem não ganha indexação e dilui o peso do site —
 * o foco de busca é notícia do Paraná (Search Console, out/2026: quase todas
 * as "rastreadas, mas não indexadas" eram dessas regiões).
 */
export const REGIOES_FORA_DO_INDICE = new Set(["nacional", "internacional"]);
export function foraDoIndice(regiaoSlug: string | null | undefined): boolean {
  return !!regiaoSlug && REGIOES_FORA_DO_INDICE.has(regiaoSlug);
}
