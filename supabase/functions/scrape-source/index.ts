// Vozes Paranaenses — scrape-source
// Coleta artigos brutos das `fontes` (RSS ou HTML simples), calcula hash de
// conteúdo (deduplicação) e insere em `raw_articles` no Supabase externo.
// Body opcional: { fonte_id?: string }. Sem body, processa todas as fontes
// ativas cujo `ultimo_scrape_em` seja mais antigo que `frequencia_horas`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
};

type Cidade = { slug: string; nome: string; regiao_id: string };

// Ciclos fixos de coleta (horário de Brasília) — ver 014_scraping_priorizado.sql.
// Fontes com frequencia_horas = null seguem esses horários; um valor numérico
// na fonte é tratado como exceção pontual (comportamento antigo, por tempo
// decorrido desde a última coleta).
const FIXED_HOURS = [7, 12, 15, 19];

function horaSaoPaulo(d = new Date()): number {
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d);
  return parseInt(s, 10);
}

type Item = {
  url: string;
  titulo: string;
  corpo: string;
  data: string | null;
  imagem?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: { fonte_id?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let query = sb
    .from("fontes")
    .select("id, regiao_id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ultimo_scrape_em")
    .eq("ativo", true);
  if (body.fonte_id) query = query.eq("id", body.fonte_id);

  const { data: fontes, error } = await query;
  if (error) return json({ error: "fontes_query_failed", detail: error.message }, 500);

  const { data: cidadesData } = await sb.from("cidades").select("slug, nome, regiao_id");
  const cidades = (cidadesData ?? []) as Cidade[];

  const now = Date.now();
  const horaAtual = horaSaoPaulo();
  const eligible = (fontes ?? []).filter((f) => {
    if (body.fonte_id || body.force) return true;
    if (f.frequencia_horas != null) {
      // Exceção: comportamento antigo, por tempo decorrido desde a última coleta.
      if (!f.ultimo_scrape_em) return true;
      const last = new Date(f.ultimo_scrape_em).getTime();
      return now - last >= f.frequencia_horas * 3600 * 1000;
    }
    // Padrão: só coleta nos ciclos fixos do dia, com uma trava de 2h contra
    // execuções duplicadas se o cron ticar mais de uma vez dentro do mesmo ciclo.
    if (!FIXED_HOURS.includes(horaAtual)) return false;
    if (!f.ultimo_scrape_em) return true;
    const last = new Date(f.ultimo_scrape_em).getTime();
    return now - last >= 2 * 3600 * 1000;
  });

  async function processFonte(fonte: Fonte): Promise<Record<string, unknown>> {
    try {
      const items = await scrapeFonte(fonte);
      // 1 notícia por fonte, por ciclo: percorre em ordem de destaque (a ordem
      // natural do RSS/HTML/Firecrawl) e fica com a PRIMEIRA ainda não vista
      // — se já existe (hash duplicado), pula pra próxima; assim que uma
      // inserção der certo, para. Isso limita o volume por ciclo e ainda
      // captura a manchete mais recente que a fonte considerou relevante.
      let insertedItem: Item | null = null;
      let duplicates = 0;
      for (const it of items) {
        const hash = await sha256(it.url + "|" + it.titulo);
        const deteccao = detectarCidade(`${it.titulo}\n${it.corpo}`, cidades);
        const { error: insErr } = await sb.from("raw_articles").insert({
          fonte_id: fonte.id,
          regiao_id: deteccao?.regiao_id ?? fonte.regiao_id,
          cidade_detectada_slug: deteccao?.slug ?? null,
          regiao_detectada_id: deteccao?.regiao_id ?? null,
          url: it.url,
          titulo: it.titulo,
          corpo_limpo: it.corpo,
          hash_conteudo: hash,
          data_publicacao_original: it.data,
          imagem_original_url: it.imagem ?? null,
          processado: false,
        });
        if (insErr) {
          if (insErr.code === "23505") { duplicates++; continue; }
          console.error(`[${fonte.nome}] insert error`, insErr.message);
          continue;
        }
        insertedItem = it;
        break;
      }
      await sb.from("fontes").update({ ultimo_scrape_em: new Date().toISOString() }).eq("id", fonte.id);
      return { fonte: fonte.nome, total: items.length, inserted: insertedItem ? 1 : 0, duplicates };
    } catch (e) {
      return { fonte: fonte.nome, error: (e as Error).message };
    }
  }

  // Se o cliente pediu explicitamente uma única fonte, roda inline e devolve
  // o relatório. Caso contrário, dispara em background e responde na hora
  // — o Edge Runtime tem timeout curto do lado do cliente (fetch) e o
  // pipeline no admin encadeia scrape → cluster → classify; travar aqui
  // fazia o botão "Rodar pipeline" abortar antes do fim.
  if (body.fonte_id) {
    const results = await Promise.all((eligible as Fonte[]).map(processFonte));
    return json({ ok: true, processed: results.length, report: results });
  }

  const CONCURRENCY = 6;
  const queue = [...(eligible as Fonte[])];
  const task = (async () => {
    const results: Record<string, unknown>[] = [];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const f = queue.shift();
        if (!f) return;
        results.push(await processFonte(f));
      }
    });
    await Promise.all(workers);
    console.log(`[scrape-source] background done: ${results.length} fontes`);
    // Encadeia o resto do pipeline (cluster + classify) para que o usuário
    // não precise ficar apertando 3 botões — o scrape roda em background e
    // dispara os próximos passos automaticamente.
    for (const fn of ["cluster-articles", "classify-and-quota"]) {
      try {
        const res = await fetch(`${url}/functions/v1/${fn}`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
          body: "{}",
        });
        console.log(`[scrape-source] chained ${fn} -> ${res.status}`);
      } catch (e) {
        console.error(`[scrape-source] chained ${fn} failed`, (e as Error).message);
      }
    }
  })();
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(task);
  return json({ ok: true, queued: eligible.length, mode: "background" });
});

// Detecta a cidade mais mencionada no texto (título + corpo) comparando
// contra a base de `cidades`, e retorna a região correspondente. Usado para
// classificar a matéria pela região da cidade citada, em vez de assumir
// sempre a região configurada na fonte.
function detectarCidade(texto: string, cidades: Cidade[]): { slug: string; regiao_id: string } | null {
  if (!cidades.length) return null;
  const alvo = normalizar(texto);
  let melhor: { slug: string; regiao_id: string; count: number } | null = null;
  for (const c of cidades) {
    const nomeNorm = normalizar(c.nome);
    if (nomeNorm.length < 4) continue; // evita falso-positivo em nomes curtos
    const re = new RegExp(`\\b${nomeNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const count = (alvo.match(re) ?? []).length;
    if (count > 0 && (!melhor || count > melhor.count)) {
      melhor = { slug: c.slug, regiao_id: c.regiao_id, count };
    }
  }
  return melhor ? { slug: melhor.slug, regiao_id: melhor.regiao_id } : null;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function scrapeFonte(fonte: Fonte): Promise<Item[]> {
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
    items.push({
      url: link.trim(),
      titulo: titulo.trim().slice(0, 500),
      corpo: stripTags(descr).slice(0, 4000),
      data: data ? new Date(data).toISOString() : null,
      imagem: enclosure ? enclosure.trim() : null,
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