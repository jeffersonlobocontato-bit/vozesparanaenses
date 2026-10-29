// Vozes Paranaenses — regras de coleta comuns a scrape-source (veículos) e
// scrape-prefeitura (assessorias oficiais).
//
// Ciclos fixos por frente (Brasília), alternados para girar a home:
//   portais 10h, 16h e 21h · prefeituras 12h e 18h
// (curadoria — nacional/internacional 7h e 14h, tecnologia 14h, esportes
// 21h — é por tempo decorrido; quem marca a hora é o cron, migration 076).
// Cada ciclo fica aberto por
// JANELA_HORAS; o cron chama a função várias vezes dentro da janela e cada
// chamada processa um LOTE de fontes ainda não coletadas NESTE ciclo — é o
// que permite varrer 800+ fontes sem estourar o tempo de uma edge function.
//
// Por fonte, entram TODAS as notícias publicadas HOJE (até MAX_POR_FONTE),
// não mais "1 notícia por ciclo". Sem data identificável ou de outro dia =
// descartada. Repetição é barrada pelo hash (url normalizada + título).

import { ehDeHojeOuOntem, ehDoDia, extrairDataDaUrl, horaSaoPaulo, inicioDoCiclo } from "./data-publicacao.ts";
import { detectarCidade, type Cidade } from "./cidades.ts";
import { classificarFoto } from "./foto-credito.ts";

export const CICLOS_PREFEITURAS = [12, 18];
export const CICLOS_PORTAIS = [10, 16, 21];
/** Padrão (prefeituras). */
export const CICLOS = CICLOS_PREFEITURAS;
export const JANELA_HORAS = 2;
export const MAX_POR_FONTE = 15;
// Pausa entre páginas de matéria do MESMO site: sites de prefeitura são
// pequenos e alguns pedem crawl-delay no robots.txt.
export const PAUSA_ENTRE_PAGINAS_MS = 1000;
// Listagens vêm da mais nova para a mais antiga: depois de N matérias seguidas
// de outro dia, o resto também é velho — para de baixar páginas.
export const PARAR_APOS_VELHAS = 3;
// Teto de páginas de matéria por fonte num ciclo, para quem passa `maxPaginas`
// (prefeituras: listagem sem data obriga a abrir cada matéria).
export const MAX_PAGINAS_PREFEITURA = 10;

export type FonteColeta = {
  id: string;
  nome: string;
  regiao_id: string | null;
  cidade_slug?: string | null;
  abrangencia?: string | null;
  frequencia_horas: number | null;
  ultimo_scrape_em: string | null;
};

export type ItemColetado = {
  url: string;
  titulo: string;
  corpo: string;
  data: string | null;
  imagem?: string | null;
  credito?: string | null;
};

export type MetaPagina = { imagem: string | null; credito: string | null; corpoCompleto: string; data: string | null; dataOrigem: string | null };

/** Ciclo aberto agora (hora de início), ou null fora das janelas. */
export function cicloAtual(agora: Date = new Date(), ciclos: number[] = CICLOS): number | null {
  const h = horaSaoPaulo(agora);
  return ciclos.find((c) => h >= c && h < c + JANELA_HORAS) ?? null;
}

/** A fonte ainda não foi coletada no ciclo aberto? */
export function fonteElegivel(f: FonteColeta, agora: Date = new Date(), ciclos: number[] = CICLOS): boolean {
  if (f.frequencia_horas != null) {
    // Exceção legada (fontes de curadoria nacional): por tempo decorrido.
    if (!f.ultimo_scrape_em) return true;
    return agora.getTime() - new Date(f.ultimo_scrape_em).getTime() >= f.frequencia_horas * 3600_000;
  }
  const ciclo = cicloAtual(agora, ciclos);
  if (ciclo == null) return false;
  if (!f.ultimo_scrape_em) return true;
  return new Date(f.ultimo_scrape_em).getTime() < inicioDoCiclo(ciclo, agora).getTime();
}

/** Remove parâmetros de rastreio para a mesma matéria não entrar duas vezes. */
/**
 * Logomarca, brasão, nome da prefeitura ou imagem padrão do site (og:image
 * de reserva) — pelo NOME do arquivo. Caso Toledo (28/10/2026):
 * prefeitura_municipal_de_toledo_h_preto.png virou capa de 7 matérias.
 * Regra da casa: sem foto de verdade, a matéria sai só com texto.
 */
export function ehLogomarcaPorUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  let arq = u.split(/[?#]/)[0].split("/").pop() ?? "";
  try { arq = decodeURIComponent(arq); } catch (_) { /* nome cru */ }
  arq = arq.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/(logo|logotipo|logomarca|identidade[-_ ]?visual|marca[-_ ]?(d[aeo]|prefeitura|oficial)|cabecalho|favicon|selo[-_.]|og[-_]?image|imagem[-_]?padrao|default|placeholder|compartilhamento|share[-_]?image|^cropped-|prefeitura[-_ ]?municipal|municipio[-_ ]de|_h_(preto|branco|cor)|vertical[-_](preto|branco|cor))/.test(arq)
    || /\.gif$/.test(arq)) return true;
  // Palavras fracas (brasão, horizontal, header) só em nome curto: em
  // "Festival-Cervejeiro-em-Brasao-Dourado" Brasão é o nome do lugar.
  const partes = arq.replace(/\.[a-z0-9]+$/, "").split(/[-_ .]+/).filter(Boolean).length;
  return partes <= 4 && /(brasao|horizontal|header)/.test(arq);
}

