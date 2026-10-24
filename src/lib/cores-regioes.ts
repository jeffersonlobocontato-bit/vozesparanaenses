// Cor de cada região editorial do Paraná, como num mapa de mesorregiões:
// cada região tem a sua, inspirada no que a identifica. Usada nos avatares
// das colunas "Vozes {Região}" (e onde mais a região precisar de cor).
// Texto branco sobre todas tem contraste ≥ 4,7:1, e elas também servem como
// cor de texto sobre o fundo claro (≥ 4,7:1).

export type CorRegiao = { cor: string; nome: string; porque: string };

export const CORES_REGIOES: Record<string, CorRegiao> = {
  metropolitana: { cor: "#1F5FA8", nome: "Metropolitana", porque: "capital e entorno: azul institucional" },
  litoral: { cor: "#0B7285", nome: "Litoral", porque: "mar e baía de Paranaguá: azul-petróleo" },
  "campos-gerais": { cor: "#5F7A1B", nome: "Campos Gerais", porque: "campos nativos: verde-oliva" },
  "norte-pioneiro": { cor: "#A0522D", nome: "Norte Pioneiro", porque: "café e terra: siena" },
  "norte-central": { cor: "#B3261E", nome: "Norte", porque: "terra roxa de Londrina e Maringá: vermelho" },
  noroeste: { cor: "#8C6D0F", nome: "Noroeste", porque: "arenito Caiuá: ocre" },
  "centro-ocidental": { cor: "#7B4AA0", nome: "Centro Oeste", porque: "Campo Mourão: violeta" },
  oeste: { cor: "#2E7D32", nome: "Oeste", porque: "agro e Itaipu: verde" },
  sudoeste: { cor: "#B02A6B", nome: "Sudoeste", porque: "fronteira e serra: magenta" },
  "centro-sul": { cor: "#455A64", nome: "Centro-Sul", porque: "frio de serra e araucárias: cinza-azulado" },
};

/** Cor da região (ou o verde-escuro da marca, se a região não tiver cor). */
export function corDaRegiao(slug: string | null | undefined): string {
  return (slug && CORES_REGIOES[slug]?.cor) || "#14211C";
}
