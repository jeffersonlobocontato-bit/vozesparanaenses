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
  frequencia_horas: number;
  ultimo_scrape_em: string | null;
};

type Item = {
  url: string;
  titulo: string;
  corpo: string;
  data: string | null;
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

  const now = Date.now();
  const eligible = (fontes ?? []).filter((f) => {
    if (body.fonte_id || body.force) return true;
    if (!f.ultimo_scrape_em) return true;
    const last = new Date(f.ultimo_scrape_em).getTime();
    return now - last >= f.frequencia_horas * 3600 * 1000;
  });

  const report: Record<string, unknown>[] = [];
  for (const fonte of eligible as Fonte[]) {
    try {
      const items = await scrapeFonte(fonte);
      let inserted = 0;
      let duplicates = 0;
      for (const it of items) {
        const hash = await sha256(it.url + "|" + it.titulo);
        const { error: insErr } = await sb.from("raw_articles").insert({
          fonte_id: fonte.id,
          regiao_id: fonte.regiao_id,
          url: it.url,
          titulo: it.titulo,
          corpo_limpo: it.corpo,
          hash_conteudo: hash,
          data_publicacao_original: it.data,
          processado: false,
        });
        if (insErr) {
          if (insErr.code === "23505") duplicates++;
          else console.error(`[${fonte.nome}] insert error`, insErr.message);
        } else {
          inserted++;
        }
      }
      await sb.from("fontes").update({ ultimo_scrape_em: new Date().toISOString() }).eq("id", fonte.id);
      report.push({ fonte: fonte.nome, total: items.length, inserted, duplicates });
    } catch (e) {
      report.push({ fonte: fonte.nome, error: (e as Error).message });
    }
  }

  return json({ ok: true, processed: report.length, report });
});

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
    items.push({
      url: link.trim(),
      titulo: titulo.trim().slice(0, 500),
      corpo: stripTags(descr).slice(0, 4000),
      data: data ? new Date(data).toISOString() : null,
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