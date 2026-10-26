import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CenaAbertura, CenaAssinatura, CenaCartoes, CenaNumeros, CenaPergunta, CenaPipeline, CenaReels, CenaTela, CenaTitulo } from "./cenas";
import { FPS, INTRO_S, OUTRO_S } from "./marca";
import { Legenda } from "./pecas";
import { ROTEIRO, type Cena } from "./roteiro";

export type PropsPitch = {
  inicios: number[];
  legendas: { texto: string; s: number; e: number }[];
  duracaoVoz: number;
  quadros: string[]; // quadros do Pipeline ao vivo, em ordem (public/telas/...)
};

const fatia = (q: string[], de: number, ate: number) => {
  const a = Math.floor(de * (q.length - 1));
  const b = Math.max(a + 1, Math.ceil(ate * (q.length - 1)));
  return q.slice(a, b + 1);
};

function renderCena(c: Cena, quadros: string[]) {
  switch (c.tipo) {
    case "titulo": return <CenaTitulo {...c.p} />;
    case "tela": return <CenaTela {...c.p} />;
    case "cartoes": return <CenaCartoes {...c.p} />;
    case "numeros": return <CenaNumeros {...c.p} />;
    case "reels": return <CenaReels {...c.p} />;
    case "pergunta": return <CenaPergunta {...c.p} />;
    case "pipeline": return <CenaPipeline quadros={fatia(quadros, c.p.de, c.p.ate).map((n) => staticFile(n))} zooms={c.p.zooms} />;
  }
}

export const Pitch: React.FC<PropsPitch> = ({ inicios, legendas, duracaoVoz, quadros }) => {
  const f = useCurrentFrame();
  const t = f / FPS - INTRO_S;
  const linha = legendas.find((l) => t >= l.s - 0.05 && t <= l.e + 0.25);
  const fimVoz = INTRO_S + duracaoVoz;
  const total = Math.round((fimVoz + OUTRO_S) * FPS);
  const trilhaVol = (fr: number) => {
    const s = fr / FPS;
    if (s < INTRO_S) return interpolate(s, [0, INTRO_S], [0.35, 0.5]);
    if (s > fimVoz) return interpolate(s, [fimVoz, fimVoz + 1.5], [0.12, 0.5], { extrapolateRight: "clamp" });
    return interpolate(s, [INTRO_S, INTRO_S + 1], [0.5, 0.12], { extrapolateRight: "clamp" });
  };
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      <Sequence durationInFrames={Math.round(INTRO_S * FPS) + 8}><CenaAbertura /></Sequence>
      {ROTEIRO.map((c, i) => {
        if (!inicios.length) return null;
        const de = Math.round((INTRO_S + inicios[i]) * FPS);
        const ate = i + 1 < ROTEIRO.length ? Math.round((INTRO_S + inicios[i + 1]) * FPS) : Math.round(fimVoz * FPS);
        return (
          <Sequence key={i} from={de} durationInFrames={Math.max(15, ate - de + 6)} name={`${c.tipo}: ${c.ancora}`}>
            {renderCena(c, quadros)}
          </Sequence>
        );
      })}
      <Sequence from={Math.round(fimVoz * FPS)} durationInFrames={total - Math.round(fimVoz * FPS)}><CenaAssinatura /></Sequence>
      <Legenda texto={linha?.texto ?? null} />
      <Sequence from={Math.round(INTRO_S * FPS)}><Audio src={staticFile("locucao.mp3")} /></Sequence>
      <Audio src={staticFile("trilha.wav")} volume={trilhaVol} />
    </AbsoluteFill>
  );
};
