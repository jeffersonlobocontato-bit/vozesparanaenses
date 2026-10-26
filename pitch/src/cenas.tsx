import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COR, FONTE } from "./marca";
import { Destaque, Fundo, Marca, Navegador, Pill, SUAVE, Titulo, VAIVEM, clamp } from "./pecas";

const entrada = (f: number, de = 0, dur = 18) => interpolate(f, [de, de + dur], [0, 1], { ...clamp, easing: SUAVE });

// ------------------------------------------------------------------ título
export type PropsTitulo = { pill?: string; linhas: { t: string; apagada?: boolean; cor?: string }[]; tamanho?: number; sub?: string; numero?: { valor: string; rotulo: string } };
export const CenaTitulo: React.FC<PropsTitulo> = ({ pill, linhas, tamanho = 104, sub, numero }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Fundo />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40, padding: "0 160px" }}>
        {pill && <Pill entra={entrada(f)}>{pill}</Pill>}
        {numero && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, opacity: entrada(f, 4), scale: String(0.9 + 0.1 * entrada(f, 4)) }}>
            <span style={{ fontFamily: FONTE.ui, fontWeight: 700, fontSize: 260, lineHeight: 0.9, letterSpacing: "-0.05em", color: COR.agua }}>{numero.valor}</span>
            <span style={{ fontFamily: FONTE.ui, fontWeight: 500, fontSize: 56, color: COR.mut, maxWidth: 560, lineHeight: 1.1 }}>{numero.rotulo}</span>
          </div>
        )}
        <Titulo linhas={linhas} tamanho={tamanho} alinhar="center" de={numero ? 10 : 0} />
        {sub && <div style={{ fontFamily: FONTE.mono, fontSize: 30, color: COR.agua, opacity: entrada(f, 26), letterSpacing: "0.02em" }}>{sub}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ tela
export type Marcacao = { x: number; y: number; w: number; h: number; rotulo?: string; lado?: "direita" | "esquerda" | "baixo"; aos?: number };
export type PropsTela = {
  img: string; url: string; imgAltura: number; de?: number; ate?: number; zoom?: [number, number]; foco?: [number, number];
  pill?: string; titulo?: string[]; texto?: string; cheia?: boolean; marcas?: Marcacao[];
};
export const CenaTela: React.FC<PropsTela> = ({ img, url, imgAltura, de = 0, ate = 0, zoom, foco, pill, titulo, texto, cheia, marcas = [] }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const larg = cheia ? 1640 : 1080;
  const alt = cheia ? 900 : 860;
  const escala = larg / 1920;
  const visivel = (alt - 52) / escala;
  const maxY = Math.max(0, imgAltura - visivel);
  const e = entrada(f, 0, 22);
  const sai = interpolate(f, [durationInFrames - 8, durationInFrames], [1, 0.0], clamp);
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, sai + 0.0001) }}>
      <Fundo />
      {cheia ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 40 }}>
          <Navegador img={img} url={url} largura={larg} altura={alt} de={Math.min(de, maxY)} ate={Math.min(ate, maxY)} zoom={zoom} foco={foco} entra={e}>
            {marcas.map((m, i) => (
              <Destaque key={i} x={m.x * escala} y={m.y * escala - Math.min(ate, maxY) * escala} w={m.w * escala} h={m.h * escala} rotulo={m.rotulo} lado={m.lado} entra={entrada(f, (m.aos ?? 0.45) * durationInFrames, 12)} />
            ))}
          </Navegador>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 90px 40px 110px", gap: 70 }}>
          <div style={{ width: 600, display: "flex", flexDirection: "column", gap: 34, flex: "none" }}>
            {pill && <div style={{ display: "flex" }}><Pill entra={entrada(f, 2)}>{pill}</Pill></div>}
            {titulo && <Titulo linhas={titulo.map((t) => ({ t }))} tamanho={66} />}
            {texto && <div style={{ fontFamily: FONTE.mono, fontSize: 26, color: COR.agua, opacity: entrada(f, 22), lineHeight: 1.4 }}>{texto}</div>}
          </div>
          <Navegador img={img} url={url} largura={larg} altura={alt} de={Math.min(de, maxY)} ate={Math.min(ate, maxY)} zoom={zoom} foco={foco} entra={e}>
            {marcas.map((m, i) => (
              <Destaque key={i} x={m.x * escala} y={m.y * escala - Math.min(ate, maxY) * escala} w={m.w * escala} h={m.h * escala} rotulo={m.rotulo} lado={m.lado} entra={entrada(f, (m.aos ?? 0.45) * durationInFrames, 12)} />
            ))}
          </Navegador>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ duas telas lado a lado (imagens soltas, ex.: Portal da Imprensa)
