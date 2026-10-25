import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE } from "../marca";
import { Grao, IconeMarca } from "../pecas";
import type { CenaAbertura } from "../tipos";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SAIDA = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Abertura (~3,5 s): o ponto laranja cai e quica, "RESUMO" bate na tela com
 * punch-in e desfoque, "DO DIA" corre ao lado, a data é datilografada e um
 * letreiro de manchetes roda embaixo, como no rodapé de telejornal.
 */
export const Abertura: React.FC<CenaAbertura> = ({ data, chamadas }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ponto cai do alto e quica (0–0,5 s)
  const queda = spring({ frame: f, fps, config: { damping: 8, stiffness: 170, mass: 0.7 } });
  const pontoY = interpolate(queda, [0, 1], [-700, 0]);
  // ...e explode num disco que pinta o fundo de laranja por um instante
  const disco = interpolate(f, [12, 20], [0, 1], { ...clamp, easing: SAIDA });
  const discoSai = interpolate(f, [20, 27], [1, 0], clamp);

  const bate = spring({ frame: f - 16, fps, config: { damping: 11, stiffness: 240, mass: 0.6 } });
  const corre = interpolate(f, [24, 36], [0, 1], { ...clamp, easing: SAIDA });
  const dataTxt = data.slice(0, Math.max(0, Math.floor((f - 34) * 1.6)));
  const tremor = f >= 16 && f < 24 ? Math.sin(f * 2.4) * (24 - f) * 1.4 : 0;

  // Grade de redação ao fundo, andando devagar
  const grade = (f * 0.6) % 120;
  const ticker = chamadas.join("   •   ");

  return (
    <AbsoluteFill style={{ background: COR.tinta, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.045) 2px, transparent 2px)",
          backgroundSize: "120px 120px",
          backgroundPosition: `${grade}px ${grade}px`,
        }}
      />
      {/* disco laranja da explosão do ponto */}
      <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>
        <div
          style={{
            width: 2600,
            height: 2600,
            borderRadius: "50%",
            background: COR.laranja,
            scale: String(disco * discoSai),
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px", translate: `${tremor}px 0px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 40, opacity: interpolate(f, [26, 36], [0, 1], clamp) }}>
          <IconeMarca tamanho={92} v={interpolate(f, [28, 44], [0, 1], { ...clamp, easing: SAIDA })} ponto={0} />
          <span style={{ fontFamily: FONTE.marca, fontWeight: 700, fontSize: 52, color: COR.branco, lineHeight: 1 }}>
            vozes <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 36 }}>paranaenses</span>
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              fontFamily: FONTE.titulo,
              fontWeight: 800,
              fontSize: 236,
              lineHeight: 0.86,
              letterSpacing: "-0.04em",
              color: COR.branco,
              scale: String(interpolate(bate, [0, 1], [2.4, 1])),
              opacity: f >= 16 ? 1 : 0,
              filter: `blur(${(1 - Math.min(1, bate)) * 18}px)`,
              transformOrigin: "0% 60%",
            }}
          >
            Resumo
          </div>
          {/* o ponto laranja pousa no fim de "Resumo" */}
          <div
            style={{
              position: "absolute",
              left: 838,
              top: 150,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: COR.laranja,
              translate: `0px ${pontoY}px`,
              scale: f < 12 ? "2.2" : "1",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONTE.chapeu,
            fontWeight: 800,
            fontSize: 168,
            lineHeight: 1,
            letterSpacing: `${interpolate(corre, [0, 1], [0.5, 0.06])}em`,
            color: COR.laranja,
            textTransform: "uppercase",
            translate: `${(1 - corre) * 600}px 0px`,
            opacity: corre,
            marginTop: 6,
          }}
        >
          do dia
        </div>
        <div style={{ fontFamily: FONTE.ui, fontWeight: 600, fontSize: 48, color: "rgba(255,255,255,0.85)", marginTop: 34, minHeight: 60 }}>
          {dataTxt}
          <span style={{ opacity: Math.floor(f / 8) % 2 ? 1 : 0, color: COR.laranja }}>|</span>
        </div>
      </AbsoluteFill>

      {/* letreiro de manchetes (rodapé de telejornal) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1340,
          height: 92,
          background: COR.laranja,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          translate: `${(1 - interpolate(f, [30, 44], [0, 1], { ...clamp, easing: SAIDA })) * -1100}px 0px`,
        }}
      >
        <div style={{ background: COR.tinta, color: COR.laranja, fontFamily: FONTE.chapeu, fontWeight: 800, fontSize: 42, padding: "0 26px", height: "100%", display: "flex", alignItems: "center", letterSpacing: "0.08em", zIndex: 1 }}>
          HOJE
        </div>
        <div
          style={{
            whiteSpace: "nowrap",
            fontFamily: FONTE.chapeu,
            fontWeight: 700,
            fontSize: 44,
            color: COR.tinta,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            translate: `${300 - f * 9}px 0px`,
            paddingLeft: 30,
          }}
        >
          {ticker}   •   {ticker}
        </div>
      </div>
      <Grao forca={0.08} />
    </AbsoluteFill>
  );
};
