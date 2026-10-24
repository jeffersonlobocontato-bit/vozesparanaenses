// Vozes Paranaenses — crivo editorial
//
// Decide QUANTO uma pauta importa e em QUE FORMATO ela sai:
//
//   PRIORIDADE ALTA  → serviço, utilidade pública, orientação de saúde,
//                      educação, segurança.
//   PRIORIDADE MÉDIA → demais assuntos com valor de notícia (economia,
//                      política, agro, cultura, esporte...).
//   PRIORIDADE BAIXA → evento (festa, show, feira, solenidade, inauguração
//                      protocolar) e propaganda de governo (autopromoção,
//                      agenda/visita de autoridade, balanço de gestão).
//
// DESTINO (out/2026) — decidido pela ORIGEM da pauta:
//   release de PREFEITURA com foto ................ MATÉRIA com a foto
//   release de PREFEITURA sem foto ................ NOTA na coluna regional
//                                                   "Vozes {Região}" (com
//                                                   a cidade marcada)
//   prefeitura que estourou a cota ................ NOTA
//   notícia de PORTAL/veículo com foto liberada ... MATÉRIA com a foto
//   notícia de PORTAL/veículo sem foto liberada ... MATÉRIA sem capa →
//                                                   módulo VAPT-VUPT
//   portal que estourou a cota da região/editoria . descarta
//   sem valor noticioso ........................... descarta
//
// A prioridade do crivo (abaixo) continua valendo para a ordem da fila,
// a cota e a criticidade — só não decide mais o formato.
//
// PRIMEIRA DOBRA DA HOME: matéria de portal sempre pode entrar; matéria de
// prefeitura só se a cidade estiver entre as 20 maiores (cidades.
// destaque_home). As demais aparecem nas páginas de região, cidade e
// editoria. Ver podeIrParaDobra().
//
// A classificação usa a MESMA chamada de IA que já escolhia a editoria em
// classify-and-quota (um JSON só), para não somar custo por pauta.

import type { FotoStatus } from "./foto-credito.ts";

export type Tema =
  | "servico"
  | "utilidade_publica"
  | "saude"
  | "educacao"
  | "seguranca"
  | "geral"
  | "evento"
  | "propaganda_governo";

export type Prioridade = "alta" | "media" | "baixa";

export const TEMAS_PRIORITARIOS: Tema[] = ["servico", "utilidade_publica", "saude", "educacao", "seguranca"];
const TEMAS_BAIXA: Tema[] = ["evento", "propaganda_governo"];
const TODOS_TEMAS: Tema[] = [...TEMAS_PRIORITARIOS, "geral", ...TEMAS_BAIXA];

export function prioridadeDoTema(tema: Tema): Prioridade {
  if (TEMAS_PRIORITARIOS.includes(tema)) return "alta";
  if (TEMAS_BAIXA.includes(tema)) return "baixa";
  return "media";
}

/** Bônus no interesse_score: pauta de serviço sobe na fila de escrita. */
export function pesoPrioridade(p: Prioridade): number {
  return p === "alta" ? 1.5 : p === "baixa" ? 0.6 : 1;
}

