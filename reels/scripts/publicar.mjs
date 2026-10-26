#!/usr/bin/env node
// Publica o Reels renderizado (out/resumo.mp4) no @vozesparanaenses pelo Zernio.
// Só roda com ZERNIO_API_KEY e confere a conta (id + usuário) antes de postar.
//
//   ZERNIO_API_KEY=... node scripts/publicar.mjs

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const API = "https://zernio.com/api/v1";
const CHAVE = process.env.ZERNIO_API_KEY;
const CONTA = process.env.ZERNIO_ACCOUNT_ID ?? "6ade0b01088cda11c4be1fd4";
const USUARIO = "vozesparanaenses";
const VIDEO = path.join(AQUI, "..", "out", "resumo.mp4");

async function api(caminho, init = {}) {
  const r = await fetch(`${API}${caminho}`, { ...init, headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : {};
}

async function main() {
  if (!CHAVE) throw new Error("Falta ZERNIO_API_KEY.");
  const roteiro = JSON.parse(await readFile(path.join(AQUI, "..", "public", "roteiro.json"), "utf8"));

  const { accounts = [] } = await api("/accounts");
  const conta = accounts.find((a) => a._id === CONTA);
  if (!conta || conta.platform !== "instagram" || String(conta.username).replace(/^@/, "").toLowerCase() !== USUARIO) {
    throw new Error(`Conta do Zernio não confere com @${USUARIO}. Nada foi publicado.`);
  }

  const tam = (await stat(VIDEO)).size;
  const pre = await api("/media/presign", { method: "POST", body: JSON.stringify({ filename: `resumo-${roteiro.data}.mp4`, contentType: "video/mp4", size: tam }) });
  const up = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: await readFile(VIDEO) });
  if (!up.ok) throw new Error(`upload: ${up.status}`);

  // Capa (thumb) do Reels: out/capa.jpg, renderizada pela composição CapaResumo
  let capa = null;
  try {
    const img = await readFile(path.join(AQUI, "..", "out", "capa.jpg"));
    const pc = await api("/media/presign", { method: "POST", body: JSON.stringify({ filename: `resumo-${roteiro.data}-capa.jpg`, contentType: "image/jpeg", size: img.length }) });
    const upc = await fetch(pc.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: img });
    if (upc.ok) capa = pc.publicUrl;
  } catch { /* sem capa: o Instagram usa o quadro do thumbOffset */ }

  const noticias = roteiro.cenas.filter((c) => c.tipo === "noticia");
  const [a, m, d] = roteiro.data.split("-");
  const legenda = [
    `Resumo do dia · ${d}/${m}/${a}`,
    noticias.map((c, i) => `${i + 1}. ${c.titulo}`).join("\n"),
    "Siga @vozesparanaenses e acompanhe as notícias do Paraná todo dia. As matérias completas estão no link da bio.",
    "#VozesParanaenses #Parana #ResumoDoDia #Noticias",
  ].join("\n\n");

  const post = await api("/posts", {
    method: "POST",
    headers: { "Idempotency-Key": `vozes-reels-${roteiro.data}` },
    body: JSON.stringify({
      content: legenda,
      mediaItems: [{ url: pre.publicUrl, type: "video" }],
      platforms: [{ platform: "instagram", accountId: CONTA, platformSpecificData: { ...(capa ? { instagramThumbnail: capa } : { thumbOffset: 1800 }), audioName: "Resumo do dia · Vozes Paranaenses" } }],
      publishNow: true,
    }),
  });
  console.log("publicado:", post?.post?._id ?? post?._id ?? JSON.stringify(post).slice(0, 200));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
