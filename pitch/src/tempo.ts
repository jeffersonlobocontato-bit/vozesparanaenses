// Âncoras de fala → segundos. As legendas (faster-whisper) dão o tempo de cada
// palavra; cada cena começa na primeira palavra da frase-âncora.
export type Palavra = { w: string; s: number; e: number };

const norm = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").trim();

export function resolverAncoras(palavras: Palavra[], ancoras: string[], duracao: number): number[] {
  const ws = palavras.map((p) => ({ ...p, n: norm(p.w) })).filter((p) => p.n);
  const out: number[] = [];
  let cursor = 0;
  let ultimo = 0;
  for (const a of ancoras) {
    const alvo = norm(a).split(/\s+/).slice(0, 4);
    let achou = -1;
    for (let i = cursor; i < ws.length; i++) {
      let acertos = 0;
      for (let k = 0; k < alvo.length && i + k < ws.length; k++) if (ws[i + k].n === alvo[k]) acertos++;
      if (acertos >= Math.min(alvo.length, 3) || (alvo.length <= 2 && acertos === alvo.length)) { achou = i; break; }
    }
    if (achou >= 0) {
      ultimo = ws[achou].s;
      cursor = achou + 1;
    } else {
      ultimo = Math.min(duracao - 1, ultimo + 3);
    }
    out.push(ultimo);
  }
  return out;
}

/** Linhas de legenda: até ~46 caracteres, quebrando em pausa ou pontuação. */
export function linhasDeLegenda(palavras: Palavra[]): { texto: string; s: number; e: number }[] {
  const out: { texto: string; s: number; e: number }[] = [];
  let atual: Palavra[] = [];
  const fecha = () => {
    if (!atual.length) return;
    out.push({ texto: atual.map((p) => p.w).join(" "), s: atual[0].s, e: atual[atual.length - 1].e });
    atual = [];
  };
  for (const p of palavras) {
    const len = atual.map((x) => x.w).join(" ").length;
    const pausa = atual.length ? p.s - atual[atual.length - 1].e : 0;
    if (atual.length && (len + p.w.length > 46 || pausa > 0.45)) fecha();
    atual.push(p);
    if (/[.?!:]$/.test(p.w)) fecha();
  }
  fecha();
  return out;
}
