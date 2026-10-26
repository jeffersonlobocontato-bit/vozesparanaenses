// Visual do vídeo do Cidades do Paraná: fundo quase preto com grade sutil,
// brilho verde-água no topo, Inter nos títulos e JetBrains Mono nos rótulos.
// Fontes empacotadas (@fontsource) para renderizar sem acesso ao Google Fonts.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";

import { continueRender, delayRender } from "remotion";

if (typeof document !== "undefined") {
  const h = delayRender("fontes");
  Promise.all(["400 20px Inter", "500 20px Inter", "600 20px Inter", "700 20px Inter", "400 20px 'JetBrains Mono'", "500 20px 'JetBrains Mono'", "500 20px Newsreader", "600 20px Newsreader"]
    .map((f) => document.fonts.load(f, "Paraná"))).finally(() => continueRender(h));
}

export const FONTE = {
  ui: "Inter, sans-serif",
  mono: "'JetBrains Mono', monospace",
  serif: "Newsreader, serif",
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
