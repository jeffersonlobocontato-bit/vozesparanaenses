import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Design system Vozes Paranaenses (o mesmo dos cards do feed).
export const COR = {
  tinta: "#12201E",
  tinta2: "#0C1614",
  papel: "#F4F1EA",
  laranja: "#E29F65",
  laranjaForte: "#D9823F",
  verde: "#1E5B45",
  verdeClaro: "#6FBF98",
  alerta: "#B8241A",
  alertaEscuro: "#8E1A12",
  branco: "#FFFFFF",
};

export const FONTE = {
  titulo: "Newsreader",
  ui: "Barlow",
  chapeu: "Barlow Condensed",
  marca: "Fraunces",
};

const arquivos: Array<[string, string, string, string?]> = [
  ["Newsreader", "newsreader-latin-400-normal.woff2", "400"],
  ["Newsreader", "newsreader-latin-400-italic.woff2", "400", "italic"],
  ["Newsreader", "newsreader-latin-600-normal.woff2", "600"],
  ["Newsreader", "newsreader-latin-700-normal.woff2", "700"],
  ["Newsreader", "newsreader-latin-800-normal.woff2", "800"],
  ["Barlow", "barlow-latin-500-normal.woff2", "500"],
  ["Barlow", "barlow-latin-600-normal.woff2", "600"],
  ["Barlow", "barlow-latin-700-normal.woff2", "700"],
  ["Barlow", "barlow-latin-800-normal.woff2", "800"],
  ["Barlow Condensed", "barlow-condensed-latin-600-normal.woff2", "600"],
  ["Barlow Condensed", "barlow-condensed-latin-700-normal.woff2", "700"],
  ["Barlow Condensed", "barlow-condensed-latin-800-normal.woff2", "800"],
  ["Fraunces", "fraunces-latin-700-normal.woff2", "700"],
  ["Fraunces", "fraunces-latin-900-normal.woff2", "900"],
];

export const fontesProntas = Promise.all(
  arquivos.map(([family, arq, weight, style]) =>
    loadFont({ family, url: staticFile(`fontes/${arq}`), weight, style: style ?? "normal" }),
  ),
);

/** Texto legível sobre uma cor (luminância). */
export function textoSobre(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? COR.tinta : COR.branco;
}

/** Caminhos do ícone (viewBox 256): balão, V e ponto. */
export const BALAO_D =
  "M64 28h120a48 48 0 0 1 48 48v84a48 48 0 0 1-48 48H108l-52 34a6 6 0 0 1-9.2-5.6L52 206A48 48 0 0 1 16 160V76a48 48 0 0 1 48-48z";
export const V_PONTOS = "72.3,91.7 124,144.3 175.7,91.7";
export const PONTO = { cx: 214, cy: 46, r: 34.4 };