export type PropsCartoes = { pill?: string; titulo?: string[]; imagens: { img: string; largura: number }[] };
export const CenaCartoes: React.FC<PropsCartoes> = ({ pill, titulo, imagens }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(f, [0, durationInFrames], [0, 1], { ...clamp, easing: VAIVEM });
  return (
    <AbsoluteFill>
      <Fundo />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 90px 40px 110px", gap: 60 }}>
        <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 34, flex: "none" }}>
          {pill && <div style={{ display: "flex" }}><Pill entra={entrada(f, 2)}>{pill}</Pill></div>}
          {titulo && <Titulo linhas={titulo.map((t) => ({ t }))} tamanho={64} />}
        </div>
        <div style={{ flex: 1, position: "relative", height: 860 }}>
          {imagens.map((im, i) => {
            const e = entrada(f, 6 + i * 14, 20);
            return (
              <div key={i} style={{
                position: "absolute", top: 30 + i * 70 - p * 60, left: i * 260, width: im.largura, borderRadius: 18, overflow: "hidden",
                boxShadow: "0 40px 100px rgba(0,0,0,0.7)", border: `1px solid ${COR.borda}`, opacity: e, translate: `0px ${(1 - e) * 80}px`,
              }}>
                <Img src={staticFile(im.img)} style={{ width: "100%", display: "block" }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ pipeline ao vivo (quadros reais do replay)
export type ZoomPipeline = { aos: number; rect: [number, number, number, number]; rotulo?: string };
export type PropsPipeline = { quadros: string[]; zooms: ZoomPipeline[] };
export const CenaPipeline: React.FC<PropsPipeline> = ({ quadros, zooms }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pos = (f / durationInFrames) * (quadros.length - 1);
  const i = Math.min(quadros.length - 1, Math.floor(pos));
  const frac = pos - i;
  // câmera: interpola entre os retângulos de zoom (x, y, largura, altura em px do quadro 1920×1080)
  const t = f / durationInFrames;
  let a = zooms[0], b = zooms[0];
  for (let k = 0; k < zooms.length; k++) { if (zooms[k].aos <= t) { a = zooms[k]; b = zooms[k + 1] ?? zooms[k]; } }
  const trans = b === a ? 1 : interpolate(t, [b.aos - 0.035, b.aos], [0, 1], { ...clamp, easing: VAIVEM });
  const r = a.rect.map((v, k) => v + (b.rect[k] - v) * trans) as [number, number, number, number];
  const esc = 1920 / r[2];
  const rotulo = trans > 0.5 ? b.rotulo : a.rotulo;
  const e = entrada(f, 0, 14);
  return (
    <AbsoluteFill style={{ background: "#0A1412", opacity: e }}>
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: `scale(${esc}) translate(${-r[0]}px, ${-r[1]}px)` }}>
        <Img src={quadros[i]} style={{ position: "absolute", width: 1920, height: 1080 }} />
        {i + 1 < quadros.length && <Img src={quadros[i + 1]} style={{ position: "absolute", width: 1920, height: 1080, opacity: interpolate(frac, [0.82, 1], [0, 1], clamp) }} />}
      </AbsoluteFill>
      {rotulo && (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: 60 }}>
          <Pill tamanho={26} entra={1}>{rotulo}</Pill>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ números
export type PropsNumeros = { pill?: string; itens: { valor: number; prefixo?: string; sufixo?: string; rotulo: string; cor?: string; decimais?: number }[]; rodape?: string };
export const CenaNumeros: React.FC<PropsNumeros> = ({ pill, itens, rodape }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = itens.length <= 3 ? itens.length : 2;
  return (
    <AbsoluteFill>
      <Fundo />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 46, paddingBottom: 60 }}>
        {pill && <Pill entra={entrada(f)}>{pill}</Pill>}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 28, width: cols === 2 ? 1300 : 1600 }}>
          {itens.map((it, i) => {
            const s = spring({ frame: f - 8 - i * 6, fps, config: { damping: 200 } });
            const v = it.valor * Math.min(1, interpolate(f, [8 + i * 6, 44 + i * 6], [0, 1], { ...clamp, easing: SUAVE }));
            const txt = (it.prefixo ?? "") + v.toLocaleString("pt-BR", { minimumFractionDigits: it.decimais ?? 0, maximumFractionDigits: it.decimais ?? 0 }) + (it.sufixo ?? "");
            return (
              <div key={i} style={{
                borderRadius: 26, background: COR.painel, border: `1px solid ${COR.borda}`, padding: "34px 40px",
                opacity: s, translate: `0px ${(1 - s) * 40}px`, display: "flex", flexDirection: "column", gap: 10,
              }}>
                <span style={{ fontFamily: FONTE.mono, fontWeight: 500, fontSize: 120, lineHeight: 1, color: it.cor ?? COR.txt, letterSpacing: "-0.04em" }}>{txt}</span>
                <span style={{ fontFamily: FONTE.ui, fontSize: 32, color: COR.mut }}>{it.rotulo}</span>
              </div>
            );
          })}
        </div>
        {rodape && <div style={{ fontFamily: FONTE.ui, fontSize: 34, color: COR.mut, opacity: entrada(f, 40) }}>{rodape}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ celular com o Reels
export const CenaReels: React.FC<{ pill: string; titulo: string[]; video: string }> = ({ pill, titulo, video }) => {
  const f = useCurrentFrame();
  const e = entrada(f, 4, 22);
  return (
    <AbsoluteFill>
      <Fundo />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 160px 40px 160px", gap: 120 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 34 }}>
          <div style={{ display: "flex" }}><Pill entra={entrada(f, 2)}>{pill}</Pill></div>
          <Titulo linhas={titulo.map((t) => ({ t }))} tamanho={72} />
        </div>
        <div style={{ width: 420, height: 860, borderRadius: 56, background: "#111", padding: 14, boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 2px #262b2a", opacity: e, translate: `0px ${(1 - e) * 80}px` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", background: "#000" }}>
            <OffthreadVideo src={staticFile(video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ vinheta de abertura e assinatura
export const CenaAbertura: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <Fundo brilho={1.4} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 36 }}>
        <div style={{ scale: String(0.8 + 0.2 * s), opacity: s }}><Marca tamanho={120} /></div>
        <Pill entra={entrada(f, 22)}>Plataforma de jornalismo com IA</Pill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CenaPergunta: React.FC<{ linhas: string[] }> = ({ linhas }) => (
  <AbsoluteFill>
    <Fundo brilho={0.6} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 200px" }}>
      <Titulo linhas={linhas.map((t, i) => ({ t, apagada: i < linhas.length - 1 }))} tamanho={92} alinhar="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);

export const CenaAssinatura: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Fundo brilho={1.3} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40 }}>
        <div style={{ opacity: entrada(f), scale: String(0.9 + 0.1 * entrada(f)) }}><Marca tamanho={130} /></div>
        <div style={{ fontFamily: FONTE.ui, fontWeight: 500, fontSize: 52, color: COR.mut, opacity: entrada(f, 14), letterSpacing: "-0.02em" }}>
          O portal com sotaque de todas as regiões.
        </div>
        <div style={{ marginTop: 10, padding: "16px 34px", borderRadius: 999, background: COR.agua, color: "#04201B", fontFamily: FONTE.mono, fontWeight: 700, fontSize: 34, opacity: entrada(f, 26) }}>
          vozesparanaenses.com.br
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
