import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Abertura } from "./cenas/Abertura";
import { Assinatura } from "./cenas/Assinatura";
import { Noticia } from "./cenas/Noticia";
import { TRANSICOES } from "./fx/transicoes";
import { BarraProgresso, SeloTopo } from "./pecas";
import { DURACAO_TRANSICAO, type Roteiro } from "./tipos";

/** Início (s) de cada cena na linha do tempo final (as transições sobrepõem). */
export function inicios(r: Roteiro): number[] {
  const out: number[] = [];
  let t = 0;
  r.cenas.forEach((c, i) => {
    out.push(t);
    t += c.dur - (i < r.cenas.length - 1 ? DURACAO_TRANSICAO : 0);
  });
  return out;
}

export function duracaoTotal(r: Roteiro): number {
  return r.cenas.reduce((s, c) => s + c.dur, 0) - DURACAO_TRANSICAO * Math.max(0, r.cenas.length - 1);
}

/** Selo e barra de progresso por cima das notícias (somem na abertura e na assinatura). */
const Sobreposicao: React.FC<{ r: Roteiro }> = ({ r }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ini = inicios(r);
  const noticias = r.cenas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === "noticia");
  if (!noticias.length) return null;
  const a = ini[noticias[0].i];
  const ultima = noticias[noticias.length - 1];
  const b = ini[ultima.i] + ultima.c.dur - DURACAO_TRANSICAO;
  const t = f / fps;
  const o = interpolate(t, [a, a + 0.3, b - 0.1, b + 0.2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const segmentos = noticias.map(({ c, i }) => ({ ini: ini[i], fim: ini[i] + c.dur - DURACAO_TRANSICAO, cor: (c as { cor: string }).cor }));
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <BarraProgresso segmentos={segmentos} total={noticias.length} />
      <SeloTopo />
    </AbsoluteFill>
  );
};

export const ResumoDoDia: React.FC<Roteiro> = (r) => {
  const { fps } = useVideoConfig();
  const T = Math.round(DURACAO_TRANSICAO * fps);
  const itens: React.ReactNode[] = [];
  r.cenas.forEach((c, i) => {
    if (i > 0) {
      const tr = c.tipo === "abertura" ? "corte" : c.transicao;
      itens.push(<TransitionSeries.Transition key={`t${i}`} presentation={TRANSICOES[tr]} timing={linearTiming({ durationInFrames: T })} />);
    }
    itens.push(
      <TransitionSeries.Sequence key={`s${i}`} name={c.tipo === "noticia" ? c.chapeu : c.tipo} durationInFrames={Math.round(c.dur * fps)}>
        {c.tipo === "abertura" ? <Abertura {...c} /> : c.tipo === "noticia" ? <Noticia {...c} /> : <Assinatura />}
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <AbsoluteFill style={{ background: "#12201E" }}>
      <TransitionSeries>{itens}</TransitionSeries>
      <Sobreposicao r={r} />
      {r.audio && (
        <Sequence>
          <Audio src={staticFile(r.audio)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
