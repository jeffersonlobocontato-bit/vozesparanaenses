// Recorte da marca em foto de PREFEITURA (regra de 29/10/2026): foto de
// prefeitura publica sempre; se tiver logomarca/marca d'água/texto num canto,
// tenta recortar a foto para tirar a marca. Se o recorte deixaria a foto
// pequena demais ou desproporcional, publica como está.
//
// As caixas vêm da IA de visão (`analisarMarcas` em analista-imagem.ts), em
// frações da imagem (0–1). `calcularRecorte` é puro (testado em regras_test).

export type Caixa = { x: number; y: number; w: number; h: number };

const MARGEM = 0.015; // folga em volta da marca
const AREA_MINIMA = 0.5; // o recorte precisa manter ao menos metade da foto
const PROPORCAO = [0.75, 2.4]; // largura/altura aceitável para capa

function area(r: Caixa) { return Math.max(0, r.w) * Math.max(0, r.h); }
function cruza(a: Caixa, b: Caixa) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Maior retângulo que exclui todas as marcas (corte guloso por lado: acima,
 * abaixo, à esquerda ou à direita de cada marca). `largura`/`altura` em px
 * para checar a proporção. null = não dá para recortar bem.
 */
export function calcularRecorte(marcas: Caixa[], largura: number, altura: number): Caixa | null {
  let r: Caixa = { x: 0, y: 0, w: 1, h: 1 };
  const ms = marcas
    .map((m) => ({ x: m.x - MARGEM, y: m.y - MARGEM, w: m.w + 2 * MARGEM, h: m.h + 2 * MARGEM }))
    .sort((a, b) => area(b) - area(a));
  for (const m of ms) {
    if (!cruza(r, m)) continue;
    const opcoes: Caixa[] = [
      { x: r.x, y: r.y, w: r.w, h: m.y - r.y }, // fica acima da marca
      { x: r.x, y: m.y + m.h, w: r.w, h: r.y + r.h - (m.y + m.h) }, // abaixo
      { x: r.x, y: r.y, w: m.x - r.x, h: r.h }, // à esquerda
      { x: m.x + m.w, y: r.y, w: r.x + r.w - (m.x + m.w), h: r.h }, // à direita
    ].filter((o) => o.w > 0 && o.h > 0);
    if (!opcoes.length) return null;
    r = opcoes.sort((a, b) => area(b) - area(a))[0];
  }
  if (ms.some((m) => cruza(r, m))) return null;
  if (area(r) < AREA_MINIMA) return null;
  const prop = (r.w * largura) / (r.h * altura);
  if (prop < PROPORCAO[0] || prop > PROPORCAO[1]) return null;
  return r;
}

/**
 * Recorta a imagem (PNG/JPEG) e devolve JPEG. null se o formato não for
 * suportado (ex.: WebP) ou o recorte não couber — aí a foto vai como está.
 */
export async function recortarImagem(bytes: Uint8Array, marcas: Caixa[]): Promise<Uint8Array | null> {
  try {
    const { decode, Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const img = await decode(bytes);
    if (!(img instanceof Image)) return null; // GIF animado etc.
    const r = calcularRecorte(marcas, img.width, img.height);
    if (!r) return null;
    const px = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v * max)));
    const x = px(r.x, img.width), y = px(r.y, img.height);
    const w = Math.min(img.width - x, px(r.w, img.width)), h = Math.min(img.height - y, px(r.h, img.height));
    if (w < 400 || h < 260) return null;
    img.crop(x, y, w, h);
    return await img.encodeJPEG(88);
  } catch {
    return null;
  }
}
