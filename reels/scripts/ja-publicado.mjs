#!/usr/bin/env node
// Diz se o Reels "Resumo do dia" de hoje já saiu no @vozesparanaenses.
// A agenda do GitHub tem vários horários de reserva (ela às vezes não dispara);
// cada um roda isto antes e só segue se o Reels do dia ainda não foi postado.
//
//   node scripts/ja-publicado.mjs [AAAA-MM-DD]   → escreve feito=sim|nao em $GITHUB_OUTPUT

import { appendFile } from "node:fs/promises";

const CHAVE = process.env.ZERNIO_API_KEY;
const diaSP = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const dia = process.argv[2] || diaSP(new Date());
const [a, m, d] = dia.split("-");
const marca = `Resumo do dia · ${d}/${m}/${a}`;

async function main() {
  let feito = false;
  if (CHAVE) {
    try {
      const r = await fetch("https://zernio.com/api/v1/posts?limit=40", { headers: { Authorization: `Bearer ${CHAVE}` } });
      if (r.ok) feito = (await r.text()).includes(marca);
      else console.log(`Zernio respondeu ${r.status}; segue como não publicado.`);
    } catch (e) {
      console.log(`Zernio indisponível (${e.message}); segue como não publicado.`);
    }
  }
  console.log(feito ? `Já publicado: "${marca}". Nada a fazer.` : `Ainda não publicado: "${marca}".`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `feito=${feito ? "sim" : "nao"}\n`);
}

main();
