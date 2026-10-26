#!/usr/bin/env node
// Monta o roteiro do Reels "Resumo do dia" a partir dos posts do Instagram
// publicados no dia (tabela instagram_posts, leitura pública) e das matérias.
//
//   node scripts/montar.mjs [AAAA-MM-DD]
//
// Escreve public/roteiro.json (sem tempos de voz: scripts/voz.py completa) e
// baixa as fotos para public/fotos/. Só usa foto real com crédito (nunca a
// ilustração de IA) e nunca política/eleição (o robô já não posta).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(AQUI, "..", "public");
// Chave pública (publishable) do banco do portal: só lê o que já é público.
const SUPABASE = process.env.VOZES_SUPABASE_URL ?? "https://flcgtpzfnsrxawvyzzgh.supabase.co";
const CHAVE = process.env.VOZES_SUPABASE_KEY ?? "sb_publishable_fMVraOMiN5QsfLcdVmjLTA_VfukX2cx";
const MAX_NOTICIAS = Number(process.env.REELS_MAX_NOTICIAS ?? 6);

const diaSP = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const hoje = process.argv[2] ?? diaSP(new Date());

async function rest(caminho) {
  const r = await fetch(`${SUPABASE}/rest/v1/${caminho}`, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
  return r.json();
}

const ESCOPO = { cidade: "#F0B07A", regiao: "#6FBF98", parana: "#7AB8F0", brasil: "#C9D4CE", mundo: "#C3B2EC" };
const NOME_REGIAO = {
  metropolitana: "Metropolitana", litoral: "Litoral", "campos-gerais": "Campos Gerais", "norte-pioneiro": "Norte Pioneiro",
  "norte-central": "Norte", noroeste: "Noroeste", "centro-ocidental": "Centro-Ocidental", oeste: "Oeste", sudoeste: "Sudoeste", "centro-sul": "Centro-Sul",
};
const RE_NUM = /(R\$\s?)?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?:\s?(?:mil|milhões|milhão|mi|bi|%))?/i;

const dataExtenso = (() => {
  const d = new Date(`${hoje}T12:00:00-03:00`);
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
})();

/** Texto falado: unidades por extenso (a voz lê melhor). */
function falado(t) {
  return t
    .replace(/km\/h/gi, "quilômetros por hora")
    .replace(/(\d)\s?mm\b/gi, "$1 milímetros")
    .replace(/R\$\s?(\d+(?:,\d+)?)\s?mi\b/gi, "$1 milhão de reais")
    .replace(/(\d)\s?mi\b/gi, "$1 milhões")
    .replace(/\bBR-(\d+)/g, "BR $1")
    .replace(/\bPR-(\d+)/g, "PR $1")
    .replace(/\s+/g, " ")
    .trim();
}

function semPonto(t) {
  return (t ?? "").replace(/\s+/g, " ").replace(/[.!]+$/, "").trim();
}

async function baixarFoto(url, nome) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { "user-agent": "VozesParanaensesReels/1.0" } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) return null;
    const bruto = path.join(PUBLIC, "fotos", `${nome}.orig`);
    const saida = path.join(PUBLIC, "fotos", `${nome}.jpg`);
    await writeFile(bruto, buf);
    // converte qualquer formato (webp, png) para JPEG de até 1600 px
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", bruto, "-vf", "scale='min(1600,iw)':-2", "-q:v", "3", saida]);
    return `fotos/${nome}.jpg`;
  } catch {
    return null;
  }
}

function chapeuDe(a) {
  const reg = a.regiao?.slug ?? "";
  const editoria = a.categoria?.nome ?? null;
  if (reg === "internacional" || a.categoria?.slug === "internacional") return { texto: ["Mundo", editoria !== "Internacional" ? editoria : null].filter(Boolean).join(" · "), cor: ESCOPO.mundo };
  if (a.cidade_principal) return { texto: `${a.cidade_principal} · ${NOME_REGIAO[reg] ?? editoria ?? "Paraná"}`, cor: ESCOPO.cidade };
  if (reg === "nacional") return { texto: ["Brasil", editoria].filter(Boolean).join(" · "), cor: ESCOPO.brasil };
  if (NOME_REGIAO[reg] && !/\bno paran[aá]\b/i.test(a.titulo)) return { texto: `${NOME_REGIAO[reg]} · ${editoria ?? "Paraná"}`, cor: ESCOPO.regiao };
  return { texto: ["Paraná", editoria].filter(Boolean).join(" · "), cor: ESCOPO.parana };
}