export const CRIVO_PROMPT = `CRIVO EDITORIAL — além da editoria, classifique o TEMA da pauta em UM destes:
- "servico": serviço público ao cidadão (inscrições, vagas, documentos, horários de atendimento, mutirões, programas sociais, obras que mudam rotina, interdições).
- "utilidade_publica": alertas e informações práticas (Defesa Civil, clima severo, falta de água/luz, trânsito, prazos, golpes, recall).
- "saude": orientação de saúde (vacinação, campanhas, sintomas, prevenção, atendimento, surtos/epidemiologia).
- "educacao": matrículas, calendário escolar, vagas, transporte escolar, programas educacionais, resultados.
- "seguranca": ocorrências e operações relevantes para a comunidade, alertas de segurança.
- "evento": festas, shows, feiras, exposições, solenidades, inaugurações protocolares, programação cultural/esportiva.
- "propaganda_governo": autopromoção de gestão (prefeito/secretário "entrega", "visita", "recebe", "anuncia" sem serviço concreto ao cidadão; balanço de gestão; homenagens; agenda de autoridade).
- "geral": qualquer outro assunto com valor de notícia (economia, política, agro, cultura, esporte, cotidiano).

Regras do crivo:
- Se uma inauguração/anúncio traz SERVIÇO concreto (ex.: "UBS abre amanhã com atendimento X, endereço Y"), é "servico", não "propaganda_governo".
- "valor_noticioso": false quando o texto não tem fato novo para o leitor (nota de pesar genérica, felicitação, post institucional vazio, expediente).

Para notícias de PORTAIS/JORNAIS, responda também:
- "origem_assessoria": true quando o texto parece release de assessoria de prefeitura/câmara reproduzido pelo portal (crédito "Divulgação/Prefeitura", "Assessoria", "Secom", "Ascom", "com informações da Prefeitura", texto institucional em terceira pessoa elogiando a gestão).
- "escopo": "parana" (fato de cidade do Paraná ou do estado do Paraná), "nacional" (outro estado ou Brasil em geral) ou "internacional".
- "critica_politica": true quando o centro da notícia é crítica, denúncia, ataque ou polêmica política envolvendo prefeito, vereadores, câmara, partidos ou gestão municipal (embate político, CPI, acusação, troca de farpas). Notícia factual de serviço da prefeitura NÃO é crítica política.
- "imagem": "tematica" (assunto geral que uma ilustração temática resolve: meio ambiente, saúde preventiva, clima, economia em geral, educação em geral), "cidade" (fala da cidade como um todo: aniversário, ranking, população, turismo, obra que muda a cidade) ou "fato" (fato específico — acidente, crime, evento, pessoa — que só uma foto real do fato ilustraria).`;

export const CRIVO_SCHEMA = `{"categoria": "<slug da editoria>", "tema": "<tema do crivo>", "valor_noticioso": true|false, "origem_assessoria": true|false, "escopo": "parana"|"nacional"|"internacional", "critica_politica": true|false, "imagem": "tematica"|"cidade"|"fato", "motivo": "<até 15 palavras>"}`;

export type Escopo = "parana" | "nacional" | "internacional";
export type TipoImagem = "tematica" | "cidade" | "fato";

export type ResultadoCrivo = {
  categoria: string | null;
  tema: Tema;
  prioridade: Prioridade;
  valor_noticioso: boolean;
  origem_assessoria: boolean;
  escopo: Escopo;
  critica_politica: boolean;
  imagem: TipoImagem;
  motivo: string | null;
  via: "ia" | "heuristica";
};

export function parseCrivo(raw: string, texto: string): ResultadoCrivo {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : raw) as {
      categoria?: string; tema?: string; valor_noticioso?: boolean; motivo?: string;
      origem_assessoria?: boolean; escopo?: string; critica_politica?: boolean; imagem?: string;
    };
    const tema = TODOS_TEMAS.includes(j.tema as Tema) ? (j.tema as Tema) : temaHeuristico(texto);
    return {
      categoria: typeof j.categoria === "string" ? j.categoria.trim().toLowerCase() : null,
      tema,
      prioridade: prioridadeDoTema(tema),
      valor_noticioso: j.valor_noticioso !== false,
      origem_assessoria: j.origem_assessoria === true || pareceReleaseDeAssessoria(texto),
      escopo: j.escopo === "nacional" || j.escopo === "internacional" ? j.escopo : "parana",
      critica_politica: j.critica_politica === true,
      imagem: j.imagem === "tematica" || j.imagem === "cidade" ? j.imagem : "fato",
      motivo: typeof j.motivo === "string" ? j.motivo.slice(0, 200) : null,
      via: "ia",
    };
  } catch {
    const tema = temaHeuristico(texto);
    return {
      categoria: null, tema, prioridade: prioridadeDoTema(tema), valor_noticioso: true,
      origem_assessoria: pareceReleaseDeAssessoria(texto), escopo: "parana", critica_politica: false,
      imagem: "fato", motivo: null, via: "heuristica",
    };
  }
}

