// Vozes Paranaenses — data de publicação (validador "só notícia do dia")
//
// A automação das 399 cidades publica APENAS o que a fonte publicou no dia
// corrente (fuso de Brasília). A data da fonte é o validador: notícia sem
// data identificável é descartada — antes, 41% das coletas entravam sem data
// e passavam direto, porque "não dava pra provar que estava velha".

const FUSO = "America/Sao_Paulo";

/** "AAAA-MM-DD" no fuso de Brasília. */
export function diaSaoPaulo(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function horaSaoPaulo(d: Date = new Date()): number {
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", hour12: false }).format(d);
  return parseInt(s, 10);
}

/** true quando `iso` cai no mesmo dia (Brasília) que `agora`. */
export function ehDoDia(iso: string | null | undefined, agora: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  // Data no futuro além de 1h = relógio errado da fonte; não confia.
  if (d.getTime() - agora.getTime() > 3600_000) return false;
  return diaSaoPaulo(d) === diaSaoPaulo(agora);
}

/** Instante de início do ciclo atual (hora cheia de Brasília de hoje). */
export function inicioDoCiclo(hora: number, agora: Date = new Date()): Date {
  const dia = diaSaoPaulo(agora);
  // Brasília não tem horário de verão desde 2019: UTC-3 fixo.
  return new Date(`${dia}T${String(hora).padStart(2, "0")}:00:00-03:00`);
}

function normalizarIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // dd/mm/aaaa [hh:mm] — formato comum em portal de prefeitura.
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*(?:às|-|,)?\s*(\d{1,2})[:h](\d{2}))?/i);
  if (br) {
    const [, dd, mm, aaaa, hh = "12", mi = "00"] = br;
    return paraIso(`${aaaa}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:00-03:00`);
  }
  // Data ISO sem fuso ("2026-10-22" ou "2026-10-22T10:00") = horário de Brasília.
  const semFuso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?))?$/);
  if (semFuso) {
    const hora = semFuso[2] ?? "12:00";
    return paraIso(`${semFuso[1]}T${hora.length === 5 ? `${hora}:00` : hora}-03:00`);
  }
  return paraIso(s);
}

function paraIso(s: string): string | null {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export type DataExtraida = { iso: string; origem: string } | null;

/**
 * Extrai a data de PUBLICAÇÃO da página da matéria. Ordem de confiança:
 * meta article:published_time → JSON-LD datePublished → itemprop →
 * <time datetime> → meta date/DC.date → data no texto "Publicado em" →
 * data no caminho da URL. Nunca usa data de modificação como publicação.
 */
export function extrairDataPublicacao(html: string, url: string): DataExtraida {
  const head = html.slice(0, 250_000);
  const metas: Array<[RegExp, string]> = [
    [/<meta[^>]+(?:property|name)=["']article:published_time["'][^>]+content=["']([^"']+)["']/i, "meta_article"],
    [/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']article:published_time["']/i, "meta_article"],
    [/"datePublished"\s*:\s*"([^"]+)"/i, "jsonld"],
    [/itemprop=["']datePublished["'][^>]+(?:content|datetime)=["']([^"']+)["']/i, "itemprop"],
    [/(?:content|datetime)=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i, "itemprop"],
    [/<meta[^>]+(?:property|name)=["'](?:og:published_time|publish[-_]?date|pubdate|date|DC\.date(?:\.issued)?|dcterms\.created)["'][^>]+content=["']([^"']+)["']/i, "meta_date"],
    [/<time[^>]+datetime=["']([^"']+)["']/i, "time_tag"],
  ];
  for (const [re, origem] of metas) {
    const m = head.match(re);
    const iso = normalizarIso(m?.[1]);
    if (iso) return { iso, origem };
  }
  const isoTexto = dataNoTexto(head);
  if (isoTexto) return { iso: isoTexto, origem: "texto" };

  const doCaminho = extrairDataDaUrl(url);
  if (doCaminho) return { iso: doCaminho, origem: "url" };
  return null;
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function porExtenso(dd: string, mes: string, aaaa: string, hh?: string, mi?: string): string | null {
  const m = MESES[mes.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
  if (!m) return null;
  return paraIso(`${aaaa}-${String(m).padStart(2, "0")}-${dd.padStart(2, "0")}T${(hh ?? "12").padStart(2, "0")}:${mi ?? "00"}:00-03:00`);
}

const ROTULO = String.raw`(?:publicad[oa]|postad[oa]|data de publica[cç][aã]o|publica[cç][aã]o)\s*(?:em)?\s*:?\s*[^0-9<]{0,25}?`;
const HORA = String.raw`(?:\s*(?:às|as|-|,)?\s*(\d{1,2})[:h](\d{2}))?`;
const MES = String.raw`(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)`;

/**
 * Data no texto da página, SÓ com rótulo de publicação ou no formato de
 * cabeçalho de matéria. De propósito ignora "Cidade, quinta-feira, 22 de
 * outubro de 2026" (data de HOJE no topo do site — aceitar isso faria
 * qualquer matéria velha passar como "do dia") e "Data: ..." solto (costuma
 * ser data de evento).
 */
function dataNoTexto(html: string): string | null {
  const t = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&ccedil;/g, "ç").replace(/&atilde;/g, "ã").replace(/&aacute;/g, "á")
    .replace(/\s+/g, " ");
  // "Publicado em: 02/10/2026 11:25", "Publicação: 19/10/2026 14h41"
  let m = t.match(new RegExp(`${ROTULO}(\\d{1,2}\\/\\d{1,2}\\/\\d{4}${HORA.replace(/\((?!\?)/g, "(?:")})`, "i"));
  if (m) return normalizarIso(m[1]);
  // "Data de Publicação: 21 de outubro de 2026", "Publicado em 09 de outubro de 2025 às 10:30"
  m = t.match(new RegExp(`${ROTULO}(\\d{1,2}) de ${MES} de (\\d{4})${HORA}`, "i"));
  if (m) return porExtenso(m[1], m[2], m[3], m[4], m[5]);
  // Cabeçalho de matéria com editoria: "Administração - Segunda-feira, 19 de Outubro de 2026"
  m = t.match(new RegExp(String.raw`\s[-–]\s(?:segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?,\s*(\d{1,2}) de ${MES} de (\d{4})`, "i"));
  if (m) return porExtenso(m[1], m[2], m[3]);
  // "Qui, 22/10/2026 - 15:10"
  m = t.match(/\b(?:seg|ter|qua|qui|sex|s[áa]b|dom),\s*(\d{1,2}\/\d{1,2}\/\d{4})(?:\s*-\s*(\d{1,2}:\d{2}))?/i);
  if (m) return normalizarIso(m[2] ? `${m[1]} ${m[2]}` : m[1]);
  return null;
}

/** /2026/10/22/ ou /2026-10-22- no caminho da URL. */
export function extrairDataDaUrl(url: string): string | null {
  const m = url.match(/\/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?:[\/-]|$)/);
  if (!m) return null;
  return normalizarIso(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
}

export function normalizarDataRss(raw: string | null | undefined): string | null {
  return normalizarIso(raw);
}
