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

/**
 * Prefeitura: vale a notícia de hoje OU de ontem. A coleta roda às 12h e às
 * 18h; o release publicado depois das 18h (ou num ciclo que falhou) só
 * aparece no dia seguinte e, com "só hoje", se perdia para sempre. O que já
 * foi coletado ontem não entra de novo (hash da URL + título).
 */
export function ehDeHojeOuOntem(iso: string | null | undefined, agora: Date = new Date()): boolean {
  if (ehDoDia(iso, agora)) return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  return diaSaoPaulo(d) === diaSaoPaulo(new Date(agora.getTime() - 86400_000));
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
    [/<meta[^>]+(?:property|name)=["'](?:og:)?article:published_time["'][^>]+content=["']([^"']+)["']/i, "meta_article"],
    [/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?article:published_time["']/i, "meta_article"],
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
  const isoTitulo = dataJuntoAoTitulo(html);
  if (isoTitulo) return { iso: isoTitulo, origem: "titulo" };

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
function textoPlano(html: string): string {
  return decodificarEntidades(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ");
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ordm: "º", ordf: "ª",
  ccedil: "ç", Ccedil: "Ç", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú",
  acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", agrave: "à", Agrave: "À",
};

function decodificarEntidades(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nome) => ENTIDADES[nome] ?? m);
}

function dataNoTexto(html: string): string | null {
  const t = textoPlano(html);
  // "Publicado em: 02/10/2026 11:25", "Publicação: 19/10/2026 14h41"
  let m = t.match(new RegExp(`${ROTULO}(\\d{1,2}\\/\\d{1,2}\\/\\d{4}${HORA.replace(/\((?!\?)/g, "(?:")})`, "i"));
  if (m) return normalizarIso(m[1]);
  // "Data de publicação: 17:10 sexta-feira, 23/10/2026" (hora antes da data)
  m = t.match(/data de publica[cç][aã]o\s*:?\s*(\d{1,2}:\d{2})\s*(?:[a-zçá]+(?:-feira)?,?\s*)?(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (m) return normalizarIso(`${m[2]} ${m[1]}`);
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

const MES_CURTO: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const MES_QUALQUER = String.raw`(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?`;

/**
 * Data de matéria que não traz rótulo nem metadado: a data COLADA AO TÍTULO
 * da própria matéria (og:title / <title>) — "Título 22 de Outubro de 2026",
 * "Administração 23 de outubro de 2026 Título", "OUT 22 22 OUT 2026 Título",
 * e o padrão "Compartilhe: 22 Out, 2026 Por:". Data longe do título (a de
 * HOJE no topo do site, a de "Leia mais") não conta.
 */
export function dataJuntoAoTitulo(html: string): string | null {
  const corpo = html.replace(/^[\s\S]*?<\/head>/i, "");
  const t = textoPlano(corpo);

  // Plataforma "noticias_site": "Compartilhe: 22 Dez, 2025 Por:"
  let m = t.match(new RegExp(String.raw`Compartilhe:?\s*(\d{1,2})\s*\/?\s*${MES_QUALQUER},?\s*\/?\s*(20\d{2})\s*Por\b`, "i"));
  if (m) return dataDeMesCurto(m[1], m[2], m[3]);
  // Plataformas "/portal/noticias" e "/noticiasView": "Notícia OUT 23 23 OUT 2026"
  m = t.match(/Not[íi]cias?\s+(?:[A-Za-zÀ-ú]+\s+){0,3}?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\d{1,2}\s+(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(20\d{2})/i);
  if (m) return dataDeMesCurto(m[1], m[2], m[3]);

  const titulo = tituloDaMateria(html);
  if (!titulo) return null;
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ");
  const chave = norm(titulo).trim().slice(0, 40).trim();
  if (chave.length < 15) return null;
  const tn = norm(t);
  // Índices de tn e t não batem 1:1 (acentos/pontuação viram espaço), então
  // trabalha só sobre o texto normalizado — as datas sobrevivem à normalização.
  const i = tn.indexOf(chave);
  if (i < 0) return null;
  // O título da página pode vir em caixa alta ou com o nome do site — a
  // janela "depois" começa no fim da chave e cobre o resto do título + 160.
  const fim = i + chave.length;
  const antes = tn.slice(Math.max(0, i - 120), i);
  const depois = tn.slice(fim, fim + Math.max(0, norm(titulo).trim().length - chave.length) + 160);

  const datas = (trecho: string) => {
    const achadas: Array<{ pos: number; iso: string | null }> = [];
    const re = new RegExp(
      String.raw`(\d{1,2}) (\d{1,2}) (20\d{2})(?!\d)|(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) (?:de )?(20\d{2})|(\d{1,2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]* (20\d{2})`,
      "g",
    );
    let x: RegExpExecArray | null;
    while ((x = re.exec(trecho))) {
      let iso: string | null = null;
      if (x[1]) {
        // dd/mm/aaaa vira "dd mm aaaa" na normalização; exige que no texto
        // original exista a forma com barra (não é número solto).
        if (!t.includes(`${x[1]}/${x[2]}/${x[3]}`)) continue;
        iso = normalizarIso(`${x[1]}/${x[2]}/${x[3]}`);
      } else if (x[4]) iso = porExtenso(x[4], x[5], x[6]);
      else if (x[7]) iso = dataDeMesCurto(x[7], x[8], x[9]);
      if (iso) achadas.push({ pos: x.index, iso });
    }
    return achadas;
  };
  // Mais perto do título primeiro: depois dele, e logo antes dele.
  const dDepois = datas(depois)[0];
  const lAntes = datas(antes);
  const dAntes = lAntes[lAntes.length - 1];
  if (dDepois && (!dAntes || dDepois.pos <= antes.length - dAntes.pos)) return dDepois.iso;
  return dAntes?.iso ?? dDepois?.iso ?? null;
}

function dataDeMesCurto(dd: string, mes: string, aaaa: string): string | null {
  const m = MES_CURTO[mes.toLowerCase().slice(0, 3)];
  if (!m) return null;
  return paraIso(`${aaaa}-${String(m).padStart(2, "0")}-${dd.padStart(2, "0")}T12:00:00-03:00`);
}

function tituloDaMateria(html: string): string | null {
  const og = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']{10,})["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+(?:property|name)=["']og:title["']/i);
  const tt = og ? null : html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const bruto = og?.[1] ?? tt?.[1];
  if (!bruto) return null;
  // "Site - Notícia - Título" / "Título - PREFEITURA DE X" → o pedaço mais longo.
  const partes = decodificarEntidades(bruto).split(/\s+[-|–]\s+/).map((p) => p.trim());
  return partes.sort((a, b) => b.length - a.length)[0] ?? null;
}
