// Vozes Paranaenses — renderização dos cards no servidor (Deno).
// Satori (árvore → SVG) + resvg (SVG → PNG). Fontes do @fontsource e o
// wasm do resvg vêm do jsDelivr, com versão fixa, e ficam em memória entre
// chamadas da mesma instância.

import satori from "npm:satori@0.10.14";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import decodeWebp, { init as initWebp } from "npm:@jsquash/webp@1.4.0/decode.js";
import encodeJpeg, { init as initJpeg } from "npm:@jsquash/jpeg@1.5.0/encode.js";
import { ALTURA, arvoreDoCard, FONTES, LARGURA, type Card } from "./instagram-cards.ts";

const CDN = "https://cdn.jsdelivr.net/npm";
const VERSAO_FONTES = "5.3.0";

let pronto: Promise<Array<{ name: string; weight: number; style: string; data: ArrayBuffer }>> | null = null;

async function preparar() {
  if (!pronto) {
    pronto = (async () => {
      const wasm = await fetch(`${CDN}/@resvg/resvg-wasm@2.6.2/index_bg.wasm`);
      if (!wasm.ok) throw new Error(`resvg wasm ${wasm.status}`);
      await initWasm(wasm);
      return await Promise.all(FONTES.map(async (f) => {
        const [pacote, ...resto] = f.arquivo.split("/");
        const res = await fetch(`${CDN}/@fontsource/${pacote}@${VERSAO_FONTES}/${resto.join("/")}`);
        if (!res.ok) throw new Error(`fonte ${f.arquivo} ${res.status}`);
        return { name: f.name, weight: f.weight, style: f.style, data: await res.arrayBuffer() };
      }));
    })().catch((e) => { pronto = null; throw e; });
  }
  return pronto;
}

// O Satori não lê WebP (muitas capas do portal são .webp): converte para JPEG.
let codecs: Promise<void> | null = null;
function prepararCodecs() {
  if (!codecs) {
    codecs = (async () => {
      const [a, b] = await Promise.all([
        fetch(`${CDN}/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm`).then((r) => r.arrayBuffer()),
        fetch(`${CDN}/@jsquash/jpeg@1.5.0/codec/enc/mozjpeg_enc.wasm`).then((r) => r.arrayBuffer()),
      ]);
      await initWebp(await WebAssembly.compile(a));
      await initJpeg(await WebAssembly.compile(b));
    })().catch((e) => { codecs = null; throw e; });
  }
  return codecs;
}

async function webpParaJpeg(buf: Uint8Array): Promise<Uint8Array> {
  await prepararCodecs();
  const img = await decodeWebp(buf.slice().buffer as ArrayBuffer);
  return new Uint8Array(await encodeJpeg(img, { quality: 85 }));
}

/** Baixa uma imagem e devolve data URI (o Satori não busca rede sozinho de forma confiável). */
export async function imagemComoDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "VozesParanaensesBot/1.0" } });
    if (!res.ok) return null;
    let tipo = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    let buf: Uint8Array = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    // Pelo conteúdo (o content-type de storage nem sempre é confiável).
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) tipo = "image/webp";
    else if (buf[0] === 0xff && buf[1] === 0xd8) tipo = "image/jpeg";
    else if (buf[0] === 0x89 && buf[1] === 0x50) tipo = "image/png";
    if (tipo === "image/webp") { buf = await webpParaJpeg(buf); tipo = "image/jpeg"; }
    if (!/^image\/(jpeg|png|gif)$/.test(tipo)) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    return `data:${tipo};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/** Card → PNG 1080×1440. */
export async function renderizarCard(card: Card): Promise<Uint8Array> {
  const fonts = await preparar();
  // deno-lint-ignore no-explicit-any
  const svg = await satori(arvoreDoCard(card) as any, { width: LARGURA, height: ALTURA, fonts: fonts as any });
  return new Resvg(svg, { fitTo: { mode: "width", value: LARGURA } }).render().asPng();
}