/** Descarta o que não é foto de matéria: emoji, ícone, logo, avatar, pixel, SVG. */
export function imagemValida(u: string | null | undefined): boolean {
  if (!u) return false;
  if (/^data:/i.test(u) || ehLogomarcaPorUrl(u)) return false;
  if (/s\.w\.org\/images\/core\/emoji|\/emoji\/|gravatar\.com|\/(sprite|logo|icon|favicon|avatar|blank|placeholder)[^/]*$|1x1|pixel\.|\.svg(\?|$)/i.test(u)) return false;
  // Miniatura explícita (?w=200, -150x150) não serve de capa.
  if (/[?&]w=(\d{1,2}|1\d\d|2[0-4]\d)(&|$)|-\d{2,3}x\d{2,3}\.(jpe?g|png|webp)/i.test(u)) return false;
  return true;
}

export function normalizarUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|amp$|ref$|origem$)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return u.trim();
  }
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type RelatorioFonte = {
  fonte: string;
  total: number;
  inseridas: number;
  duplicadas: number;
  sem_data: number;
  fora_do_dia: number;
  fotos: Record<string, number>;
  orcamento_estourou?: boolean;
  erro?: string;
};

/**
 * Processa os itens já listados de uma fonte: valida data do dia, enriquece
 * com a página da matéria, detecta cidade/região pela CIDADE CITADA,
 * classifica a foto e grava em raw_articles.
 */
export async function processarItensDaFonte(p: {
  // deno-lint-ignore no-explicit-any
  sb: any;
  fonte: FonteColeta;
  itens: ItemColetado[];
  cidades: Cidade[];
  nomesVeiculos: string[];
  buscarPagina: (url: string) => Promise<MetaPagina>;
  dentroDoOrcamento: () => boolean;
  // Prefeitura: foto sempre liberada (material institucional). Veículos
  // seguem a regra do crédito.
  fotoSempreLiberada?: boolean;
  maxPaginas?: number;
  agora?: Date;
  // Prefeitura: aceita também a notícia de ontem (ver ehDeHojeOuOntem).
  aceitarOntem?: boolean;
}): Promise<RelatorioFonte> {
  const agora = p.agora ?? new Date();
  const valeAData = (d: string) => (p.aceitarOntem ? ehDeHojeOuOntem(d, agora) : ehDoDia(d, agora));
  const r: RelatorioFonte = { fonte: p.fonte.nome, total: p.itens.length, inseridas: 0, duplicadas: 0, sem_data: 0, fora_do_dia: 0, fotos: {} };

  let paginasBaixadas = 0;
  let velhasSeguidas = 0;
  for (const it of p.itens) {
    if (r.inseridas >= MAX_POR_FONTE) break;
    if (velhasSeguidas >= PARAR_APOS_VELHAS) break;
    if (!p.dentroDoOrcamento()) { r.orcamento_estourou = true; break; }

    // Data da listagem (RSS) ou do caminho da URL: se já prova que é de
    // outro dia, descarta antes de baixar a página.
    let data = it.data ?? extrairDataDaUrl(it.url);
    let dataOrigem: string | null = it.data ? "listagem" : data ? "url" : null;
    if (data && !valeAData(data)) { r.fora_do_dia++; velhasSeguidas++; continue; }

    const url = normalizarUrl(it.url);
    const hash = await sha256(url + "|" + it.titulo.trim().toLowerCase());
    const { data: jaExiste } = await p.sb.from("raw_articles").select("id").eq("hash_conteudo", hash).maybeSingle();
    if (jaExiste) { r.duplicadas++; continue; }

    let imagem = imagemValida(it.imagem) ? it.imagem! : null;
    let credito = it.credito ?? null;
    let corpo = it.corpo ?? "";
    const precisaPagina = !data || !imagem || !credito || corpo.length < 400;
    if (precisaPagina && paginasBaixadas >= (p.maxPaginas ?? Infinity)) break;
    if (precisaPagina) {
      try {
        if (paginasBaixadas++ > 0) await new Promise((ok) => setTimeout(ok, PAUSA_ENTRE_PAGINAS_MS));
        const meta = await p.buscarPagina(it.url);
        // A imagem da PÁGINA (og:image) é a da matéria; a da listagem pode ser
        // de outra notícia ao lado (caso Gaza/CNN, 24/10) ou um emoji (Gazeta).
        if (imagemValida(meta.imagem)) {
          if (meta.imagem !== imagem) credito = meta.credito ?? null;
          imagem = meta.imagem;
        }
        if (!credito && meta.credito) credito = meta.credito;
        if (meta.corpoCompleto.length > corpo.length) corpo = meta.corpoCompleto;
        // Data da própria página da matéria tem precedência sobre a da URL.
        if (meta.data && (dataOrigem === null || dataOrigem === "url")) { data = meta.data; dataOrigem = meta.dataOrigem; }
      } catch (e) {
        console.warn(`[${p.fonte.nome}] página ${it.url} falhou: ${(e as Error).message}`);
      }
    }

    // Validador do dia: sem data = não publica (não dá pra garantir que é de hoje).
    if (!data) { r.sem_data++; continue; }
    if (!valeAData(data)) { r.fora_do_dia++; velhasSeguidas++; continue; }
    velhasSeguidas = 0;

    const det = detectarCidade(it.titulo, corpo, p.cidades, p.fonte);
    const fotoStatus = p.fotoSempreLiberada && imagem ? "autorizada" : classificarFoto(imagem, credito, p.nomesVeiculos);
    r.fotos[fotoStatus] = (r.fotos[fotoStatus] ?? 0) + 1;

    const { error } = await p.sb.from("raw_articles").insert({
      fonte_id: p.fonte.id,
      // Região = da cidade citada. Fonte só vale como fallback (e a fonte
      // estadual nem isso — fica com a região dela só para agrupamento,
      // sem cidade; a cidade_principal da IA corrige depois).
      regiao_id: det?.regiao_id ?? p.fonte.regiao_id,
      cidade_detectada_slug: det?.slug ?? null,
      regiao_detectada_id: det?.regiao_id ?? null,
      url,
      titulo: it.titulo,
      corpo_limpo: corpo,
      hash_conteudo: hash,
      data_publicacao_original: data,
      data_origem: dataOrigem,
      imagem_original_url: imagem,
      imagem_credito: credito,
      foto_status: fotoStatus,
      processado: false,
    });
    if (error) {
      if (error.code === "23505") { r.duplicadas++; continue; }
      console.error(`[${p.fonte.nome}] insert error`, error.message);
      continue;
    }
    r.inseridas++;
  }

  // Fonte cortada pelo orçamento de tempo NÃO conta como coletada no ciclo:
  // a próxima chamada do cron volta nela (o hash evita reinserir o que já entrou).
  await p.sb.from("fontes").update({
    ...(r.orcamento_estourou ? {} : { ultimo_scrape_em: agora.toISOString() }),
    ultimo_ciclo: { ...r, em: agora.toISOString() },
  }).eq("id", p.fonte.id);
  return r;
}

