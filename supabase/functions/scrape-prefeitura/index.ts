// Vozes Paranaenses — scrape-prefeitura
// Coleta EXCLUSIVAMENTE fontes do tipo 'prefeitura' (assessoria de imprensa
// oficial) — função independente do scrape-source (veículos de imprensa),
// de propósito: cron próprio, sem compartilhar agendamento nem lógica com
// o scraping de portais/jornais. Mesmo mecanismo de coleta (RSS/HTML/
// Firecrawl) e mesmos ciclos fixos, só que sobre uma fatia diferente de
// `fontes` (tipo = 'prefeitura').
// Body opcional: { fonte_id?: string, force?: boolean, sync?: boolean }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarCidades } from "../_shared/cidades.ts";
import { carregarNomesVeiculos, fonteElegivel, processarItensDaFonte, type MetaPagina, type RelatorioFonte } from "../_shared/coleta.ts";
import { extrairDataPublicacao, normalizarDataRss } from "../_shared/data-publicacao.ts";
import { ehAtendeNet, lerListaAtendeNet, lerMateriaAtendeNet } from "../_shared/atende-net.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Fonte = {
  id: string;
  regiao_id: string | null;
  nome: string;
  url_base: string;
  tipo_renderizacao: "estatico" | "spa_js";
  protecao_antibot: boolean;
  frequencia_horas: number | null;
  ultimo_scrape_em: string | null;
  cidade_slug: string | null;
  abrangencia: string | null;
};

