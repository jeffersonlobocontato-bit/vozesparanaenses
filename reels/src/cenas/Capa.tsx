import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { COR, FONTE } from "../marca";
import { Grao, IconeMarca, MapaParana } from "../pecas";
import type { CenaNoticia, Roteiro } from "../tipos";

/**
 * Capa (thumb) do Reels "Resumo do dia": 1080×1920, com o miolo pensado para
 * o recorte 3:4 da grade do perfil (faixa de 240 a 1680 px). Verde do Vozes,
 * Paraná em marca d'água, colagem com as fotos do dia, "Resumo do dia" com o
 * ponto laranja e as manchetes numeradas.
 */
export const Capa: React.FC<Roteiro> = (r) => {
  const noticias = r.cenas.filter((c): c is CenaNoticia => c.tipo === "noticia");
  const comImagem = noticias.filter((c) => c.foto || c.video).slice(0, 3);
  const abertura = r.cenas.find((c) => c.tipo === "abertura") as { data?: string } | undefined;
  const giros = [-7, 5, -2];
  const posicoes = [
    { left: 70, top: 300 },
    { left: 560, top: 270 },
    { left: 300, top: 470 },
  ];
  // Manchete curta: até ~52 caracteres, cortando em palavra e sem terminar em preposição.
  const curta = (t: string) => {
    if (t.length <= 56) return t;
    const out: string[] = [];
    for (const w of t.split(/\s+/)) {
      if ([...out, w].join(" ").length > 52) break;
      out.push(w);
    }
    while (out.length > 3 && /^(a|o|as|os|da|de|do|das|dos|e|em|no|na|nos|nas|com|para|por|ao|à|é|um|uma)$/i.test(out[out.length - 1])) out.pop();
    return `${out.join(" ")}…`;
  };
  const manchetes = noticias.slice(0, 3).map((c) => curta(c.titulo));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(95% 65% at 50% 48%, ${COR.verde} 0%, #173F33 48%, ${COR.tinta} 100%)`, overflow: "hidden" }}>
      <AbsoluteFill style={{ display: "grid", placeItems: "center" }}>
        <div style={{ translate: "40px -60px" }}>
          <MapaParana largura={1300} traco={1} preenche={0.7} pontos={1} opacidade={0.28} />
        </div>
      </AbsoluteFill>

      {/* marca no alto */}
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
        <IconeMarca tamanho={64} />
        <span style={{ fontFamily: FONTE.marca, fontWeight: 700, fontSize: 40, color: COR.branco }}>
          vozes <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 30 }}>paranaenses</span>
        </span>
      </div>

      {/* colagem das fotos do dia */}
      {comImagem.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...posicoes[i],
            width: 450,
            height: 450,
            background: COR.branco,
            padding: 14,
            rotate: `${giros[i]}deg`,
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
            zIndex: i === 2 ? 3 : 1,
          }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: COR.tinta }}>
            {c.video ? (
              <OffthreadVideo src={staticFile(c.video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Img src={staticFile(c.foto as string)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                background: c.cor,
                color: COR.tinta,
                fontFamily: FONTE.chapeu,
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "8px 14px 7px",
                borderRadius: 14,
              }}
            >
              {c.chapeu.split("·")[0].trim()}
            </div>
          </div>
        </div>
      ))}

      {/* título */}
      <div style={{ position: "absolute", left: 70, right: 70, top: comImagem.length ? 960 : 640 }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <span style={{ fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 210, lineHeight: 0.86, letterSpacing: "-0.04em", color: COR.branco }}>Resumo</span>
          <span style={{ width: 52, height: 52, borderRadius: "50%", background: COR.laranja, marginLeft: 14, marginBottom: 20 }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 4 }}>
          <span style={{ fontFamily: FONTE.chapeu, fontWeight: 800, fontSize: 150, lineHeight: 1, color: COR.laranja, textTransform: "uppercase", letterSpacing: "0.04em" }}>do dia</span>
          <span style={{ fontFamily: FONTE.ui, fontWeight: 600, fontSize: 40, color: "rgba(255,255,255,0.85)" }}>{abertura?.data ?? ""}</span>
        </div>
        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 16 }}>
          {manchetes.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
              <span style={{ fontFamily: FONTE.titulo, fontWeight: 800, fontSize: 44, color: COR.laranja, width: 36 }}>{i + 1}</span>
              <span style={{ fontFamily: FONTE.titulo, fontWeight: 600, fontSize: 38, lineHeight: 1.15, color: COR.branco }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
      <Grao forca={0.06} />
    </AbsoluteFill>
  );
};
