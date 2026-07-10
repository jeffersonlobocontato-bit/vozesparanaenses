// Coordenadas (lat, lng) de cidades do Paraná — usadas para geo.position / ICBM
// meta tags e para o campo `geo` do schema.org Place. Chave é o slug produzido
// por cidadeSlug() (lowercase, sem acento, hífen).

export type LatLng = { lat: number; lng: number };

const CITIES: Record<string, LatLng> = {
  // Região Metropolitana / Curitiba
  "curitiba": { lat: -25.4284, lng: -49.2733 },
  "sao-jose-dos-pinhais": { lat: -25.5344, lng: -49.2064 },
  "colombo": { lat: -25.2916, lng: -49.2244 },
  "pinhais": { lat: -25.4453, lng: -49.1928 },
  "araucaria": { lat: -25.5936, lng: -49.4106 },
  "campo-largo": { lat: -25.4589, lng: -49.5289 },
  "fazenda-rio-grande": { lat: -25.6622, lng: -49.3078 },
  "piraquara": { lat: -25.4425, lng: -49.0678 },
  "almirante-tamandare": { lat: -25.3225, lng: -49.31 },
  // Norte / Londrina / Maringá
  "londrina": { lat: -23.3103, lng: -51.1628 },
  "maringa": { lat: -23.4253, lng: -51.9386 },
  "apucarana": { lat: -23.5511, lng: -51.4611 },
  "arapongas": { lat: -23.4192, lng: -51.4236 },
  "cambe": { lat: -23.2764, lng: -51.2778 },
  "sarandi": { lat: -23.4442, lng: -51.8747 },
  "rolandia": { lat: -23.3103, lng: -51.3689 },
  // Oeste / Cascavel / Foz
  "cascavel": { lat: -24.9556, lng: -53.4553 },
  "foz-do-iguacu": { lat: -25.5478, lng: -54.5882 },
  "toledo": { lat: -24.7247, lng: -53.7431 },
  "marechal-candido-rondon": { lat: -24.5569, lng: -54.0553 },
  // Sudoeste
  "francisco-beltrao": { lat: -26.0817, lng: -53.0553 },
  "pato-branco": { lat: -26.2289, lng: -52.6706 },
  "dois-vizinhos": { lat: -25.7381, lng: -53.0553 },
  // Campos Gerais
  "ponta-grossa": { lat: -25.0947, lng: -50.1633 },
  "castro": { lat: -24.79, lng: -50.0119 },
  "telemaco-borba": { lat: -24.3239, lng: -50.6156 },
  // Norte Pioneiro
  "cornelio-procopio": { lat: -23.1808, lng: -50.6467 },
  "jacarezinho": { lat: -23.1608, lng: -49.9714 },
  "santo-antonio-da-platina": { lat: -23.2953, lng: -50.0778 },
  // Vale do Ivaí / Centro
  "ivaipora": { lat: -24.2478, lng: -51.6772 },
  "guarapuava": { lat: -25.3945, lng: -51.4581 },
  "pitanga": { lat: -24.7572, lng: -51.7583 },
  // Litoral
  "paranagua": { lat: -25.5203, lng: -48.5089 },
  "matinhos": { lat: -25.8175, lng: -48.5433 },
  "guaratuba": { lat: -25.8828, lng: -48.5747 },
  "pontal-do-parana": { lat: -25.6742, lng: -48.5108 },
  // Umuarama / Noroeste
  "umuarama": { lat: -23.7658, lng: -53.325 },
  "campo-mourao": { lat: -24.0458, lng: -52.3831 },
  "paranavai": { lat: -23.0728, lng: -52.4644 },
  // União da Vitória / Sul
  "uniao-da-vitoria": { lat: -26.2306, lng: -51.0872 },
  "sao-mateus-do-sul": { lat: -25.8722, lng: -50.3844 },
};

/** Retorna lat/long para um slug de cidade do Paraná, ou null se desconhecida. */
export function getCityCoords(citySlug: string | null | undefined): LatLng | null {
  if (!citySlug) return null;
  return CITIES[citySlug] ?? null;
}

/** Formata em "lat;lng" para uso em <meta name="geo.position">. */
export function formatGeoPosition(coords: LatLng): string {
  return `${coords.lat.toFixed(4)};${coords.lng.toFixed(4)}`;
}

/** Formato ICBM: "lat, lng". */
export function formatICBM(coords: LatLng): string {
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

/** Distância aproximada em km entre dois pontos (haversine). */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type NeighborCity = { slug: string; name: string; distanceKm: number };

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Retorna as cidades mais próximas do slug informado, ordenadas por distância.
 * Usa a tabela estática de CITIES; devolve [] se a cidade base for desconhecida.
 */
export function getNeighboringCities(citySlug: string, limit = 6): NeighborCity[] {
  const base = CITIES[citySlug];
  if (!base) return [];
  return Object.entries(CITIES)
    .filter(([slug]) => slug !== citySlug)
    .map(([slug, coords]) => ({
      slug,
      name: slugToName(slug),
      distanceKm: haversineKm(base, coords),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}