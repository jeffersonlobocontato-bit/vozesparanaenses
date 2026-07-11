// Rótulos exibidos publicamente para regiões (mantendo o slug original).
export const REGION_NAME_OVERRIDES: Record<string, string> = {
  "norte-central": "Norte",
  "centro-ocidental": "Centro Oeste",
};

export function displayRegionName(slug: string | null | undefined, fallback: string): string {
  if (!slug) return fallback;
  return REGION_NAME_OVERRIDES[slug] ?? fallback;
}