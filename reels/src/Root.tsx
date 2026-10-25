import React from "react";
import { Composition, delayRender, continueRender } from "remotion";
import { ResumoDoDia, duracaoTotal } from "./ResumoDoDia";
import { fontesProntas } from "./marca";
import exemplo from "./exemplo.json";
import type { Roteiro } from "./tipos";

const h = delayRender("fontes");
fontesProntas.then(() => continueRender(h)).catch(() => continueRender(h));

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ResumoDoDia"
    component={ResumoDoDia}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={exemplo as unknown as Roteiro}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round(duracaoTotal(props) * props.fps),
      fps: props.fps,
    })}
  />
);
