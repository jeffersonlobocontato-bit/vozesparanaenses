import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE } from "../marca";
import { Grao, IconeMarca, MapaParana } from "../pecas";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SAIDA = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Assinatura do Vozes (~6,5 s): o balão nasce, o V se desenha, o ponto
 * laranja cai e quica no lugar; a marca se abre ao lado; o cartão do perfil
 * sobe e um toque aperta "Seguir", que vira "Seguindo".
 */
export const Assinatura: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (t: number, cfg = { damping: 12, stiffness: 170, mass: 0.7 }) => spring({ frame: f - t * fps, fps, config: cfg });

  const balao = s(0.05, { damping: 10, stiffness: 200, mass: 0.6 });
  const v = interpolate(f, [0.35 * fps, 0.85 * fps], [0, 1], { ...clamp, easing: SAIDA });
  const queda = s(0.85, { damping: 6, stiffness: 190, mass: 0.6 });
  const sobe = interpolate(f, [1.35 * fps, 1.85 * fps], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const marca = interpolate(f, [1.6 * fps, 2.1 * fps], [0, 1], { ...clamp, easing: SAIDA });
  const slogan = interpolate(f, [2.15 * fps, 2.6 * fps], [0, 1], { ...clamp, easing: SAIDA });
  const cartao = s(2.6, { damping: 13, stiffness: 160, mass: 0.8 });
  const toque = 3.7;
  const apertou = f >= toque * fps;
  const ripple = interpolate(f, [toque * fps, (toque + 0.5) * fps], [0, 1], clamp);
  const botao = s(toque, { damping: 9, stiffness: 300, mass: 0.5 });
  const dedoX = interpolate(f, [3.0 * fps, 3.65 * fps], [260, 0], { ...clamp, easing: SAIDA });
  const dedoY = interpolate(f, [3.0 * fps, 3.65 * fps], [240, 0], { ...clamp, easing: SAIDA });
  const dedoVis = interpolate(f, [3.0 * fps, 3.2 * fps, 4.4 * fps, 4.7 * fps], [0, 1, 1, 0], clamp);
  const link = interpolate(f, [4.3 * fps, 4.8 * fps], [0, 1], { ...clamp, easing: SAIDA });
  const brilho = 0.5 + 0.5 * Math.sin(f / 7);

  // ícone: centro da tela → sobe para dar lugar à marca
  const iconeY = interpolate(sobe, [0, 1], [0, -380]);
  const iconeTam = interpolate(sobe, [0, 1], [430, 250]);

  return (
    <AbsoluteFill style={{ background: COR.tinta, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(95% 65% at 50% 40%, ${COR.verde} 0%, #173F33 45%, ${COR.tinta} 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(50% 30% at 50% 30%, rgba(226,159,101,${0.12 + brilho * 0.06}), transparent 70%)` }} />
      {/* Paraná em marca d'água: o contorno se desenha e as cidades acendem */}
      <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>
        <div style={{ translate: `0px ${-170 + iconeY * 0.15}px`, scale: String(1 + f / fps / 80) }}>
          <MapaParana
            largura={1000}
            traco={interpolate(f, [0, 1.6 * fps], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) })}
            preenche={interpolate(f, [1.0 * fps, 2.0 * fps], [0, 1], clamp)}
            pontos={interpolate(f, [1.2 * fps, 3.2 * fps], [0, 1], clamp)}
            opacidade={0.42}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>
        <div style={{ translate: `0px ${-120 + iconeY}px` }}>
          <IconeMarca
            tamanho={iconeTam}
            balao={balao}
            v={v}
            ponto={f >= 0.85 * fps ? 1 : 0}
            quedaPonto={interpolate(queda, [0, 1], [-420, 0])}
          />
        </div>
      </AbsoluteFill>

      {/* marca */}
      <AbsoluteFill style={{ alignItems: "center", top: 760 }}>
        <div style={{ overflow: "hidden", paddingBottom: 10 }}>
          <div style={{ fontFamily: FONTE.marca, fontWeight: 900, fontSize: 170, lineHeight: 1, color: COR.branco, translate: `0px ${(1 - marca) * 190}px`, letterSpacing: "-0.01em" }}>
            vozes
          </div>
        </div>
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontFamily: FONTE.marca, fontWeight: 700, fontSize: 84, lineHeight: 1, color: "rgba(255,255,255,0.82)", translate: `0px ${(1 - marca) * 110}px` }}>
            paranaenses
          </div>
        </div>
        <div style={{ fontFamily: FONTE.titulo, fontStyle: "italic", fontWeight: 400, fontSize: 44, color: COR.laranja, marginTop: 30, textAlign: "center", maxWidth: 900, opacity: slogan, translate: `0px ${(1 - slogan) * 20}px` }}>
          O portal com sotaque de todas as regiões
        </div>
      </AbsoluteFill>

      {/* cartão do perfil com o botão Seguir */}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 1210,
          background: COR.branco,
          borderRadius: 34,
          padding: "26px 28px",
          display: "flex",
          alignItems: "center",
          gap: 22,
          translate: `0px ${(1 - cartao) * 500}px`,
          opacity: cartao > 0.02 ? 1 : 0,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ width: 104, height: 104, borderRadius: "50%", background: COR.tinta, display: "grid", placeItems: "center", flex: "none", boxShadow: `0 0 0 5px ${COR.laranja}` }}>
          <IconeMarca tamanho={70} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONTE.ui, fontWeight: 800, fontSize: 40, color: COR.tinta, lineHeight: 1.1 }}>@vozesparanaenses</div>
          <div style={{ fontFamily: FONTE.ui, fontWeight: 500, fontSize: 28, color: "#55625E", marginTop: 6 }}>Notícias das 399 cidades</div>
        </div>
        <div style={{ position: "relative", flex: "none" }}>
          <div
            style={{
              background: apertou ? COR.tinta : COR.laranja,
              color: apertou ? COR.branco : COR.tinta,
              fontFamily: FONTE.ui,
              fontWeight: 800,
              fontSize: 34,
              padding: "18px 30px",
              borderRadius: 18,
              scale: String(apertou ? 0.9 + 0.1 * Math.min(1.15, botao) : 1),
              whiteSpace: "nowrap",
            }}
          >
            {apertou ? "Seguindo ✓" : "Seguir"}
          </div>
          {/* onda do toque */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 260,
              height: 260,
              marginLeft: -130,
              marginTop: -130,
              borderRadius: "50%",
              border: `6px solid ${COR.laranja}`,
              scale: String(ripple),
              opacity: apertou ? 1 - ripple : 0,
            }}
          />
          {/* confete de pontos laranja */}
          {apertou &&
            Array.from({ length: 12 }, (_, i) => {
              const ang = (i / 12) * Math.PI * 2 + random(`a${i}`) * 0.4;
              const d = ripple * (120 + random(`d${i}`) * 90);
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: i % 3 ? COR.laranja : COR.verdeClaro,
                    translate: `${Math.cos(ang) * d - 8}px ${Math.sin(ang) * d - 8}px`,
                    opacity: 1 - ripple,
                  }}
                />
              );
            })}
          {/* dedo (cursor de toque) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: 74,
              height: 74,
              marginLeft: -37,
              marginTop: -37,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.55)",
              border: "4px solid rgba(18,32,30,0.55)",
              translate: `${dedoX}px ${dedoY}px`,
              scale: String(f >= toque * fps && f < (toque + 0.15) * fps ? 0.8 : 1),
              opacity: dedoVis,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1440,
          textAlign: "center",
          fontFamily: FONTE.chapeu,
          fontWeight: 700,
          fontSize: 40,
          letterSpacing: "0.1em",
          color: COR.branco,
          textTransform: "uppercase",
          opacity: link,
          translate: `0px ${(1 - link) * 20}px`,
        }}
      >
        Siga e leia tudo no <span style={{ color: COR.laranja }}>link da bio</span>
      </div>
      <Grao forca={0.07} />
    </AbsoluteFill>
  );
};
