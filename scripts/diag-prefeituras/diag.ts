// Diagnóstico e descoberta das fontes de prefeitura — roda no GitHub Actions
// (o ambiente do Claude não alcança os sites *.pr.gov.br).
//
// Usa o MESMO leitor do robô (supabase/functions/_shared/leitor-prefeitura.ts):
//  - modo "fonte": testa a url_base cadastrada e outras candidatas do mesmo site;
//  - modo "cidade": cidade sem fonte — acha o site da prefeitura e a lista de notícias.
// Para cada candidata: quantos itens a lista devolve, quantos têm data (da
// lista ou da página da matéria), quantos são dos últimos 14 dias, datas no
// futuro (dia/mês trocado) e a nota final. Saída: resultado.json.
//
// deno run --allow-net --allow-read --allow-write --allow-env scripts/diag-prefeituras/diag.ts

import { lerPaginaPrefeitura, scrapeFonte, type Item } from "../../supabase/functions/_shared/leitor-prefeitura.ts";

type Alvo = { modo: "fonte" | "cidade"; id?: string; nome: string; cidade: string; url?: string };
type Teste = {
  url: string; itens: number; com_data: number; recentes: number; futuras: number; sem_data: number;
  mais_recente: string | null; exemplos: { titulo: string; url: string; data: string | null }[]; erro?: string; nota: number;
};

const DIR = new URL(".", import.meta.url).pathname;
const ARQ = Deno.args[0] ?? "alvos";
const alvos: Alvo[] = JSON.parse(await Deno.readTextFile(DIR + ARQ + ".json"));
const AGORA = Date.now();
const DIA = 86400_000;
const UA = "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)";

function comTempo<T>(p: Promise<T>, ms: number, padrao: T): Promise<T> {
  return Promise.race([p, new Promise<T>((ok) => setTimeout(() => ok(padrao), ms))]);
}

async function baixar(u: string): Promise<{ ok: boolean; url: string; html: string }> {
  try {
    const r = await comTempo(fetch(u, { headers: { "user-agent": UA }, redirect: "follow" }), 12_000, null as unknown as Response);
    if (!r) return { ok: false, url: u, html: "" };
    const html = r.ok ? (await r.text()).slice(0, 600_000) : "";
    return { ok: r.ok, url: r.url || u, html };
  } catch {
    return { ok: false, url: u, html: "" };
  }
}

async function testar(url: string): Promise<Teste> {
  const t: Teste = { url, itens: 0, com_data: 0, recentes: 0, futuras: 0, sem_data: 0, mais_recente: null, exemplos: [], nota: 0 };
  let itens: Item[] = [];
  try {
    itens = await comTempo(scrapeFonte({ nome: url, url_base: url, tipo_renderizacao: "estatico", protecao_antibot: false }), 40_000, []);
  } catch (e) {
    t.erro = (e as Error).message;
  }
  t.itens = itens.length;
  for (const it of itens.slice(0, 6)) {
    let data = it.data;
    if (!data) {
      const meta = await comTempo(lerPaginaPrefeitura(it.url).catch(() => null), 15_000, null);
      data = meta?.data ?? null;
    }
    t.exemplos.push({ titulo: it.titulo.slice(0, 90), url: it.url, data });
    if (!data) { t.sem_data++; continue; }
    t.com_data++;
    const ms = new Date(data).getTime();
    if (ms > AGORA + 2 * DIA) t.futuras++;
    else if (AGORA - ms <= 14 * DIA) t.recentes++;
    if (!t.mais_recente || (ms <= AGORA + 2 * DIA && data > t.mais_recente)) t.mais_recente = data;
  }
  // Nota: lista com itens, datas legíveis, e notícia recente pesam mais.
  t.nota = Math.min(t.itens, 10) + t.com_data * 3 + t.recentes * 6 - t.futuras * 8 - t.sem_data * 2;
  return t;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function hostsDaCidade(slug: string): string[] {
  const s = slug.replace(/-/g, "");
  return [`https://www.${s}.pr.gov.br`, `https://${s}.pr.gov.br`, `https://${s}.atende.net`];
}

const CAMINHOS = ["/feed/", "/noticias", "/noticias/", "/noticia", "/noticias_site", "/cidadao/noticia", "/noticia/categoria", "/portal/noticias", "/api/rss/noticias", "/cidade/noticias", "/imprensa/noticias"];

/** Links de lista de notícias que aparecem na home do site. */
function linksDeLista(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const rotulo = semAcento(m[2].replace(/<[^>]+>/g, " ")).toLowerCase();
    if (!/noticia|imprensa|comunicacao|feed|rss/i.test(href) && !/^\s*(noticias|todas as noticias|mais noticias|imprensa|ultimas noticias)\s*$/.test(rotulo)) continue;
    // Página de UMA matéria (id/slug longo) não é lista.
    if (/noticiasView\/\?id=|\/noticia\/\d+\/[a-z0-9-]{8,}/i.test(href)) continue;
    try { out.add(new URL(href, base).toString()); } catch { /* ignora */ }
    if (out.size >= 4) break;
  }
  return [...out];
}

async function candidatas(a: Alvo): Promise<string[]> {
  const lista = new Set<string>();
  const origens = new Set<string>();
  if (a.url) {
    lista.add(a.url);
    try { origens.add(new URL(a.url).origin); } catch { /* ignora */ }
  }
  if (a.modo === "cidade") {
    for (const h of hostsDaCidade(a.cidade)) {
      const r = await baixar(h + "/");
      if (r.ok && r.html.length > 2000) { origens.add(new URL(r.url).origin); break; }
    }
  }
  for (const o of origens) {
    const home = await baixar(o + "/");
    if (home.ok) for (const l of linksDeLista(home.html, home.url)) lista.add(l);
    for (const c of CAMINHOS) lista.add(o + c);
  }
  return [...lista].slice(0, 14);
}

async function avaliar(a: Alvo) {
  const cands = await candidatas(a);
  const testes: Teste[] = [];
  for (const u of cands) {
    // Caminho que nem responde não precisa do leitor completo.
    if (u !== a.url) {
      const r = await baixar(u);
      if (!r.ok) continue;
    }
    const t = await testar(u);
    testes.push(t);
    if (t.recentes >= 3 && t.futuras === 0) break; // achou uma boa
  }
  testes.sort((x, y) => y.nota - x.nota);
  const atual = a.url ? testes.find((t) => t.url === a.url) ?? null : null;
  return { ...a, candidatas: cands.length, melhor: testes[0] ?? null, atual, testes: testes.slice(0, 4) };
}

const resultado: unknown[] = [];
const fila = [...alvos];
let feitos = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (fila.length) {
    const a = fila.shift()!;
    try {
      resultado.push(await comTempo(avaliar(a), 240_000, { ...a, erro: "tempo esgotado" }));
    } catch (e) {
      resultado.push({ ...a, erro: (e as Error).message });
    }
    feitos++;
    if (feitos % 10 === 0) console.log(`${feitos}/${alvos.length}`);
  }
}));
await Deno.writeTextFile(DIR + (ARQ === "alvos" ? "resultado" : "resultado-" + ARQ) + ".json", JSON.stringify(resultado, null, 1));
console.log("pronto", resultado.length);