// Fallback sem IA (gateway fora do ar): palavras-chave, na ordem de prioridade.
const PISTAS: Array<[Tema, RegExp]> = [
  ["utilidade_publica", /\b(defesa civil|alerta|temporal|vendaval|granizo|falta de (agua|energia)|interdi|desvio|bloqueio|golpe|recall|prazo)\w*/],
  ["saude", /\b(vacina|vacinacao|dengue|gripe|ubs|upa|saude|sintoma|campanha de|atendimento medico|hospital|exame)\w*/],
  ["educacao", /\b(matricula|escola|cmei|creche|aluno|ensino|vestibular|enem|transporte escolar|aulas)\w*/],
  ["servico", /\b(inscric|vagas?|cadastro|mutirao|emissao|documento|atendimento|programa|beneficio|iptu|refis|edital|concurso)\w*/],
  ["seguranca", /\b(policia|preso|prisao|apreens|furto|roubo|homicidio|acidente|operacao|crime)\w*/],
  ["evento", /\b(festa|show|feira|festival|exposicao|solenidade|programacao|apresentacao|desfile|torneio|campeonato)\w*/],
  ["propaganda_governo", /\b(prefeito|prefeita|secretari[oa]) (entrega|visita|recebe|participa|anuncia|inaugura|destaca|celebra)\w*/],
];

// Marcas de release de assessoria reproduzido por portal (vale sem IA).
const PISTAS_ASSESSORIA = /(assessoria de (imprensa|comunica[cç][aã]o) (da prefeitura|do munic[ií]pio|da c[aâ]mara)|com informa[cç][oõ]es da prefeitura|fonte:\s*prefeitura|(foto|imagem)s?:?\s*(divulga[cç][aã]o\s*\/\s*)?prefeitura|divulga[cç][aã]o\s*\/\s*(pm[a-z]{0,3}|prefeitura|c[aâ]mara)\b|prefeitura municipal de [a-z\u00c0-\u00ff ]+ informa)/i;

export function pareceReleaseDeAssessoria(texto: string, credito?: string | null): boolean {
  return PISTAS_ASSESSORIA.test(texto) || /prefeitura|c[aâ]mara municipal/i.test(credito ?? "");
}

/**
 * Portal/jornal: a pauta entra? (prefeitura e curadoria não passam aqui)
 * Fora: release de assessoria (já temos o scraping das prefeituras), fato
 * fora do Paraná e crítica política sobre a cidade.
 */
export function motivoDescartePortal(c: Pick<ResultadoCrivo, "origem_assessoria" | "escopo" | "critica_politica">): string | null {
  if (c.origem_assessoria) return "release de assessoria (já coletado da prefeitura)";
  if (c.escopo !== "parana") return `notícia ${c.escopo} em portal do Paraná`;
  if (c.critica_politica) return "crítica política sobre a cidade";
  return null;
}

export function temaHeuristico(texto: string): Tema {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [tema, re] of PISTAS) if (re.test(t)) return tema;
  return "geral";
}

export type Formato = "materia" | "nota" | "descartar";
export type FotoOrigem = "fonte_autorizada" | "nenhuma";
/** prefeitura = release oficial; portal = jornal/portal do PR; curadoria = esportes, nacional, internacional, tecnologia. */
export type OrigemPauta = "prefeitura" | "portal" | "curadoria";