const FOTO_OK = new Set(["fonte_autorizada", "commons_analista", "agencia_publica", "curadoria", "manual"]);

async function main() {
  const ini = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  // REELS_ATE=HH:MM limita aos posts publicados até essa hora (refazer um dia já aprovado)
  const fim = new Date(`${hoje}T${process.env.REELS_ATE ? `${process.env.REELS_ATE}:00` : "23:59:59"}-03:00`).toISOString();
  const posts = await rest(
    `instagram_posts?select=id,tipo,classe,score,card,artigos,publicado_em&status=eq.publicado&publicado_em=gte.${ini}&publicado_em=lte.${fim}&order=publicado_em.asc`,
  );
  if (!posts.length) throw new Error(`Nenhum post publicado em ${hoje}.`);

  // Matérias por trás dos posts (o Giro traz várias)
  const ids = [...new Set(posts.flatMap((p) => p.artigos ?? []))];
  const artigos = ids.length
    ? await rest(
        `generated_articles?select=id,slug,titulo,subtitulo,tldr,imagem_capa_url,imagem_credito,foto_origem,cidade_principal,criticidade_nivel,regiao:regioes(slug,nome),categoria:editorial_categories(slug,nome)&id=in.(${ids.join(",")})`,
      )
    : [];
  const porId = new Map(artigos.map((a) => [a.id, a]));

  // Candidatas: alerta primeiro, depois posts avulsos pelo peso, depois o Giro
  const ordem = { alerta: 0, tragedia: 1, seguranca: 3, nacional: 3, internacional: 4, regional: 5 };
  const cand = [];
  for (const p of posts) {
    if (p.tipo === "coluna" || p.tipo === "reels") continue;
    if (p.tipo === "giro") {
      (p.artigos ?? []).forEach((id, k) => cand.push({ id, post: null, peso: 6 + k * 0.1 }));
    } else {
      const id = p.artigos?.[0];
      if (id) cand.push({ id, post: p, peso: (ordem[p.classe] ?? 5) - (p.score ?? 0) / 1000 });
    }
  }
  cand.sort((a, b) => a.peso - b.peso);
  const vistas = new Set();
  const escolhidas = cand.filter((c) => {
    const a = porId.get(c.id);
    if (!a || vistas.has(c.id) || a.criticidade_nivel === "alto" || a.criticidade_nivel === "critico") return false;
    vistas.add(c.id);
    return true;
  }).slice(0, MAX_NOTICIAS);

  await mkdir(path.join(PUBLIC, "fotos"), { recursive: true });
  // Mídia escolhida pela equipe para o dia (public/extras/AAAA-MM-DD.json):
  // { "<slug da matéria>": { "foto"?: "extras/...jpg", "video"?: "extras/...mp4", "videoDur"?: 7.6, "credito"?: "..." } }
  let extras = {};
  try {
    extras = JSON.parse(await readFile(path.join(PUBLIC, "extras", `${hoje}.json`), "utf8"));
  } catch { /* sem extras no dia */ }
  const TRANS = ["balao", "chicote", "iris", "luz", "glitch"];
  const cenas = [];
  let tr = 0;
  for (const [n, c] of escolhidas.entries()) {
    const a = porId.get(c.id);
    const card = c.post?.card ?? {};
    const ch = card.chapeu ? { texto: card.chapeu, cor: chapeuDe(a).cor } : chapeuDe(a);
    const titulo = semPonto(card.titulo ?? a.titulo);
    const linhaFina = semPonto(card.linhaFina ?? a.subtitulo ?? "") || null;
    const alerta = c.post?.classe === "alerta";
    let estilo = alerta ? "alerta" : "numero";
    let foto = null;
    let credito = null;
    const ex = extras[a.slug] ?? null;
    let video = null;
    let videoDur = null;
    if (!alerta && ex) {
      if (ex.video) { video = ex.video; videoDur = ex.videoDur ?? null; estilo = "foto"; }
      if (ex.foto) { foto = ex.foto; estilo = "foto"; }
      credito = ex.credito ?? null;
    }
    if (!alerta && !ex) {
      const urlFoto = typeof card.foto === "string" && card.foto.startsWith("http") ? card.foto : a.imagem_capa_url;
      const fotoReal = urlFoto && (FOTO_OK.has(a.foto_origem ?? "") || card.formato === "foto") && !/gerada por ia/i.test(a.imagem_credito ?? "");
      if (fotoReal) {
        foto = await baixarFoto(urlFoto, `n${n}`);
        if (foto) {
          estilo = "foto";
          credito = limparCredito(card.credito ?? a.imagem_credito ?? "");
        }
      }
    }
    const m = (card.destaque?.valor ? card.destaque.valor : titulo.match(RE_NUM)?.[0]) ?? null;
    const numero = estilo === "numero" && m ? { valor: m.trim(), rotulo: card.destaque?.rotulo ?? linhaRotulo(titulo, m) } : null;
    const lugar = ch.texto.split("·")[0].trim();
    const abre = titulo.toLowerCase().includes(lugar.toLowerCase()) || /^(mundo|brasil|paraná)$/i.test(lugar) ? "" : `${lugar}. `;
    cenas.push({
      tipo: "noticia",
      dur: 6.5,
      estilo,
      chapeu: ch.texto,
      cor: ch.cor,
      titulo,
      linhaFina: linhaFina && linhaFina.length < 120 ? linhaFina : null,
      foto,
      video,
      videoDur,
      credito,
      numero,
      dados: alerta ? card.dados ?? [] : undefined,
      palavras: [],
      transicao: alerta ? "glitch" : TRANS[tr++ % TRANS.length],
      narracao: falado(`${abre}${titulo}.`),
    });
  }

  const chamadas = cenas.map((c) => c.titulo.split(/\s+/).slice(0, 6).join(" ")).slice(0, 5);
  const roteiro = {
    fps: 30,
    audio: null,
    data: hoje,
    cenas: [
      { tipo: "abertura", dur: 3.6, data: dataExtenso, chamadas, narracao: "Resumo do dia. Vozes Paranaenses." },
      ...cenas,
      { tipo: "assinatura", dur: 6.6, transicao: "balao", narracao: "Vozes Paranaenses: o portal com sotaque de todas as regiões. Siga o perfil e acompanhe o Paraná todo dia." },
    ],
  };
  await writeFile(path.join(PUBLIC, "roteiro.json"), JSON.stringify(roteiro, null, 1));
  console.log(`roteiro: ${cenas.length} notícias de ${posts.length} posts (${hoje})`);
  for (const c of cenas) console.log(` - [${c.estilo}] ${c.chapeu}: ${c.titulo}`);
}

/** Crédito limpo: só o autor/fonte, sem legenda colada ("... Imagem: Assessoria"). */
function limparCredito(c) {
  let t = String(c).replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#0?38;|&amp;/gi, "&").replace(/<[^>]*>?/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const partes = t.split(/\b(?:foto|imagem|crédito)\s*:\s*/i).map((x) => x.replace(/[()\[\]]/g, "").trim()).filter(Boolean);
  t = partes[partes.length - 1] ?? "";
  if (t.length > 60) return null;
  return t || null;
}

/** Rótulo curto do contador a partir do título (o que vem depois do número). */
function linhaRotulo(titulo, num) {
  const depois = titulo.slice(titulo.indexOf(num) + num.length).trim().split(/\s+/).slice(0, 3).join(" ");
  return depois.replace(/[,.;:]$/, "") || "";
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
