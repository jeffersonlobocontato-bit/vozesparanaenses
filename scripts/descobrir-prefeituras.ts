// Descobre a página de notícias da prefeitura de cada uma das 399 cidades do
// PR e verifica se o pipeline consegue ler: lista de notícias (RSS ou HTML)
// E data de publicação legível na matéria (sem data, a coleta descarta).
//
//   node scripts/descobrir-prefeituras.ts [saida.json]
//
// Gera um JSON com o resultado por cidade; `gerar-sql-prefeituras.ts`
// transforma em SQL para `fontes`. Requisições leves (≤ ~10 por cidade),
// com User-Agent identificado, 8 em paralelo.

import { writeFileSync } from "node:fs";
import { PARANA_MUNICIPIOS } from "../src/lib/parana-municipios.ts";
import { extrairDataPublicacao, normalizarDataRss } from "../supabase/functions/_shared/data-publicacao.ts";

const UA = "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)";
const LINK_NOTICIA = /\/(noticia|materia|reportagem|20\d\d|editorial|geral|policia|politica|economia|cultura|esporte|regional)/i;

type Resultado = {
  slug: string;
  nome: string;
  regiao: string | null;
  status: "ok" | "sem_data" | "sem_lista" | "fora_do_ar";
  url_base: string | null;
  metodo: "rss" | "html" | null;
  itens: number;
  exemplo: string | null;
  data_exemplo: string | null;
  data_origem: string | null;
};

async function baixar(url: string, ms = 8000): Promise<{ url: string; html: string } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml" }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    return { url: res.url || url, html };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function strip(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Mesma heurística do scraper (parseHtmlLinks) — se aqui acha, lá acha.
function linksDeNoticia(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const label = strip(m[2]);
    if (label.length < 20 || !LINK_NOTICIA.test(m[1])) continue;
    try { out.add(new URL(m[1], base).toString()); } catch { /* ignora */ }
  }
  return [...out];
}

function itensRss(xml: string): Array<{ link: string; data: string | null }> {
  const blocos = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return blocos.map((b) => ({
    link: strip(b.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? ""),
    data: normalizarDataRss(b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1]),
  })).filter((i) => i.link);
}

async function verificarData(urlMateria: string): Promise<{ iso: string; origem: string } | null> {
  const pag = await baixar(urlMateria);
  return pag ? extrairDataPublicacao(pag.html, urlMateria) : null;
}

async function descobrir(m: { slug: string; name: string; region: string | null }): Promise<Resultado> {
  const s = m.slug.replace(/-/g, "");
  const base: Resultado = { slug: m.slug, nome: m.name, regiao: m.region, status: "fora_do_ar", url_base: null, metodo: null, itens: 0, exemplo: null, data_exemplo: null, data_origem: null };

  const origens = [`https://www.${s}.pr.gov.br`, `https://${s}.pr.gov.br`, `http://www.${s}.pr.gov.br`];
  let origem: string | null = null;
  let home: string | null = null;
  for (const o of origens) {
    const r = await baixar(o + "/");
    if (r) { origem = new URL(r.url).origin; home = r.html; break; }
  }

  const candidatos: string[] = [];
  if (origem) {
    // RSS (WordPress etc.) primeiro: traz data em cada item.
    candidatos.push(`${origem}/feed`);
    // Links de listagem achados na home ("/noticias", "/cidadao/noticia"...).
    const listagens = new Set<string>();
    for (const mm of (home ?? "").matchAll(/href="([^"]*noticias?[^"]{0,20})"/gi)) {
      try {
        const u = new URL(mm[1], origem);
        if (u.pathname.split("/").filter(Boolean).length <= 3) listagens.add(u.toString());
      } catch { /* ignora */ }
    }
    candidatos.push(...[...listagens].slice(0, 4));
    for (const p of ["/noticias", "/site/noticias", "/cidadao/noticia", "/portal/noticias", "/imprensa/noticias"]) candidatos.push(origem + p);
  }
  // Plataforma Atende.net (IPM), usada por muitos municípios do PR.
  candidatos.push(`https://${s}.atende.net/cidadao/noticia`);

  base.status = origem ? "sem_lista" : "fora_do_ar";
  const vistos = new Set<string>();
  for (const c of candidatos) {
    if (vistos.has(c)) continue;
    vistos.add(c);
    const r = await baixar(c);
    if (!r) continue;
    if (base.status === "fora_do_ar") base.status = "sem_lista";

    if (/<item[\s>]/.test(r.html) && /<rss|<channel/.test(r.html)) {
      const itens = itensRss(r.html);
      if (itens.length >= 3) {
        const comData = itens.find((i) => i.data);
        return { ...base, status: comData ? "ok" : "sem_data", url_base: r.url, metodo: "rss", itens: itens.length, exemplo: itens[0].link, data_exemplo: comData?.data ?? null, data_origem: comData ? "rss" : null };
      }
      continue;
    }
    const links = linksDeNoticia(r.html, r.url);
    if (links.length >= 3) {
      // A data tem que ser legível na própria matéria (testa até 2).
      for (const l of links.slice(0, 2)) {
        const d = await verificarData(l);
        if (d) return { ...base, status: "ok", url_base: r.url, metodo: "html", itens: links.length, exemplo: l, data_exemplo: d.iso, data_origem: d.origem };
      }
      if (!base.url_base) Object.assign(base, { status: "sem_data", url_base: r.url, metodo: "html", itens: links.length, exemplo: links[0] });
    }
  }
  return base;
}

const saida = process.argv[2] ?? "prefeituras-descoberta.json";
const fila = [...PARANA_MUNICIPIOS] as Array<{ slug: string; name: string; region: string | null }>;
const resultados: Resultado[] = [];
let feitos = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (fila.length) {
    const m = fila.shift()!;
    resultados.push(await descobrir(m));
    if (++feitos % 25 === 0) console.log(`${feitos}/399`);
  }
}));
resultados.sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(saida, JSON.stringify(resultados, null, 2));
const cont = resultados.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log("resumo:", cont, "→", saida);