// Ciclos 12h e 18h (Brasília), em lotes — ver ../_shared/coleta.ts.
type Item = {
  url: string;
  titulo: string;
  corpo: string;
  data: string | null;
  imagem?: string | null;
  credito?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: { fonte_id?: string; force?: boolean; sync?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Fontes menos recentemente coletadas primeiro: cada chamada do cron
  // dentro da janela do ciclo pega o próximo lote.
  let query = sb
    .from("fontes")
    .select("id, regiao_id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ultimo_scrape_em, cidade_slug, abrangencia")
    .eq("ativo", true)
    .eq("tipo", "prefeitura")
    .order("ultimo_scrape_em", { ascending: true, nullsFirst: true });
  if (body.fonte_id) query = query.eq("id", body.fonte_id);

  const { data: fontes, error } = await query;
  if (error) return json({ error: "fontes_query_failed", detail: error.message }, 500);

  const [cidades, nomesVeiculos] = await Promise.all([carregarCidades(sb), carregarNomesVeiculos(sb)]);

  const eligible = (fontes ?? []).filter((f) => body.fonte_id || body.force || fonteElegivel(f as Fonte));

  // Orçamento de tempo por chamada: o que não couber fica para a próxima
  // chamada do cron dentro da mesma janela do ciclo.
  const inicioExec = Date.now();
  const ORCAMENTO_MS = body.fonte_id || body.sync ? 35_000 : 110_000;
  const dentroDoOrcamento = () => Date.now() - inicioExec < ORCAMENTO_MS;

  async function processFonte(fonte: Fonte): Promise<RelatorioFonte> {
    try {
      const itens = await scrapeFonte(fonte);
      return await processarItensDaFonte({
        sb, fonte, itens, cidades, nomesVeiculos, dentroDoOrcamento,
        // Portal Atende.Net (IPM): leitor próprio, sem JavaScript nem Firecrawl.
        buscarPagina: (u: string) => (ehAtendeNet(u) ? lerMateriaAtendeNet(u) : fetchArticleImageMeta(u)),
        fotoSempreLiberada: true,
      });
    } catch (e) {
      return { fonte: fonte.nome, total: 0, inseridas: 0, duplicadas: 0, sem_data: 0, fora_do_dia: 0, fotos: {}, erro: (e as Error).message };
    }
  }

  // Se o cliente pediu explicitamente uma única fonte, roda inline e devolve
  // o relatório. Caso contrário, dispara em background e responde na hora
  // — o Edge Runtime tem timeout curto do lado do cliente (fetch) e o
  // pipeline no admin encadeia scrape → cluster → classify; travar aqui
  // fazia o botão "Rodar pipeline" abortar antes do fim.
  const CONCURRENCY = 6;
  async function runAll(fontesList: Fonte[]): Promise<RelatorioFonte[]> {
    const queue = [...fontesList];
    const results: RelatorioFonte[] = [];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        if (!dentroDoOrcamento()) break; // resto fica para a próxima chamada do cron
        const f = queue.shift();
        if (!f) return;
        results.push(await processFonte(f));
      }
    });
    await Promise.all(workers);
    return results;
  }

  // Modo síncrono: usado pelo botão manual "Rodar pipeline" (que encadeia
  // scrape → cluster → classify e precisa que cada etapa termine de
  // verdade antes da próxima). Sem isso, os passos seguintes rodam sobre
  // uma raw_articles ainda vazia, porque o scraping real ainda não terminou.
  if (body.fonte_id || body.sync) {
    const results = await runAll(eligible as Fonte[]);
    return json({ ok: true, processed: results.length, total_eligible: eligible.length, report: results });
  }

  // Fora da janela do ciclo (ou ciclo já concluído), o cron chama e sai.
  if (!eligible.length) return json({ ok: true, queued: 0, mode: "idle" });

  const queue = [...(eligible as Fonte[])];
  const task = (async () => {
    const results = await runAll(queue);
    const inseridas = results.reduce((n, r) => n + r.inseridas, 0);
    console.log(`[scrape-prefeitura] lote: ${results.length} fontes, ${inseridas} notícias do dia`);
    if (!inseridas) return;
    // Encadeia o resto do pipeline (cluster + classify) para que o usuário
    // não precise ficar apertando 3 botões — o scrape roda em background e
    // dispara os próximos passos automaticamente.
    for (const fn of ["cluster-articles", "classify-and-quota"]) {
      try {
        const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
        const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;
        const res = await fetch(`${selfUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${selfKey}`, apikey: selfKey },
          body: "{}",
        });
        console.log(`[scrape-prefeitura] chained ${fn} -> ${res.status}`);
      } catch (e) {
        console.error(`[scrape-prefeitura] chained ${fn} failed`, (e as Error).message);
      }
    }
  })();
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  return json({ ok: true, queued: eligible.length, mode: "background" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function scrapeFonte(fonte: Fonte): Promise<Item[]> {
  // Atende.Net (IPM): a lista vem em JSON/base64 no HTML estático. Leitor
  // próprio, de graça — nunca vai para o Firecrawl, mesmo marcado spa_js.
  if (ehAtendeNet(fonte.url_base)) {
    const itens = await lerListaAtendeNet(fonte.url_base);
    console.log(`[${fonte.nome}] Atende.Net -> ${itens.length} itens`);
    return itens;
  }
  const useFirecrawl = fonte.protecao_antibot || fonte.tipo_renderizacao === "spa_js";
  if (useFirecrawl) {
    const fc = await scrapeViaFirecrawl(fonte);
    if (fc.length) return fc;
  }

  // Normaliza: se o usuário cadastrou já uma URL de feed, tenta ela primeiro;
  // caso contrário, monta candidatos comuns a partir do host raiz.
  const origin = new URL(fonte.url_base).origin;
  const looksLikeFeed = /\/(feed|rss)(\.xml)?\/?$/i.test(fonte.url_base) || /feed=/.test(fonte.url_base);
  const rssCandidates = looksLikeFeed
    ? [fonte.url_base]
    : [
        fonte.url_base.replace(/\/$/, "") + "/feed",
        fonte.url_base.replace(/\/$/, "") + "/rss",
        fonte.url_base.replace(/\/$/, "") + "/feed.xml",
        fonte.url_base.replace(/\/$/, "") + "/rss.xml",
        origin + "/?feed=rss2",
      ];
  for (const rss of rssCandidates) {
    try {
      const res = await fetch(rss, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)" },
      });
      console.log(`[${fonte.nome}] RSS ${rss} -> ${res.status}`);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes("<item") && !text.includes("<entry")) continue;
      return parseRss(text).slice(0, 30);
    } catch {
      // tenta próximo
    }
  }

  // Estratégia 2: HTML — se a URL cadastrada retornar 404 (ex.: /feed inexistente),
  // cai para a home do domínio automaticamente.
  const htmlTargets = looksLikeFeed ? [origin + "/", fonte.url_base] : [fonte.url_base, origin + "/"];
  for (const target of htmlTargets) {
    try {
      const res = await fetch(target, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0)" },
      });
      console.log(`[${fonte.nome}] HTML ${target} -> ${res.status}`);
      if (!res.ok) continue;
      const html = await res.text();
      const items = parseHtmlLinks(html, target).slice(0, 30);
      console.log(`[${fonte.nome}] HTML ${target} html_len=${html.length} items=${items.length}`);
      if (items.length) return items;
    } catch {
      // tenta próximo
    }
  }
  return [];
}

