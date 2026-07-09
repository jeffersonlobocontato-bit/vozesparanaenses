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

  let body: { fonte_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let query = sb
    .from("fontes")
    .select("id, regiao_id, nome, url_base, tipo_renderizacao, frequencia_horas, ultimo_scrape_em")
    .eq("ativo", true);
  if (body.fonte_id) query = query.eq("id", body.fonte_id);

  const { data: fontes, error } = await query;
  if (error) return json({ error: "fontes_query_failed", detail: error.message }, 500);

  const now = Date.now();
  const eligible = (fontes ?? []).filter((f) => {
    if (body.fonte_id) return true;
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
  // Estratégia 1: tentar RSS comum
  const rssCandidates = [
    fonte.url_base.replace(/\/$/, "") + "/feed",
    fonte.url_base.replace(/\/$/, "") + "/rss",
    fonte.url_base.replace(/\/$/, "") + "/feed.xml",
    fonte.url_base.replace(/\/$/, "") + "/rss.xml",
  ];
  for (const rss of rssCandidates) {
    try {
      const res = await fetch(rss, {
        headers: { "user-agent": "VozesParanaensesBot/1.0 (+contato@vozesparanaenses.com.br)" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes("<item") && !text.includes("<entry")) continue;
      return parseRss(text).slice(0, 30);
    } catch {
      // tenta próximo
    }
  }

  // Estratégia 2: HTML — coleta apenas <a> com heurística de matéria
  try {
    const res = await fetch(fonte.url_base, {
      headers: { "user-agent": "VozesParanaensesBot/1.0" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseHtmlLinks(html, fonte.url_base).slice(0, 20);
  } catch {
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