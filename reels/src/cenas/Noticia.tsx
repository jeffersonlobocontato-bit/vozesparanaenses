import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE } from "../marca";
import { ChapeuBalao, Contador, Grao, LinhaFina, TituloSincronizado, agendaDasPalavras } from "../pecas";
import type { CenaNoticia } from "../tipos";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SAIDA = Easing.bezier(0.16, 1, 0.3, 1);

/** Quando a narração termina o título (para a linha fina entrar depois). */
function fimDoTitulo(c: CenaNoticia): number {
  const pals = c.titulo.split(/\s+/);
  const ag = agendaDasPalavras(pals, c.palavras, 0.45);
  return (ag[ag.length - 1] ?? 1) + 0.5;
}

/** Instante em que a narração fala o número (para o contador e o punch-in). */
function instanteDoNumero(c: CenaNoticia): number {
  const p = c.palavras.find((w) => /\d/.test(w.texto));
  return p ? p.t : 0.9;
}

const Credito: React.FC<{ texto?: string | null }> = ({ texto }) =>
  texto ? (
    <div style={{ position: "absolute", right: 150, top: 1548, fontFamily: FONTE.ui, fontWeight: 500, fontSize: 22, color: "rgba(255,255,255,0.7)", textAlign: "right", maxWidth: 620 }}>
      {/^foto|^ilustra/i.test(texto) ? texto : `Foto: ${texto}`}
    </div>
  ) : null;

/** Notícia com foto: Ken Burns, punch-in no número, manchete sincronizada. */
const ComFoto: React.FC<CenaNoticia> = (c) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tNum = instanteDoNumero(c);
  const punch = spring({ frame: f - tNum * fps, fps, config: { damping: 14, stiffness: 200 } });
  const zoom = interpolate(f, [0, durationInFrames], [1.06, 1.2]) + Math.sin(Math.min(1, punch) * Math.PI) * 0.035;
  const deriva = interpolate(f, [0, durationInFrames], [-2, 2]);
  return (
    <AbsoluteFill style={{ background: COR.tinta, overflow: "hidden" }}>
      {c.foto && (
        <Img
          src={staticFile(c.foto)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", scale: String(zoom), translate: `${deriva}% 0%` }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(12,22,20,0.55) 0%, rgba(12,22,20,0) 22%, rgba(12,22,20,0) 40%, rgba(12,22,20,0.82) 62%, rgba(12,22,20,0.96) 100%)",
        }}
      />
      <Corpo c={c} topo={c.titulo.length > 60 ? 800 : 880} />
      <Credito texto={c.credito} />
      <Grao forca={0.05} />
    </AbsoluteFill>
  );
};

/** Bloco de texto comum: chapéu, manchete sincronizada, linha fina. */
const Corpo: React.FC<{ c: CenaNoticia; topo: number; tamanho?: number }> = ({ c, topo, tamanho }) => {
  const fimTit = fimDoTitulo(c);
  const tam = tamanho ?? (c.titulo.length > 85 ? 70 : c.titulo.length > 60 ? 78 : 88);
  return (
    <div style={{ position: "absolute", left: 64, right: 150, top: topo, display: "flex", flexDirection: "column", gap: 34 }}>
      <ChapeuBalao texto={c.chapeu} cor={c.cor} aos={0.3} />
      <div style={{ marginTop: 10 }}>
        <TituloSincronizado texto={c.titulo} fala={c.palavras} aos={0.45} tamanho={tam} />
      </div>
      {c.linhaFina && <LinhaFina texto={c.linhaFina} aos={Math.min(c.dur - 1.6, fimTit)} />}
    </div>
  );
};

/** Letreiro gigante vazado ao fundo, correndo devagar (o lugar da notícia). */
const LetreiroFundo: React.FC<{ texto: string; y: number; vel?: number }> = ({ texto, y, vel = 2.2 }) => {
  const f = useCurrentFrame();
  const t = `${texto}  ·  `.repeat(6);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        whiteSpace: "nowrap",
        fontFamily: FONTE.chapeu,
        fontWeight: 800,
        fontSize: 260,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: "transparent",
        WebkitTextStroke: "2px rgba(255,255,255,0.09)",
        translate: `${-f * vel}px 0px`,
      }}
    >
      {t}
    </div>
  );
};