async function scrapeViaFirecrawl(fonte: Fonte): Promise<Item[]> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.warn(`[${fonte.nome}] FIRECRAWL_API_KEY missing; skipping firecrawl`);
    return [];
  }
  const origin = new URL(fonte.url_base).origin;
  const target = fonte.url_base;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: target,
        formats: ["html", "links"],
        onlyMainContent: false,
      }),
    });
    console.log(`[${fonte.nome}] Firecrawl ${target} -> ${res.status}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[${fonte.nome}] firecrawl error: ${detail.slice(0, 300)}`);
      return [];
    }
    const data = await res.json();
    const doc = data?.data ?? data;
    const html: string = doc?.html ?? doc?.rawHtml ?? "";
    const links: string[] = Array.isArray(doc?.links) ? doc.links : [];

    const items: Item[] = [];
    if (html) {
      items.push(...parseHtmlLinks(html, target));
    }
    if (items.length < 5 && links.length) {
      const seen = new Set(items.map((i) => i.url));
      for (const href of links) {
        if (!/\/(noticia|materia|reportagem|20\d\d|editorial|geral|policia|politica|economia|cultura|esporte|regional)/i.test(href)) continue;
        const abs = href.startsWith("http") ? href : new URL(href, origin).toString();
        if (seen.has(abs)) continue;
        seen.add(abs);
        // sem título ainda — usa slug do path como fallback
        const slug = decodeURIComponent(abs.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ").slice(0, 200);
        if (slug.length < 20) continue;
        items.push({ url: abs, titulo: slug, corpo: "", data: null });
      }
    }
    console.log(`[${fonte.nome}] Firecrawl items=${items.length}`);
    return items.slice(0, 30);
  } catch (e) {
    console.error(`[${fonte.nome}] firecrawl exception`, (e as Error).message);
    return [];
  }
}

function parseRss(xml: string): Item[] {
  const items: Item[] = [];
  const isAtom = xml.includes("<entry");
  const blockRe = isAtom ? /<entry[\s\S]*?<\/entry>/g : /<item[\s\S]*?<\/item>/g;
  const blocks = xml.match(blockRe) ?? [];
  for (const b of blocks) {
    const titulo = decode(match(b, /<title[^>]*>([\s\S]*?)<\/title>/));
    const link = isAtom
      ? (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "")
      : decode(match(b, /<link[^>]*>([\s\S]*?)<\/link>/));
    const descr = decode(match(b, /<description[^>]*>([\s\S]*?)<\/description>/) || match(b, /<summary[^>]*>([\s\S]*?)<\/summary>/));
    const data = match(b, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || match(b, /<published[^>]*>([\s\S]*?)<\/published>/) || null;
    if (!link || !titulo) continue;
    // Tenta capturar imagem: enclosure, media:content, media:thumbnail, ou <img src=""> na descrição
    const enclosure = b.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)?.[1]
      || b.match(/<media:content[^>]+url="([^"]+)"[^>]*(?:medium="image"|type="image)/i)?.[1]
      || b.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1]
      || b.match(/<img[^>]+src="([^"]+)"/i)?.[1]
      || null;
    // Só usamos media:credit — dc:creator costuma ser o autor da matéria, não da foto.
    const credito = decode(match(b, /<media:credit[^>]*>([\s\S]*?)<\/media:credit>/)) || null;
    items.push({
      url: link.trim(),
      titulo: titulo.trim().slice(0, 500),
      corpo: stripTags(descr).slice(0, 4000),
      data: normalizarDataRss(data),
      imagem: enclosure ? enclosure.trim() : null,
      credito: credito ? credito.trim().slice(0, 200) : null,
    });
  }
  return items;
}

function parseHtmlLinks(html: string, base: string): Item[] {
  const items: Item[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const label = stripTags(m[2]).trim();
    if (!label || label.length < 20) continue;
    if (!/\/(noticia|materia|reportagem|20\d\d|editorial|geral|policia|politica|economia|cultura|esporte|regional)/i.test(href)) continue;
    const abs = href.startsWith("http") ? href : new URL(href, base).toString();
    if (seen.has(abs)) continue;
    seen.add(abs);
    items.push({ url: abs, titulo: label.slice(0, 500), corpo: "", data: null });
  }
  return items;
}

function match(s: string, re: RegExp): string {
  const m = s.match(re);
  return m ? m[1] : "";
}

