// Vozes Paranaenses — lista de notícias servida em JSON (DataTables).
//
// Alguns portais de prefeitura montam a lista no navegador a partir de um
// endpoint JSON no formato do DataTables — ex.: Paranaguá,
// /include/processo-listar-noticias.php:
//   {"success":true,"aaData":[["6318","23/10/2026","<a href='/noticias/noticia6318.html'>Título</a>"], ...]}
// O HTML da página não traz a lista; o JSON traz tudo, com a data. Leitor
// de graça (sem Firecrawl).

export type ItemJson = { url: string; titulo: string; corpo: string; data: string | null };

/** A URL cadastrada aponta para um endpoint de lista em JSON? */
export function ehListaJson(url: string): boolean {
  return /listar[-_]?noticias|\.json(\?|$)/i.test(url);
}

function dataBr(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, aaaa, hh = "12", mi = "00"] = m;
  const d = new Date(`${aaaa}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:00-03:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Exportado para teste. */
export function parseListaJson(texto: string, base: string): ItemJson[] {
  let j: unknown;
  try { j = JSON.parse(texto); } catch { return []; }
  const o = j as { aaData?: unknown; data?: unknown };
  const linhas = Array.isArray(o?.aaData) ? o.aaData : Array.isArray(o?.data) ? o.data : [];
  const itens: ItemJson[] = [];
  for (const linha of linhas as unknown[]) {
    const cels = Array.isArray(linha) ? linha.map(String) : Object.values(linha as Record<string, unknown>).map(String);
    const link = cels.map((c) => c.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)).find(Boolean);
    if (!link) continue;
    const titulo = link[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (titulo.length < 10) continue;
    let url: string;
    try { url = new URL(link[1], base).toString(); } catch { continue; }
    const data = cels.map((c) => dataBr(c.trim())).find(Boolean) ?? null;
    itens.push({ url, titulo, corpo: "", data });
  }
  return itens;
}

export async function lerListaJson(url: string): Promise<ItemJson[]> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)",
      "x-requested-with": "XMLHttpRequest",
      accept: "application/json, text/javascript, */*",
    },
  });
  if (!res.ok) throw new Error(`lista JSON ${res.status}`);
  return parseListaJson(await res.text(), url).slice(0, 30);
}
