import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BALAO_D, COR, FONTE, PONTO, V_PONTOS, textoSobre } from "./marca";
import type { Palavra } from "./tipos";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const SAIDA = Easing.bezier(0.16, 1, 0.3, 1);

/** Chapéu-balão (assinatura A): pílula com rabicho, entra com mola. */
export const ChapeuBalao: React.FC<{ texto: string; cor: string; aos: number; tamanho?: number }> = ({ texto, cor, aos, tamanho = 40 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - aos * fps, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const tinta = textoSobre(cor);
  return (
    <div
      style={{
        position: "relative",
        alignSelf: "flex-start",
        scale: String(s),
        transformOrigin: "10% 100%",
        opacity: s > 0.01 ? 1 : 0,
      }}
    >
      <div
        style={{
          background: cor,
          color: tinta,
          borderRadius: tamanho * 0.62,
          padding: `${tamanho * 0.36}px ${tamanho * 0.7}px ${tamanho * 0.34}px ${tamanho * 0.6}px`,
          fontFamily: FONTE.chapeu,
          fontWeight: 700,
          fontSize: tamanho,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {texto}
      </div>
      <svg width={tamanho * 1.0} height={tamanho * 0.7} viewBox="0 0 36 24.5" style={{ position: "absolute", left: tamanho * 0.8, bottom: -tamanho * 0.62 }}>
        <path d="M0 0H36L7 24.5A3.2 3.2 0 0 1 1.6 21.6Z" fill={cor} />
      </svg>
    </div>
  );
};

/**
 * Quando cada palavra do título aparece: espalha as palavras pelo trecho em
 * que a narração fala (proporcional ao tamanho da palavra), para o lettering
 * andar junto com a voz. Sem narração, entra num ritmo fixo a partir de `aos`.
 */
export function agendaDasPalavras(palavrasTitulo: string[], fala: Palavra[], aos: number, fim?: number): number[] {
  const t0 = fala.length ? Math.max(aos, fala[0].t) : aos;
  const t1 = fala.length ? Math.max(t0 + 0.6, (fim ?? fala[fala.length - 1].fim) * 0.92) : aos + palavrasTitulo.length * 0.18;
  const pesos = palavrasTitulo.map((p) => Math.max(2, p.length));
  const total = pesos.reduce((a, b) => a + b, 0);
  let acum = 0;
  return pesos.map((w) => {
    const t = t0 + (acum / total) * (t1 - t0);
    acum += w;
    return t;
  });
}

const RE_NUMERO = /\d/;

/**
 * Título com lettering sincronizado: cada palavra sobe de trás de uma máscara
 * com leve desfoque; números ganham marca-texto laranja; o ponto laranja
 * fecha o título com um quique (a assinatura do Vozes).
 */
export const TituloSincronizado: React.FC<{
  texto: string;
  fala: Palavra[];
  aos: number;
  tamanho: number;
  cor?: string;
  pontoCor?: string;
  maxLargura?: number;
  ate?: number;
}> = ({ texto, fala, aos, tamanho, cor = COR.branco, pontoCor = COR.laranja, maxLargura = 940, ate }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palavras = texto.replace(/[.!]+$/, "").split(/\s+/).filter(Boolean);
  const agenda = agendaDasPalavras(palavras, fala, aos, ate);
  const fimPonto = (agenda[agenda.length - 1] ?? aos) + 0.28;
  const sp = spring({ frame: f - fimPonto * fps, fps, config: { damping: 7, stiffness: 220, mass: 0.5 } });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        maxWidth: maxLargura,
        fontFamily: FONTE.titulo,
        fontWeight: 700,
        fontSize: tamanho,
        lineHeight: 1.08,
        letterSpacing: "-0.012em",
        color: cor,
      }}
    >
      {palavras.map((p, i) => {
        const t = agenda[i] * fps;
        const k = interpolate(f, [t, t + 9], [0, 1], { ...clamp, easing: SAIDA });
        const ultimo = i === palavras.length - 1;
        const numero = RE_NUMERO.test(p);
        const marca = numero ? interpolate(f, [t + 4, t + 14], [0, 1], { ...clamp, easing: SAIDA }) : 0;
        return (
          <span key={i} style={{ display: "inline-flex", overflow: "hidden", paddingBottom: tamanho * 0.12, marginBottom: -tamanho * 0.12, marginRight: ultimo ? 0 : "0.24em" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                translate: `0px ${(1 - k) * tamanho * 1.05}px`,
                filter: `blur(${(1 - k) * 8}px)`,
                opacity: k,
                position: "relative",
              }}
            >
              {numero && (
                <span
                  style={{
                    position: "absolute",
                    left: -tamanho * 0.08,
                    right: -tamanho * 0.08,
                    top: tamanho * 0.22,
                    bottom: tamanho * 0.02,
                    background: pontoCor,
                    borderRadius: tamanho * 0.08,
                    transformOrigin: "0% 50%",
                    scale: `${marca} 1`,
                    zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, color: numero && marca > 0.5 ? COR.tinta : cor }}>{p}</span>
              {ultimo && (
                <span
                  style={{
                    width: tamanho * 0.19,
                    height: tamanho * 0.19,
                    borderRadius: "50%",
                    background: pontoCor,
                    marginLeft: tamanho * 0.06,
                    alignSelf: "flex-end",
                    marginBottom: tamanho * 0.2,
                    scale: String(sp),
                    translate: `0px ${(1 - Math.min(1, sp)) * -tamanho * 1.2}px`,
                  }}
                />
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Número que sobe até o valor (aceita "13,7 mi", "201,4", "1.000", "R$ 1 mi"). */
export const Contador: React.FC<{ valor: string; aos: number; dur?: number; tamanho: number; cor?: string }> = ({ valor, aos, dur = 1.1, tamanho, cor = COR.branco }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = valor.match(/^(\D*?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?(.*)$/);
  const k = interpolate(f, [aos * fps, (aos + dur) * fps], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  let texto = valor;
  if (m) {
    const inteiro = Number(m[2].replace(/\./g, ""));
    const casas = m[3]?.length ?? 0;
    const alvo = inteiro + (casas ? Number(`0.${m[3]}`) : 0);
    const atual = alvo * k;
    const fmt = atual.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    texto = `${m[1]}${fmt}${m[4]}`;
  }
  const pulso = spring({ frame: f - (aos + dur) * fps, fps, config: { damping: 9, stiffness: 260 } });
  return (
    <div
      style={{
        fontFamily: FONTE.titulo,
        fontWeight: 800,
        fontSize: tamanho,
        lineHeight: 0.9,
        letterSpacing: "-0.03em",
        color: cor,
        fontVariantNumeric: "tabular-nums",
        opacity: interpolate(f, [aos * fps - 2, aos * fps + 4], [0, 1], clamp),
        scale: String(1 + 0.06 * Math.sin(Math.min(1, pulso) * Math.PI)),
        transformOrigin: "0% 80%",
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </div>
  );
};

/** Linha fina: entra em bloco, depois da manchete. */
export const LinhaFina: React.FC<{ texto: string; aos: number; cor?: string; tamanho?: number }> = ({ texto, aos, cor = "rgba(255,255,255,0.86)", tamanho = 40 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(f, [aos * fps, aos * fps + 12], [0, 1], { ...clamp, easing: SAIDA });
  return (
    <div
      style={{
        fontFamily: FONTE.titulo,
        fontWeight: 400,
        fontSize: tamanho,
        lineHeight: 1.32,
        color: cor,
        maxWidth: 900,
        opacity: k,
        translate: `0px ${(1 - k) * 24}px`,
        borderLeft: `6px solid ${COR.laranja}`,
        paddingLeft: 26,
      }}
    >
      {texto}
    </div>
  );
};

/** Grão de filme leve (dá textura de telejornal às telas lisas). */
export const Grao: React.FC<{ forca?: number }> = ({ forca = 0.06 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: forca }}>
      <svg width="100%" height="100%">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Ícone da marca animável: balão, V desenhado e o ponto laranja. */
export const IconeMarca: React.FC<{
  tamanho: number;
  balao?: number; // 0..1 escala do balão
  v?: number; // 0..1 desenho do V
  ponto?: number; // 0..1 entrada do ponto
  quedaPonto?: number; // deslocamento vertical do ponto (px no viewBox)
  corBalao?: string;
  corV?: string;
}> = ({ tamanho, balao = 1, v = 1, ponto = 1, quedaPonto = 0, corBalao = COR.verdeClaro, corV = COR.tinta }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 256 256" style={{ overflow: "visible" }}>
    <g style={{ transformOrigin: "124px 120px", scale: String(balao) }}>
      <path d={BALAO_D} fill={corBalao} />
      <polyline
        points={V_PONTOS}
        fill="none"
        stroke={corV}
        strokeWidth={30}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - v}
      />
    </g>
    <circle cx={PONTO.cx} cy={PONTO.cy + quedaPonto} r={PONTO.r * ponto} fill={COR.laranja} />
  </svg>
);

/** Selo fixo no alto: marca + "RESUMO DO DIA" + barra segmentada de progresso. */
export const BarraProgresso: React.FC<{ segmentos: Array<{ ini: number; fim: number; cor: string }>; total: number }> = ({ segmentos }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  return (
    <div style={{ position: "absolute", top: 70, left: 56, right: 56, display: "flex", gap: 10 }}>
      {segmentos.map((s, i) => {
        const p = interpolate(t, [s.ini, s.fim], [0, 1], clamp);
        return (
          <div key={i} style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ width: `${p * 100}%`, height: "100%", background: p > 0 && p < 1 ? COR.laranja : COR.branco }} />
          </div>
        );
      })}
    </div>
  );
};

export const SeloTopo: React.FC<{ cor?: string }> = ({ cor = COR.branco }) => (
  <div style={{ position: "absolute", top: 104, left: 56, display: "flex", alignItems: "center", gap: 16 }}>
    <IconeMarca tamanho={58} />
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
      <span style={{ fontFamily: FONTE.marca, fontWeight: 700, fontSize: 30, color: cor }}>vozes</span>
      <span style={{ fontFamily: FONTE.chapeu, fontWeight: 700, fontSize: 21, letterSpacing: "0.16em", color: COR.laranja, textTransform: "uppercase", marginTop: 4 }}>
        Resumo do dia
      </span>
    </div>
  </div>
);

/** Faixas de glitch (usadas na transição e em toques de efeito). */
export function faixasGlitch(seed: number, n = 7) {
  return Array.from({ length: n }, (_, i) => ({
    top: random(`t${seed}-${i}`) * 100,
    altura: 1.5 + random(`h${seed}-${i}`) * 7,
    desloca: (random(`d${seed}-${i}`) - 0.5) * 160,
  }));
}