export function decidirFormato(p: {
  origem: OrigemPauta;
  valorNoticioso: boolean;
  fotoStatus: FotoStatus;
  forcarNota: boolean;
  temRegiao: boolean;
}): { formato: Formato; foto: FotoOrigem; motivo: string } {
  if (!p.valorNoticioso) return { formato: "descartar", foto: "nenhuma", motivo: "sem valor noticioso" };

  if (p.origem === "prefeitura") {
    if (p.fotoStatus === "autorizada" && !p.forcarNota) {
      return { formato: "materia", foto: "fonte_autorizada", motivo: "release de prefeitura com foto" };
    }
    // A nota vai para a coluna da REGIÃO; sem região não há coluna.
    if (!p.temRegiao) return { formato: "descartar", foto: "nenhuma", motivo: "release sem região identificada" };
    return {
      formato: "nota",
      foto: "nenhuma",
      motivo: p.forcarNota ? "cota atingida → coluna regional" : "release de prefeitura sem foto → coluna regional",
    };
  }

  // Curadoria (esportes, nacional, internacional, tecnologia): só texto.
  if (p.origem === "curadoria") {
    if (p.forcarNota) return { formato: "descartar", foto: "nenhuma", motivo: "cota da editoria atingida" };
    return { formato: "materia", foto: "nenhuma", motivo: "curadoria: só texto, sem foto de terceiros" };
  }

  // Portal/veículo: sempre matéria. Cota estourada não vira mais nota.
  if (p.forcarNota) return { formato: "descartar", foto: "nenhuma", motivo: "cota da região/editoria atingida" };
  if (p.fotoStatus === "autorizada") return { formato: "materia", foto: "fonte_autorizada", motivo: "foto com crédito institucional" };
  return { formato: "materia", foto: "nenhuma", motivo: "portal sem foto liberada → VAPT-VUPT" };
}

/**
 * A matéria pode ocupar a primeira dobra da home? Portal sempre; prefeitura
 * só das cidades marcadas como destaque (as 20 maiores — cidades.destaque_home).
 */
export function podeIrParaDobra(origem: OrigemPauta, cidadeDestaque: boolean): boolean {
  if (origem === "curadoria") return false;
  return origem === "portal" || cidadeDestaque;
}

export type DecisaoImagem = "fonte" | "ilustracao_ia" | "foto_cidade" | "nenhuma";

/**
 * Imagem da matéria (regras de out/2026 — risco zero com foto de terceiros):
 *   prefeitura: foto da própria prefeitura (institucional) ou nenhuma
 *   qualquer origem com foto de crédito liberado (inclusive agências
 *     públicas: Agência Brasil, Senado, Câmara): a foto
 *   curadoria (esportes, nacional, internacional, tecnologia) sem foto
 *     liberada: nenhuma (a analista de imagem pode completar depois)
 *   portal, editoria esportes, sem foto liberada: nenhuma
 *   portal com foto de crédito institucional (AEN, governo): a foto
 *   portal sem foto liberada:
 *     assunto temático (meio ambiente, saúde...) → ilustração por IA,
 *       criada só a partir do tema e identificada como IA
 *     fala da cidade como um todo → foto real da cidade com licença livre
 *       (Wikimedia Commons, conferindo cidade + Paraná)
 *     fato específico → sem foto (vai para o VAPT-VUPT)
 */
export function decidirImagem(p: {
  origem: OrigemPauta;
  fotoStatus: FotoStatus;
  categoriaSlug: string | null;
  tipoImagem: TipoImagem | null;
  temCidade: boolean;
}): DecisaoImagem {
  if (p.origem === "prefeitura") return p.fotoStatus === "autorizada" ? "fonte" : "nenhuma";
  // Foto com crédito liberado (institucional, Agência Brasil/Senado/Câmara)
  // vale para qualquer origem — inclusive curadoria e esportes (out/2026).
  if (p.fotoStatus === "autorizada") return "fonte";
  if (p.origem === "curadoria") return "nenhuma";
  if (p.categoriaSlug === "esportes") return "nenhuma";
  if (p.tipoImagem === "tematica") return "ilustracao_ia";
  if (p.tipoImagem === "cidade" && p.temCidade) return "foto_cidade";
  return "nenhuma";
}

/**
 * O "onde" apurado fala do Brasil (país, Sul do Brasil, vários estados)?
 * Usado quando a apuração não achou cidade: notícia de escala nacional em
 * portal do PR vai para Nacional, e não para a região do jornal.
 */
export function ehAbrangenciaNacional(onde: string | null | undefined): boolean {
  if (!onde) return false;
  const t = onde.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(brasil|pais|nacional|territorio nacional|estados brasileiros|varios estados|regiao sul|sul do brasil|centro-sul do brasil|sudeste|nordeste|norte do brasil|centro-oeste)\b/.test(t);
}
