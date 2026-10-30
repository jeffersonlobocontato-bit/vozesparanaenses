// Vozes Paranaenses — imagens sem risco de direito autoral (out/2026)
//
// Duas fontes de imagem para matéria de PORTAL que veio sem foto liberada:
//
// 1. imagem temática por IA — último recurso para assunto geral (clima,
//    meio ambiente, saúde preventiva...), depois de tentar uma foto real
//    de licença livre do tema (_shared/foto-tema.ts). Gerada SÓ a partir do
//    tema: nunca a partir da foto de outro veículo (recriar foto de
//    terceiro com "pequenas variações" continua sendo obra derivada).
//    Estilo fotográfico realista de cena genérica, sem pessoas
//    identificáveis, sem crianças, sem marcas, sem reproduzir o fato.
//    Sempre identificada como IA.
//
// 2. foto real da cidade — quando a notícia fala da cidade como um todo.
//    Buscada no Wikimedia Commons, só com licença livre (CC0, domínio
//    público, CC BY, CC BY-SA) e com crédito do autor + licença. A cidade é
//    conferida pela categoria do Commons: "{Cidade} (Paraná)" ou "{Cidade}",
//    e a categoria só vale se estiver em "Municipalities in Paraná" — há
//    cidades com o mesmo nome em outros estados (Palmeira/SC, Toledo/
//    Espanha...). Fica em cache em cidades.foto_geral_url.
//    (Busca no Google não serve: foto achada no Google tem dono.)

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMG_MODEL = "google/gemini-2.5-flash-image";
const UA = "VozesParanaensesBot/1.0 (+https://vozesparanaenses.com.br; contato@vozesparanaenses.com.br)";

export const CREDITO_IA = "Imagem ilustrativa gerada por IA (Vozes Paranaenses)";

export function promptIlustracao(tema: string): string {
  return `Fotografia editorial realista, estilo fotojornalismo de jornal brasileiro: luz natural, profundidade de campo, cores naturais, enquadramento 16:9, aparência de foto de câmera profissional (NÃO ilustração, NÃO desenho, NÃO ícones, NÃO 3D estilizado).
Mostre uma CENA GENÉRICA e plausível do tema no contexto do Paraná/Brasil (ex.: chuva forte numa rua, céu de tempestade, lavoura, rodovia, fachada de escola, corredor de hospital).
Regras: sem pessoas identificáveis (se houver gente, distante, de costas ou desfocada), sem rostos, sem crianças, sem texto, sem letras, sem placas legíveis, sem logotipos, sem marcas, sem bandeiras, sem violência, sem armas, sem sangue, sem vítimas.
Não represente o acontecimento específico da notícia nem um lugar real reconhecível: é uma imagem ilustrativa do TEMA.
Tema: ${tema.slice(0, 400)}`;
}

