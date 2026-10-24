// Vozes Paranaenses — regra da foto (direito de imagem)
//
// Publica a foto da fonte SOMENTE quando o crédito indica uso institucional
// livre: assessoria, divulgação, prefeitura/município, governo, foto pública.
// Qualquer outra situação — crédito pessoal (fotógrafo), de outro veículo,
// agência comercial, "reprodução", arquivo pessoal, IA, ou SEM crédito — a
// foto da fonte é descartada. Na dúvida, descarta: não corremos risco com
// foto. Quem decide o que entra no lugar (foto geral da cidade, ou virar
// nota) é o crivo editorial.

export type FotoStatus = "autorizada" | "proibida" | "sem_credito" | "sem_foto";

const AUTORIZADA: RegExp[] = [
  /\bassessoria\b/,
  /\bascom\b/,
  /\bsecom\b/,
  /\bdivulga[cç][aã]o\b/,
  /\bprefeitura\b/,
  /\bmunic[ií]pio\b/,
  /\bpm[a-z]{1,4}\b/, // siglas de prefeitura: PMC, PMPG, PMM...
  /\bc[aâ]mara (municipal|de vereadores)\b/,
  /\bgoverno (do estado|do paran[aá]|federal|municipal)\b/,
  /\bgov(erno)?\.? ?pr\b/,
  /\baen\b/,
  /\bag[eê]ncia (estadual de not[ií]cias|de not[ií]cias do paran[aá]|brasil)\b/,
  // Agências públicas federais (licença livre com crédito): EBC, Senado, Câmara.
  /\bag[eê]ncia (senado|c[aâ]mara)\b/,
  /\bsenado federal\b/,
  /\bc[aâ]mara dos deputados\b/,
  /\bfotos? ?p[uú]blicas?\b/,
  /^p[uú]blica$/,
  /\bdom[ií]nio p[uú]blico\b/,
  /\b(secretaria|sesa|seed|sesp|pol[ií]cia (militar|civil)|pmpr|pcpr|bombeiros|detran|sanepar|copel)\b/,
];

const PROIBIDA: RegExp[] = [
  /\breprodu[cç][aã]o\b/,
  /\barquivo pessoal\b/,
  /\bredes sociais\b/,
  /\b(instagram|facebook|whatsapp|tiktok|youtube|x\.com|twitter)\b/,
  /\bgerada? por ia\b|\bintelig[eê]ncia artificial\b|\bilustra[cç][aã]o\b/,
  /\b(folhapress|estad[aã]o conte[uú]do|agência o globo|ag[eê]ncia estado|afp|reuters|ap photo|getty|shutterstock|istock|adobe stock|freepik|unsplash|pexels)\b/,
  /\b(g1|rpc|ric|band|globo|gazeta do povo|tribuna|bem paran[aá]|banda b|massa news|cbn|jornal|portal|r[aá]dio|tv)\b/,
];

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Classifica o crédito da foto. `nomesVeiculos` = nomes das fontes do tipo
 * veículo cadastradas (crédito citando outro veículo é proibido).
 */
export function classificarFoto(
  imagemUrl: string | null | undefined,
  credito: string | null | undefined,
  nomesVeiculos: string[] = [],
): FotoStatus {
  if (!imagemUrl) return "sem_foto";
  // "Foto: Fulano" → "Fulano": o rótulo não diz nada sobre a origem.
  const bruto = (credito ?? "").trim().replace(/^(fotos?|imagem|cr[eé]dito)\s*[:\-–]\s*/i, "");
  if (!bruto) return "sem_credito";
  const c = normalizar(bruto);
  const semAcento = (re: RegExp) => re.test(c) || re.test(bruto.toLowerCase());

  // Proibida vence autorizada: "Reprodução/Prefeitura" ou "Fulano/Gazeta"
  // continua sendo foto de terceiro.
  if (PROIBIDA.some(semAcento)) return "proibida";
  for (const nome of nomesVeiculos) {
    const n = normalizar(nome);
    if (n.length >= 4 && c.includes(n)) return "proibida";
  }
  if (AUTORIZADA.some(semAcento)) return "autorizada";
  // Só nome de pessoa ("Foto: João Silva") = crédito pessoal.
  return "proibida";
}

/** Crédito exibido junto da foto institucional publicada. */
export function creditoParaExibir(credito: string): string {
  const c = credito.trim().replace(/^(foto|fotos|imagem|cr[eé]dito)\s*[:\-–]\s*/i, "");
  return `Foto: ${c}`;
}

// Fonte que É agência pública (Agência Brasil/EBC, Agência Senado, Agência
// Câmara): toda foto publicada por ela tem licença livre com crédito — vale
// mesmo quando a coleta não conseguiu ler o crédito na página.
const AGENCIA_PUBLICA = /\b(ag[eê]ncia brasil|ebc|ag[eê]ncia senado|senado federal|ag[eê]ncia c[aâ]mara|c[aâ]mara dos deputados)\b/i;
export function ehAgenciaPublica(nomeFonte: string | null | undefined): boolean {
  return !!nomeFonte && AGENCIA_PUBLICA.test(nomeFonte);
}