/**
 * Ordem da fila: quem foi TENTADO há mais tempo vem primeiro (última
 * tentativa = ultimo_ciclo.em, ou a última coleta concluída). Antes a fila
 * usava só a coleta concluída: fonte que travava nunca concluía, voltava
 * para o começo a cada chamada e bloqueava as demais (24/10/2026: 16
 * prefeituras travadas seguraram as outras 172 por um dia inteiro).
 */
export function ordenarPorTentativa<T extends { ultimo_scrape_em: string | null; ultimo_ciclo?: { em?: string } | null }>(fontes: T[]): T[] {
  const t = (f: T) => {
    const a = f.ultimo_ciclo?.em ? Date.parse(f.ultimo_ciclo.em) : 0;
    const b = f.ultimo_scrape_em ? Date.parse(f.ultimo_scrape_em) : 0;
    return Math.max(a || 0, b || 0);
  };
  return [...fontes].sort((x, y) => t(x) - t(y));
}

export const LIMITE_POR_FONTE_MS = 45_000;

/**
 * Roda a coleta de UMA fonte com tempo-limite próprio. Estourou: registra a
 * tentativa (com o motivo) para a fonte ir para o fim da fila.
 */
export async function comLimiteDeTempo<R>(
  // deno-lint-ignore no-explicit-any
  sb: any,
  fonte: { id: string; nome: string },
  tarefa: () => Promise<R>,
  vazio: (motivo: string) => R,
): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<"tempo">((ok) => { timer = setTimeout(() => ok("tempo"), LIMITE_POR_FONTE_MS); });
  try {
    const r = await Promise.race([tarefa(), limite]);
    if (r !== "tempo") return r as R;
  } catch (e) {
    const motivo = (e as Error).message || "erro";
    await sb.from("fontes").update({ ultimo_ciclo: { fonte: fonte.nome, erro: motivo, em: new Date().toISOString() } }).eq("id", fonte.id);
    return vazio(motivo);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const motivo = `tempo esgotado (${LIMITE_POR_FONTE_MS / 1000}s)`;
  await sb.from("fontes").update({ ultimo_ciclo: { fonte: fonte.nome, erro: motivo, em: new Date().toISOString() } }).eq("id", fonte.id);
  return vazio(motivo);
}

// deno-lint-ignore no-explicit-any
export async function carregarNomesVeiculos(sb: any): Promise<string[]> {
  const { data } = await sb.from("fontes").select("nome").eq("tipo", "veiculo");
  return ((data ?? []) as { nome: string }[]).map((f) => f.nome).filter(Boolean);
}
