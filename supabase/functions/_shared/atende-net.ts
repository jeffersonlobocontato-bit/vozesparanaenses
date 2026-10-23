// Vozes Paranaenses — leitor do Atende.Net (IPM)
//
// Muitas prefeituras do PR publicam notícias no portal Atende.Net da IPM
// (https://{cidade}.atende.net/cidadao/noticia). A página monta a lista com
// Vue, então o leitor de HTML genérico via zero itens — mas os DADOS já vêm
// no HTML estático, em base64:
//
//   lista:   <consulta ... dados="{base64 de JSON}">  → registros[] com
//            codigo, titulo, chamada, data "dd/mm/aaaa hh:mm:ss", url,
//            url_midia (miniatura da foto)
//   matéria: <pagina ... content="{base64 do HTML do corpo}"
//            dados-pagina="{base64 de JSON}"> → corpo, midia_capa, data
//
// Basta um fetch comum (sem JavaScript, sem Firecrawl, sem custo). O HTML é
// ISO-8859-1; o JSON da lista usa escapes \uXXXX e o corpo da matéria vem
// em ISO-8859-1 dentro do base64.
//
// Limite conhecido: a lista estática traz as 10 notícias mais recentes (a
// paginação é por chamada interna). Com dois ciclos por dia, cobre até ~20
// notícias/dia por cidade.

import type { ItemColetado, MetaPagina } from "./coleta.ts";

const UA = "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)";

export function ehAtendeNet(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".atende.net");
  } catch {
    return false;
  }
}

/** URL da listagem de notícias a partir de qualquer URL do portal. */
export function urlListaAtendeNet(url: string): string {
  return `${new URL(url).origin}/cidadao/noticia`;
}

async function baixarLatin1(url: string, timeoutMs = 10_000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) return null;
    return new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** "23/10/2026 14:01:08" (Brasília) → ISO com fuso. */
export function dataAtendeNetParaIso(raw: string | null | undefined): string | null {
  const m = (raw ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, dd, mm, aaaa, hh = "12", mi = "00", ss = "00"] = m;
  return `${aaaa}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
}

type RegistroLista = {
  codigo?: string;
  titulo?: string;
  chamada?: string;
  data?: string;
  url?: string;
  url_portal?: string;
  url_midia?: string | null;
};

/** Extrai os registros da listagem a partir do HTML (exportado para teste). */
export function parseListaAtendeNet(html: string, origin: string): ItemColetado[] {
  const m = html.match(/<consulta\b[^>]*?\sdados=["']([A-Za-z0-9+/=]+)["']/);
  if (!m) return [];
  let json: { registros?: RegistroLista[] };
  try {
    json = JSON.parse(new TextDecoder("utf-8").decode(base64Bytes(m[1])));
  } catch {
    return [];
  }
  return (json.registros ?? [])
    .filter((r) => r.titulo && (r.url || r.url_portal))
    .map((r) => ({
      url: new URL((r.url || r.url_portal) as string, origin).toString(),
      titulo: (r.titulo as string).trim(),
      corpo: (r.chamada ?? "").trim(),
      data: dataAtendeNetParaIso(r.data),
      // A lista só traz a miniatura 400x400: deixa vazio para a coleta
      // buscar a capa grande na página da matéria (que sempre é baixada,
      // porque a chamada é curta).
      imagem: null,
      credito: null,
    }));
}

/** Lista de notícias da prefeitura (10 mais recentes). */
export async function lerListaAtendeNet(urlBase: string): Promise<ItemColetado[]> {
  const lista = urlListaAtendeNet(urlBase);
  const html = await baixarLatin1(lista);
  if (!html) return [];
  return parseListaAtendeNet(html, new URL(lista).origin);
}

function attrBase64(html: string, nome: string): string[] {
  const re = new RegExp(`\\s${nome}=["']([A-Za-z0-9+/=]{20,})["']`, "g");
  return [...html.matchAll(re)].map((m) => m[1]);
}

function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Template Vue embutido no corpo (categorias etc.).
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/<\/(p|div|h\d|li|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Corpo, capa e data da página da matéria (exportado para teste). */
export function parseMateriaAtendeNet(html: string): MetaPagina {
  // Corpo: o maior atributo `content` em base64 (o componente <pagina>).
  const conteudos = attrBase64(html, "content").sort((a, b) => b.length - a.length);
  let corpoCompleto = "";
  if (conteudos[0]) {
    const corpoHtml = new TextDecoder("iso-8859-1").decode(base64Bytes(conteudos[0]));
    corpoCompleto = htmlParaTexto(corpoHtml)
      .replace(/\n?\s*(Imagens Relacionadas|Categorias)[\s\S]*$/, "")
      .trim();
  }

  let imagem: string | null = null;
  let data: string | null = null;
  const dadosPagina = attrBase64(html, "dados-pagina")[0];
  if (dadosPagina) {
    try {
      const j = JSON.parse(new TextDecoder("utf-8").decode(base64Bytes(dadosPagina))) as { midia_capa?: string; data?: string };
      imagem = j.midia_capa || null;
      data = dataAtendeNetParaIso(j.data);
    } catch {
      // segue sem
    }
  }
  if (!imagem) {
    imagem = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
  }
  return { imagem, credito: null, corpoCompleto, data, dataOrigem: data ? "atende_net" : null };
}

export async function lerMateriaAtendeNet(url: string): Promise<MetaPagina> {
  const html = await baixarLatin1(url, 8000);
  if (!html) return { imagem: null, credito: null, corpoCompleto: "", data: null, dataOrigem: null };
  return parseMateriaAtendeNet(html);
}
