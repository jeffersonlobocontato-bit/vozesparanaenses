import React from "react";
import { Composition, staticFile } from "remotion";
import { Pitch, type PropsPitch } from "./Pitch";
import { FPS, INTRO_S, OUTRO_S } from "./marca";
import { ROTEIRO } from "./roteiro";
import { linhasDeLegenda, resolverAncoras, type Palavra } from "./tempo";

const vazio: PropsPitch = { inicios: [], legendas: [], duracaoVoz: 250, quadros: [] };

export const Root: React.FC = () => (
  <Composition
    id="Pitch"
    component={Pitch}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={Math.round((INTRO_S + 250 + OUTRO_S) * FPS)}
    defaultProps={vazio}
    calculateMetadata={async () => {
      const [palavras, loc, quadros] = await Promise.all([
        fetch(staticFile("legendas.json")).then((r) => r.json()) as Promise<Palavra[]>,
        fetch(staticFile("locucao.json")).then((r) => r.json()) as Promise<{ duracao: number }>,
        fetch(staticFile("telas/quadros.json")).then((r) => r.json()) as Promise<string[]>,
      ]);
      const inicios = resolverAncoras(palavras, ROTEIRO.map((c) => c.ancora), loc.duracao);
      return {
        durationInFrames: Math.round((INTRO_S + loc.duracao + OUTRO_S) * FPS),
        props: { inicios, legendas: linhasDeLegenda(palavras), duracaoVoz: loc.duracao, quadros },
      };
    }}
  />
);