/** Notícia sem foto: o número vira a imagem (contador gigante). */
const ComNumero: React.FC<CenaNoticia> = (c) => {
  const f = useCurrentFrame();
  const local = c.chapeu.split("·")[0].trim();
  const tNum = Math.max(0.35, instanteDoNumero(c) - 0.2);
  const { fps } = useVideoConfig();
  const rot = interpolate(f, [tNum * fps + 20, tNum * fps + 34], [0, 1], { ...clamp, easing: SAIDA });
  return (
    <AbsoluteFill style={{ background: COR.tinta, overflow: "hidden" }}>
      <LetreiroFundo texto={local} y={260} />
      <LetreiroFundo texto={local} y={1500} vel={-1.6} />
      <div style={{ position: "absolute", left: 64, top: 470, right: 120 }}>
        {c.numero && (
          <>
            <Contador valor={c.numero.valor} aos={tNum} tamanho={Math.min(290, Math.floor(1700 / Math.max(4, c.numero.valor.length)))} cor={COR.branco} />
            <div
              style={{
                fontFamily: FONTE.chapeu,
                fontWeight: 700,
                fontSize: 54,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: COR.laranja,
                marginTop: 18,
                opacity: rot,
                translate: `${(1 - rot) * -40}px 0px`,
              }}
            >
              {c.numero.rotulo}
            </div>
          </>
        )}
      </div>
      <Corpo c={c} topo={c.numero ? 960 : 720} tamanho={c.titulo.length > 80 ? 70 : 80} />
      <Grao forca={0.08} />
    </AbsoluteFill>
  );
};

/** Alerta: fundo vermelho, faixa de advertência correndo e dados que sobem. */
const Alerta: React.FC<CenaNoticia> = (c) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pisca = Math.floor(f / 9) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: COR.alerta, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,0.12), transparent 60%), linear-gradient(180deg, transparent 50%, ${COR.alertaEscuro})` }} />
      {/* faixa de advertência */}
      <div
        style={{
          position: "absolute",
          top: 236,
          left: -200,
          right: -200,
          height: 46,
          backgroundImage: `repeating-linear-gradient(-45deg, ${COR.tinta} 0 28px, ${COR.laranja} 28px 56px)`,
          backgroundPosition: `${f * 4}px 0px`,
          opacity: 0.9,
        }}
      />
      <div style={{ position: "absolute", left: 64, top: 340, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ background: COR.branco, color: COR.alerta, fontFamily: FONTE.chapeu, fontWeight: 800, fontSize: 64, letterSpacing: "0.14em", padding: "10px 30px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: COR.alerta, opacity: pisca ? 1 : 0.25 }} />
          ALERTA
        </div>
      </div>
      <Corpo c={{ ...c, linhaFina: null }} topo={520} tamanho={78} />
      <div style={{ position: "absolute", left: 64, right: 150, top: 1060, display: "flex", gap: 18 }}>
        {(c.dados ?? []).slice(0, 3).map((d, i) => {
          const aos = 1.6 + i * 0.35;
          const k = spring({ frame: f - aos * fps, fps, config: { damping: 14, stiffness: 180 } });
          const ehNumero = /\d/.test(d.valor);
          return (
            <div key={i} style={{ flex: 1, background: COR.alertaEscuro, borderRadius: 14, padding: "22px 22px 20px", translate: `0px ${(1 - k) * 120}px`, opacity: k }}>
              {ehNumero ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <Contador valor={d.valor} aos={aos} tamanho={74} />
                  {d.unidade && <span style={{ fontFamily: FONTE.ui, fontWeight: 700, fontSize: 30, color: COR.branco }}>{d.unidade}</span>}
                </div>
              ) : (
                <div style={{ fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 64, color: COR.branco, lineHeight: 0.95 }}>{d.valor}</div>
              )}
              <div style={{ fontFamily: FONTE.ui, fontWeight: 600, fontSize: 26, color: "rgba(255,255,255,0.88)", marginTop: 10, lineHeight: 1.2 }}>{d.rotulo}</div>
            </div>
          );
        })}
      </div>
      <Grao forca={0.07} />
    </AbsoluteFill>
  );
};

export const Noticia: React.FC<CenaNoticia> = (c) => {
  if (c.estilo === "alerta") return <Alerta {...c} />;
  if (c.estilo === "foto" && c.foto) return <ComFoto {...c} />;
  return <ComNumero {...c} />;
};