// Busca a página da matéria e extrai a imagem principal:
// 1) og:image / og:image:secure_url
// 2) twitter:image / twitter:image:src
// 3) <link rel="image_src">
// 4) primeiro <img src=""> do corpo (fallback)
async function fetchArticleImageMeta(url: string): Promise<MetaPagina> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { imagem: null, credito: null, corpoCompleto: "", data: null, dataOrigem: null };
    const html = await res.text();
    const head = html.slice(0, 200_000); // og/twitter costumam estar no <head>
    const patterns: RegExp[] = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ];
    let imagem: string | null = null;
    for (const re of patterns) {
      const m = head.match(re);
      if (m?.[1]) { imagem = absolutize(m[1], url); break; }
    }
    if (!imagem) {
      // Fallback: primeiro <img src=""> razoável (evita logos/ícones minúsculos)
      const imgs = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) ?? [];
      for (const tag of imgs) {
        const src = tag.match(/src=["']([^"']+)["']/i)?.[1];
        if (!src) continue;
        if (/(sprite|logo|icon|avatar|blank|placeholder|1x1|pixel)/i.test(src)) continue;
        if (/\.(svg)(\?|$)/i.test(src)) continue;
        imagem = absolutize(src, url); break;
      }
    }
    const credito = extractCredit(html, head);
    const corpoCompleto = extractArticleBody(html);
    const dataPub = extrairDataPublicacao(html, url);
    return { imagem, credito, corpoCompleto, data: dataPub?.iso ?? null, dataOrigem: dataPub?.origem ?? null };
  } finally {
    clearTimeout(t);
  }
}

function extractArticleBody(html: string): string {
  const containerPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+class=["'][^"']*(?:post-content|entry-content|article-body|article-content|materia-conteudo|conteudo-materia|corpo-noticia|texto-noticia|content-text|single-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];
  let container = "";
  for (const re of containerPatterns) {
    const m = html.match(re);
    if (m?.[1] && m[1].length > 200) { container = m[1]; break; }
  }
  const source = container || html;
  const paragraphs = (source.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [])
    .map((p) => stripTags(p).trim())
    .filter((p) => p.length >= 40 && !/^(leia também|publicidade|veja também|compartilhe|assine)/i.test(p));
  return paragraphs.join("\n\n").slice(0, 8000);
}

// Extrai crédito/legenda da foto. Ordem de preferência:
// 1) meta tags específicas (article:photo:credit, image:credit, dc.creator)
// 2) <figure> com <figcaption> — primeira figure do artigo
// 3) elementos com classe/label indicando crédito (wp-caption-text, credito, credit, foto-credito, image-caption)
// 4) padrão "Foto:/Crédito:/Imagem:" em texto próximo (primeiros 100kb do body)
function extractCredit(html: string, head: string): string | null {
  const metaPatterns: RegExp[] = [
    /<meta[^>]+(?:property|name)=["'](?:article:photo:credit|image:credit|og:image:credit)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:photo:credit|image:credit|og:image:credit)["']/i,
  ];
  for (const re of metaPatterns) {
    const m = head.match(re);
    if (m?.[1]) return cleanCredit(m[1]);
  }
  // <figcaption>...</figcaption>
  const figcap = html.match(/<figcaption[^>]*>([\s\S]{1,500}?)<\/figcaption>/i);
  if (figcap?.[1]) {
    const txt = stripTags(decode(figcap[1]));
    const c = cleanCredit(txt);
    if (c) return c;
  }
  // Classes conhecidas
  const classPatterns: RegExp[] = [
    /<(?:span|p|div|small)[^>]+class=["'][^"']*(?:wp-caption-text|credito|credit|foto-credito|image-caption|photo-credit|legenda)[^"']*["'][^>]*>([\s\S]{1,500}?)<\/(?:span|p|div|small)>/i,
  ];
  for (const re of classPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const c = cleanCredit(stripTags(decode(m[1])));
      if (c) return c;
    }
  }
  // Padrão de texto solto: "Foto: Fulano/Órgão"
  const body = html.slice(0, 150_000);
  const looseRe = /(Foto|Crédito|Cr[eé]dito|Imagem)\s*[:\-–]\s*([A-Z0-9][^<\n\r|]{2,120}?)(?=[<\n\r|]|$)/;
  const loose = body.match(looseRe);
  if (loose) {
    const c = cleanCredit(`${loose[1]}: ${loose[2]}`);
    if (c) return c;
  }
  return null;
}

function cleanCredit(raw: string): string | null {
  const s = raw.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!s || s.length < 3 || s.length > 200) return null;
  return s;
}

function absolutize(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
