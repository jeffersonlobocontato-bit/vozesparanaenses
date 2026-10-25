import React from "react";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { lightLeak } from "@remotion/effects/light-leak";
import { Solid } from "remotion";
import { BALAO_D, COR } from "../marca";
import { faixasGlitch } from "../pecas";

type P = Record<string, never>;
type Props = TransitionPresentationComponentProps<P>;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.bezier(0.7, 0, 0.2, 1);

/** Chicote: a tela sai arrastada com desfoque e a próxima entra do outro lado. */
const Chicote: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  const e = io(p);
  const x = dir === "exiting" ? -e * 110 : (1 - e) * 110;
  const borrao = Math.sin(e * Math.PI) * 28;
  return (
    <AbsoluteFill style={{ translate: `${x}% 0%`, filter: `blur(${borrao}px)`, transform: `skewX(${(dir === "exiting" ? -1 : 1) * Math.sin(e * Math.PI) * -6}deg)` }}>
      {children}
    </AbsoluteFill>
  );
};

/** Glitch: corte seco com faixas deslocadas e separação RGB. */
const Glitch: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  const visivel = dir === "exiting" ? p < 0.5 : p >= 0.5;
  const forca = Math.sin(p * Math.PI);
  const seed = Math.floor(p * 9);
  const faixas = faixasGlitch(seed, 8);
  if (!visivel) return null;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ translate: `${forca * 18}px 0px`, filter: `saturate(${1 + forca * 2}) contrast(${1 + forca * 0.4})` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.55 * forca, background: "rgba(255,0,60,0.55)", translate: `${-forca * 22}px 0px` }} />
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.5 * forca, background: "rgba(0,220,255,0.45)", translate: `${forca * 22}px 0px` }} />
      {faixas.map((fx, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${fx.top}%`,
            height: `${fx.altura}%`,
            background: i % 3 === 0 ? COR.laranja : i % 3 === 1 ? "rgba(255,255,255,0.85)" : COR.tinta,
            translate: `${fx.desloca * forca}px 0px`,
            opacity: 0.8 * forca,
            mixBlendMode: i % 3 === 1 ? "overlay" : "normal",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const balaoSvg = (cor: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><path fill='${cor}' d='${BALAO_D}'/></svg>`)}")`;

/**
 * Balão da marca: o balão de fala cresce do centro e engole a tela; a
 * próxima cena aparece dentro dele, com uma borda laranja à frente.
 */
const Balao: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  if (dir === "exiting") {
    return <AbsoluteFill style={{ scale: String(1 + io(p) * 0.08), filter: `brightness(${1 - p * 0.35})` }}>{children}</AbsoluteFill>;
  }
  const e = io(p);
  const tam = (k: number) => `${Math.max(0.001, k) * 900}%`;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: COR.laranja,
          maskImage: balaoSvg("#000"),
          WebkitMaskImage: balaoSvg("#000"),
          maskSize: tam(e * 1.18 + 0.02),
          WebkitMaskSize: tam(e * 1.18 + 0.02),
          maskPosition: "50% 45%",
          WebkitMaskPosition: "50% 45%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          rotate: `${(1 - e) * -8}deg`,
        }}
      />
      <AbsoluteFill
        style={{
          maskImage: balaoSvg("#000"),
          WebkitMaskImage: balaoSvg("#000"),
          maskSize: tam(Math.max(0, e - 0.1) * 1.25),
          WebkitMaskSize: tam(Math.max(0, e - 0.1) * 1.25),
          maskPosition: "50% 45%",
          WebkitMaskPosition: "50% 45%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          rotate: `${(1 - e) * -8}deg`,
        }}
      >
        <AbsoluteFill style={{ rotate: `${(1 - e) * 8}deg`, scale: String(1.12 - e * 0.12) }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Íris: a próxima cena abre num círculo com anel laranja. */
const Iris: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  if (dir === "exiting") return <AbsoluteFill style={{ filter: `brightness(${1 - p * 0.5})` }}>{children}</AbsoluteFill>;
  const r = io(p) * 120;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${r + 2.5}% at 50% 52%)`, background: COR.laranja }} />
      <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 52%)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Luz: fusão com vazamento de luz âmbar por cima. */
const Luz: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  const o = dir === "entering" ? interpolate(p, [0.25, 0.75], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
      {dir === "entering" && (
        <Solid width={1080} height={1920} color="transparent" effects={[lightLeak({ progress: p, seed: 3, hueShift: 18 })]} />
      )}
    </AbsoluteFill>
  );
};

/** Corte com flash branco curto. */
const Corte: React.FC<Props> = ({ presentationProgress: p, presentationDirection: dir, children }) => {
  const visivel = dir === "exiting" ? p < 0.5 : p >= 0.5;
  const flash = interpolate(p, [0.4, 0.5, 0.75], [0, 0.85, 0], clamp);
  return (
    <AbsoluteFill>
      {visivel && <AbsoluteFill style={{ scale: dir === "entering" ? String(1.06 - (p - 0.5) * 0.12) : "1" }}>{children}</AbsoluteFill>}
      {dir === "entering" && <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
    </AbsoluteFill>
  );
};

const mk = (component: React.FC<Props>): TransitionPresentation<P> => ({ component, props: {} as P });

export const TRANSICOES = {
  chicote: mk(Chicote),
  glitch: mk(Glitch),
  balao: mk(Balao),
  iris: mk(Iris),
  luz: mk(Luz),
  corte: mk(Corte),
};
