/**
 * JSON para <script type="application/ld+json">. O TanStack injeta o texto
 * como HTML cru: um título com "</script>" fecharia a tag e executaria o que
 * vem depois. Escapar <, > e & como \u003c etc. mantém o JSON válido e
 * impede a quebra da tag.
 */
export function jsonLd(dados: unknown): string {
  return JSON.stringify(dados)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
