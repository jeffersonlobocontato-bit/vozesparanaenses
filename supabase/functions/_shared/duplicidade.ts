// Duplicidade entre o que o assessor enviou e o que o portal já publicou
// (a varredura automática dos sites das prefeituras costuma chegar antes).
// Compara palavras significativas e números do título/subtítulo enviados com
// o título/resumo das matérias recentes da mesma cidade.

const STOP = new Set([
  "para", "pelo", "pela", "pelos", "pelas", "como", "mais", "sobre", "entre", "apos", "desde",
  "ate", "com", "sem", "dos", "das", "nos", "nas", "que", "uma", "uns", "umas", "seu", "sua",
  "seus", "suas", "este", "esta", "esse", "essa", "isso", "prefeitura", "municipio", "municipal",
  "cidade", "parana", "governo", "secretaria", "anuncia", "realiza", "promove", "abre", "sera",
  "serao", "ser", "tem", "terao", "novo", "nova", "novos", "novas",
]);

export function termos(texto: string): Set<string> {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const palavras = t.replace(/[^a-z0-9,]+/g, " ").split(/\s+/)
    .map((w) => w.replace(/,+$/, ""))
    .filter((w) => (/\d/.test(w) ? w.length >= 2 : w.length >= 4) && !STOP.has(w));
  return new Set(palavras);
}

/** Proporção dos termos do envio que aparecem na matéria publicada (0–1). */
export function semelhanca(enviado: string, publicado: string): { indice: number; comuns: number } {
  const a = termos(enviado);
  const b = termos(publicado);
  if (a.size === 0 || b.size === 0) return { indice: 0, comuns: 0 };
  let comuns = 0;
  for (const w of a) if (b.has(w)) comuns++;
  return { indice: comuns / Math.min(a.size, b.size), comuns };
}

export function ehDuplicata(enviado: string, publicado: string): boolean {
  const { indice, comuns } = semelhanca(enviado, publicado);
  return comuns >= 3 && indice >= 0.45;
}
