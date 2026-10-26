// Visual do vídeo do Cidades do Paraná: fundo quase preto com grade sutil,
// brilho verde-água no topo, Inter nos títulos e JetBrains Mono nos rótulos.
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as mono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as newsreader } from "@remotion/google-fonts/Newsreader";

export const FONTE = {
  ui: inter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }).fontFamily,
  mono: mono("normal", { weights: ["400", "500", "700"], subsets: ["latin", "latin-ext"] }).fontFamily,
  serif: newsreader("normal", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] }).fontFamily,
};

export const COR = {
  fundo: "#050505",
  grade: "rgba(255,255,255,0.035)",
  agua: "#2ED3B7",
  aguaForte: "#24DECA",
  aguaFundo: "#061E1A",
  aguaBorda: "rgba(46,211,183,0.35)",
  txt: "#FFFFFF",
  mut: "#9AA3A1",
  laranja: "#E29F65",
  painel: "#0E1312",
  borda: "rgba(255,255,255,0.08)",
};

export const FPS = 30;
export const INTRO_S = 3.2; // vinheta antes da voz
export const OUTRO_S = 6; // assinatura depois da voz
