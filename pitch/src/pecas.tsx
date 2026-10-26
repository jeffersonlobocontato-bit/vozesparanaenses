import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE } from "./marca";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const SUAVE = Easing.bezier(0.16, 1, 0.3, 1);
export const VAIVEM = Easing.bezier(0.65, 0, 0.35, 1);

/** Fundo do vídeo do Cidades do Paraná: quase preto, grade sutil, brilho verde-água. */
export const Fundo: React.FC<{ brilho?: number }> = ({ brilho = 1 }) => {
  const f = useCurrentFrame();
  const respira = 0.85 + 0.15 * Math.sin(f / 50);
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COR.grade} 1px, transparent 1px), linear-gradient(90deg, ${COR.grade} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(70% 70% at 50% 45%, black 30%, transparent 85%)",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(48% 30% at 50% 0%, rgba(36,222,202,${0.16 * brilho * respira}), transparent 70%)` }} />
    </AbsoluteFill>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; entra?: number; tamanho?: number }> = ({ children, entra = 1, tamanho = 22 }) => (
  <div
    style={{
      display: "inline-flex", alignItems: "center", gap: 12, padding: `${tamanho * 0.45}px ${tamanho * 0.95}px`,
      borderRadius: 999, background: COR.aguaFundo, border: `1px solid ${COR.aguaBorda}`,
      fontFamily: FONTE.mono, fontSize: tamanho, fontWeight: 500, letterSpacing: "0.14em", color: COR.agua, textTransform: "uppercase",
      opacity: entra, translate: `0px ${(1 - entra) * 16}px`, whiteSpace: "nowrap",
    }}
  >
    <span style={{ width: tamanho * 0.36, height: tamanho * 0.36, borderRadius: "50%", background: COR.aguaForte, boxShadow: `0 0 12px ${COR.aguaForte}` }} />
    {children}
  </div>
);

/** Título grande em Inter; linhas entram em cascata. `apagada` = linha em cinza degradê (como "Sem custo."). */
export const Titulo: React.FC<{ linhas: { t: string; apagada?: boolean; cor?: string }[]; tamanho?: number; alinhar?: "left" | "center"; de?: number }> = ({ linhas, tamanho = 96, alinhar = "left", de = 0 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: alinhar === "center" ? "center" : "flex-start", gap: tamanho * 0.08 }}>
      {linhas.map((l, i) => {
        const p = interpolate(f, [de + 6 + i * 7, de + 24 + i * 7], [0, 1], { ...clamp, easing: SUAVE });
        return (
          <div key={i}
            style={{
              fontFamily: FONTE.ui, fontWeight: 600, fontSize: tamanho, lineHeight: 1.04, letterSpacing: "-0.035em", textAlign: alinhar,
              color: l.cor ?? COR.txt, opacity: p, translate: `0px ${(1 - p) * 30}px`, filter: `blur(${(1 - p) * 8}px)`,
              ...(l.apagada ? { backgroundImage: "linear-gradient(180deg, #d9d9d9 0%, #6f6f6f 100%)", WebkitBackgroundClip: "text", color: "transparent" } : {}),
            }}>
            {l.t}
          </div>
        );
      })}
    </div>
  );
};

/** Janela de navegador escura com a captura dentro. A captura rola de `de` a `ate` (px da imagem). */
export const Navegador: React.FC<{
  img: string; url: string; largura: number; altura: number; imgLargura?: number;
  de?: number; ate?: number; zoom?: [number, number]; foco?: [number, number]; entra?: number;
  children?: React.ReactNode;
}> = ({ img, url, largura, altura, imgLargura = 1920, de = 0, ate = 0, zoom = [1, 1], foco = [0.5, 0], entra = 1, children }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(f, [8, Math.max(9, durationInFrames - 6)], [0, 1], { ...clamp, easing: VAIVEM });
  const barra = 52;
  const escalaBase = largura / imgLargura;
  const z = zoom[0] + (zoom[1] - zoom[0]) * p;
  const y = de + (ate - de) * p;
  const src = img.startsWith("http") ? img : staticFile(img);
  return (
    <div
      style={{
        width: largura, height: altura, borderRadius: 22, overflow: "hidden", background: "#151918",
        border: `1px solid ${COR.borda}`, boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(46,211,183,0.06)",
        opacity: entra, translate: `0px ${(1 - entra) * 60}px`, scale: String(0.96 + entra * 0.04), position: "relative",
      }}
    >
      <div style={{ height: barra, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: "#1A1F1E", borderBottom: `1px solid ${COR.borda}` }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: "#3A403F" }} />)}
        <span style={{ marginLeft: 14, padding: "6px 16px", borderRadius: 10, background: "#252B2A", fontFamily: FONTE.mono, fontSize: 19, color: "#C8D0CE" }}>{url}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: barra, bottom: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: `${foco[0] * 100}% ${foco[1] * 100}%`, scale: String(z), width: "100%", height: "100%" }}>
          <Img src={src} style={{ position: "absolute", left: 0, top: -y * escalaBase, width: largura, display: "block" }} />
          {children}
        </div>
      </div>
    </div>
  );
};

/** Moldura de destaque verde-água com etiqueta (como no vídeo do Cidades do Paraná). */
export const Destaque: React.FC<{ x: number; y: number; w: number; h: number; rotulo?: string; lado?: "direita" | "esquerda" | "baixo"; entra: number }> = ({ x, y, w, h, rotulo, lado = "direita", entra }) => (
  <>
    <div style={{
      position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 14, border: `4px solid ${COR.agua}`,
      boxShadow: `0 0 0 6px rgba(46,211,183,0.18), 0 0 40px rgba(46,211,183,0.35)`, opacity: entra, scale: String(0.94 + 0.06 * entra),
    }} />
    {rotulo && (
      <div style={{
        position: "absolute", ...(lado === "direita" ? { left: x + w + 18, top: y + h / 2 - 30 } : lado === "esquerda" ? { right: `calc(100% - ${x - 18}px)`, top: y + h / 2 - 30 } : { left: x, top: y + h + 14 }),
        padding: "10px 22px", borderRadius: 999, background: COR.agua, color: "#04201B", fontFamily: FONTE.ui, fontWeight: 700, fontSize: 30,
        opacity: entra, translate: `${(1 - entra) * 20}px 0px`, whiteSpace: "nowrap",
      }}>{rotulo}</div>
    )}
  </>
);

export const Legenda: React.FC<{ texto: string | null }> = ({ texto }) =>
  texto ? (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46, pointerEvents: "none" }}>
      <div style={{ padding: "12px 28px", borderRadius: 14, background: "rgba(0,0,0,0.82)", fontFamily: FONTE.ui, fontWeight: 500, fontSize: 36, color: COR.txt, letterSpacing: "-0.01em", maxWidth: 1500, textAlign: "center" }}>
        {texto}
      </div>
    </AbsoluteFill>
  ) : null;

export const Marca: React.FC<{ tamanho?: number }> = ({ tamanho = 64 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: tamanho * 0.28 }}>
    <svg width={tamanho} height={tamanho} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M8 6h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 7v-7H8a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="#1E5C4A" />
      <path d="M14 15l8 10 8-10" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="36" cy="8" r="4.5" fill={COR.laranja} />
    </svg>
    <span style={{ fontFamily: FONTE.serif, fontWeight: 600, fontSize: tamanho * 0.62, color: COR.txt, letterSpacing: "-0.01em" }}>
      vozes <span style={{ color: COR.mut, fontWeight: 500 }}>paranaenses</span>
    </span>
  </div>
);