// deno-lint-ignore no-explicit-any
type Sb = any;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  const bin = atob(clean);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Polícia, crime e fiscalização NUNCA ganham imagem de IA (regra do editor,
// 30/10/2026): há fotos reais e públicas das corporações (banco genérico em
// _shared/foto-generica.ts). Sem foto real, a matéria sai sem imagem ou vira
// nota na coluna da região.
const TEMA_POLICIAL = /\b(polici|pm\b|pmpr|prf\b|pcpr|pf\b|guarda municipal|gcm\b|delegad|delegacia|viatura|blitz|apreen|apreend|pres[oa]s?\b|prisao|prend|flagrante|operacao (policial|integrada|conjunta)|trafic|contrabando|descaminho|crime|criminos|homicid|assassin|assalt|roub|furt|estelion|golpe|suspeit|mandado|investigac|fiscalizacao (de transito|nas rodovias|em rodovias)|bombeir|siate|samu|acidente|colisao|atropel)/;

export function ehTemaPolicial(texto: string, categoriaSlug?: string | null): boolean {
  if (categoriaSlug === "seguranca") return true;
  return TEMA_POLICIAL.test(texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

/** Gera a ilustração temática, sobe no storage e devolve a URL pública. */
export async function gerarIlustracaoTematica(p: {
  sb: Sb;
  aiKey: string;
  articleId: string;
  tema: string;
  categoriaSlug?: string | null;
}): Promise<string | null> {
  if (ehTemaPolicial(p.tema, p.categoriaSlug)) return null;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.aiKey}` },
      body: JSON.stringify({
        model: IMG_MODEL,
        messages: [{ role: "user", content: [{ type: "text", text: promptIlustracao(p.tema) }] }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const msg = j?.choices?.[0]?.message;
    const url: string | undefined = msg?.images?.[0]?.image_url?.url ??
      (typeof msg?.content === "string" && msg.content.startsWith("data:image") ? msg.content : undefined);
    if (!url?.startsWith("data:image")) return null;
    const mime = url.slice(5, url.indexOf(";")) || "image/png";
    const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
    const path = `${p.articleId}/ilustracao-ia-${Date.now().toString(36)}.${ext}`;
    const { error } = await p.sb.storage.from("article-covers").upload(path, base64ToBytes(url), { contentType: mime, upsert: true });
    if (error) return null;
    return p.sb.storage.from("article-covers").getPublicUrl(path).data.publicUrl as string;
  } catch {
    return null;
  }
}

// Inclui versões com jurisdição ("CC BY 3.0 br", "CC BY-SA 3.0 de").
const LICENCAS_LIVRES = /^(cc0|public domain|pd|cc by(-sa)?( \d(\.\d)?)?( [a-z]{2,3})?)$/i;
const NAO_E_VISTA = /(flag|bandeira|coat of arms|bras[aã]o|\bmaps?\b|mapa|logo|cemit|cemetery|grave|t[uú]mulo|interior|portrait|retrato|selo|seal|diagram|inaugura|evento|event|festa|festival|show|people|pessoas|reuni[aã]o|meeting|montage|montagem|escola|school|infantil|parquinho|hospital)/i;
const E_VISTA = /(vista|\bview|panorama|panor[aâ]mica|aerial|a[eé]rea|skyline|cityscape|downtown|centro da cidade|[-,] centro\b|centro noturno|sobrevoo)/i;
const CAT_VISTA = /(views of|aerial photographs of|skylines of|panoramics of)/i;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php?format=json&";

type CommonsInfo = {
  title: string;
  imageinfo?: Array<{
    width?: number;
    height?: number;
    thumburl?: string;
    url?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

function semTags(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export type FotoCidade = { url: string; credito: string; titulo: string };

/**
 * Escolhe a foto de VISTA da cidade entre arquivos da categoria dela
 * (exportado para teste): licença livre, JPEG paisagem >= 1000px, sem
 * bandeira/mapa/evento/pessoas, com "vista/panorama/aérea/centro" no título
 * ou numa categoria "Views of…/Aerial photographs of…".
 */
export function escolherFotoCommons(pages: CommonsInfo[]): FotoCidade | null {
  let melhor: { foto: FotoCidade; score: number } | null = null;
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii?.width || !ii.height) continue;
    const meta = ii.extmetadata ?? {};
    const licenca = semTags(meta.LicenseShortName?.value);
    if (!LICENCAS_LIVRES.test(licenca)) continue;
    if (!/\.jpe?g$/i.test(p.title)) continue;
    if (ii.width < 1000 || ii.width < ii.height * 1.2) continue;
    const categorias = semTags(meta.Categories?.value);
    if (NAO_E_VISTA.test(`${p.title} ${categorias}`)) continue;
    const catVista = CAT_VISTA.test(categorias);
    if (!E_VISTA.test(p.title) && !catVista) continue;
    const score = Math.min(ii.width, 4000) / 1000 + (/skyline|panorama|aerial|a[eé]rea|vista d[aeo]/i.test(p.title) || catVista ? 3 : 0);
    if (!melhor || score > melhor.score) {
      const autor = semTags(meta.Artist?.value).slice(0, 80) || "autor desconhecido";
      melhor = {
        score,
        foto: {
          url: ii.thumburl ?? ii.url ?? "",
          credito: `Foto: ${autor} / Wikimedia Commons (${licenca})`,
          titulo: p.title.replace(/^File:/, ""),
        },
      };
    }
  }
  return melhor && melhor.foto.url ? melhor.foto : null;
}

async function commonsJson(params: string): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(COMMONS_API + params, { signal: ctrl.signal, headers: { "user-agent": UA } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Categoria da cidade NO PARANÁ: "{Cidade} (Paraná)" quando o nome existe
 * em outros estados, ou "{Cidade}" — só vale se a categoria estiver em
 * "Municipalities in Paraná" (evita pegar Palmeira/SC, Toledo/Espanha...).
 */
async function categoriaDaCidadeNoParana(cidade: string): Promise<string | null> {
  for (const nome of [`${cidade} (Paraná)`, cidade]) {
    const j = await commonsJson(`action=query&prop=categories&cllimit=50&titles=${encodeURIComponent(`Category:${nome}`)}`);
    const pagina = Object.values((j?.query as { pages?: Record<string, unknown> } | undefined)?.pages ?? {})[0] as
      | { missing?: string; categories?: Array<{ title: string }> }
      | undefined;
    if (!pagina || pagina.missing !== undefined) continue;
    if ((pagina.categories ?? []).some((c) => /(Municipalities|Cities) in Paraná|Paraná \(state\)/i.test(c.title))) return nome;
  }
  return null;
}

async function buscarCommons(cidade: string): Promise<FotoCidade | null> {
  const cat = await categoriaDaCidadeNoParana(cidade);
  if (!cat) return null;
  const cats = [cat, `Views of ${cat}`, `Aerial photographs of ${cat}`, `Skylines of ${cat}`, `Panoramics of ${cat}`].join("|");
  const j = await commonsJson(
    "action=query&generator=search&gsrnamespace=6&gsrlimit=50" +
      `&gsrsearch=${encodeURIComponent(`incategory:"${cats}" filetype:bitmap`)}` +
      "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600",
  );
  const pages = Object.values((j?.query as { pages?: Record<string, CommonsInfo> } | undefined)?.pages ?? {});
  return escolherFotoCommons(pages);
}

/**
 * Foto geral da cidade: a cadastrada em cidades.foto_geral_url, ou a melhor
 * do Commons (que fica em cache na cidade para as próximas matérias).
 */
export async function fotoDaCidade(sb: Sb, cidade: { slug: string; nome: string }): Promise<FotoCidade | null> {
  const { data } = await sb.from("cidades").select("foto_geral_url, foto_geral_credito").eq("slug", cidade.slug).maybeSingle();
  const row = data as { foto_geral_url?: string | null; foto_geral_credito?: string | null } | null;
  if (row?.foto_geral_url) {
    return { url: row.foto_geral_url, credito: row.foto_geral_credito ?? `Foto: vista de ${cidade.nome}`, titulo: cidade.nome };
  }
  const achada = await buscarCommons(cidade.nome);
  if (achada) {
    await sb.from("cidades").update({ foto_geral_url: achada.url, foto_geral_credito: achada.credito }).eq("slug", cidade.slug);
  }
  return achada;
}

// ---------------------------------------------------------------------
// Busca por TEMA no Commons (analista de imagem de nacional/internacional)
// ---------------------------------------------------------------------

export type FotoCandidata = {
  url: string;
  credito: string;
  titulo: string;
  licenca: string;
  autor: string;
  descricao: string;
};

// Arquivos que não servem de foto de capa (mapas, brasões, diagramas...).
const NAO_E_FOTO_DE_CAPA = /(\bmaps?\b|mapa|coat of arms|bras[aã]o|logo|diagram|diagrama|chart|gr[aá]fico|signature|assinatura|seal\b|selo|icon|cartoon|caricatur)/i;

/**
 * Filtra resultados do Commons para candidatas a capa (exportado para
 * teste): licença livre, JPEG, paisagem, >= 1000px, sem mapa/brasão/logo.
 */
export function filtrarCandidatasCommons(pages: CommonsInfo[], max = 4): FotoCandidata[] {
  const out: Array<FotoCandidata & { score: number }> = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii?.width || !ii.height) continue;
    const meta = ii.extmetadata ?? {};
    const licenca = semTags(meta.LicenseShortName?.value);
    if (!LICENCAS_LIVRES.test(licenca)) continue;
    if (!/\.jpe?g$/i.test(p.title)) continue;
    if (ii.width < 1000 || ii.width < ii.height * 1.15) continue;
    const categorias = semTags(meta.Categories?.value);
    if (NAO_E_FOTO_DE_CAPA.test(`${p.title} ${categorias}`)) continue;
    const autor = semTags(meta.Artist?.value).slice(0, 80) || "autor desconhecido";
    out.push({
      url: ii.thumburl ?? ii.url ?? "",
      credito: `Foto: ${autor} / Wikimedia Commons (${licenca})`,
      titulo: p.title.replace(/^File:/, ""),
      licenca,
      autor,
      descricao: semTags(meta.ImageDescription?.value).slice(0, 300),
      score: Math.min(ii.width, 4000) / 1000,
    });
  }
  return out
    .filter((c) => c.url)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ score: _s, ...c }) => c);
}

export async function buscarCommonsTema(busca: string, max = 4): Promise<FotoCandidata[]> {
  const j = await commonsJson(
    "action=query&generator=search&gsrnamespace=6&gsrlimit=30" +
      `&gsrsearch=${encodeURIComponent(`${busca} filetype:bitmap`)}` +
      "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600",
  );
  const pages = Object.values((j?.query as { pages?: Record<string, CommonsInfo> } | undefined)?.pages ?? {});
  return filtrarCandidatasCommons(pages, max);
}

/** Copia uma imagem (de licença livre) para o storage e devolve a URL pública. */
export async function copiarImagemParaStorage(sb: Sb, srcUrl: string, path: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(srcUrl, { signal: ctrl.signal, headers: { "user-agent": UA } });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!/^image\//.test(mime) || buf.byteLength <= 1024) return null;
    const { error } = await sb.storage.from("article-covers").upload(path, buf, { contentType: mime, upsert: true });
    if (error) return null;
    return sb.storage.from("article-covers").getPublicUrl(path).data.publicUrl as string;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
