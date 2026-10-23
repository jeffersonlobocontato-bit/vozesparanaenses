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
- "valor_noticioso": false quando o texto não tem fato novo para o leitor (nota de pesar genérica, felicitação, post institucional vazio, expediente).`;

export const CRIVO_SCHEMA = `{"categoria": "<slug da editoria>", "tema": "<tema do crivo>", "valor_noticioso": true|false, "motivo": "<até 15 palavras>"}`;

export type ResultadoCrivo = {
  categoria: string | null;
  tema: Tema;
  prioridade: Prioridade;
  valor_noticioso: boolean;
  motivo: string | null;
  via: "ia" | "heuristica";
};

export function parseCrivo(raw: string, texto: string): ResultadoCrivo {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : raw) as { categoria?: string; tema?: string; valor_noticioso?: boolean; motivo?: string };
    const tema = TODOS_TEMAS.includes(j.tema as Tema) ? (j.tema as Tema) : temaHeuristico(texto);
    return {
      categoria: typeof j.categoria === "string" ? j.categoria.trim().toLowerCase() : null,
      tema,
      prioridade: prioridadeDoTema(tema),
      valor_noticioso: j.valor_noticioso !== false,
      motivo: typeof j.motivo === "string" ? j.motivo.slice(0, 200) : null,
      via: "ia",
    };
  } catch {
    const tema = temaHeuristico(texto);
    return { categoria: null, tema, prioridade: prioridadeDoTema(tema), valor_noticioso: true, motivo: null, via: "heuristica" };
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

export function temaHeuristico(texto: string): Tema {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [tema, re] of PISTAS) if (re.test(t)) return tema;
  return "geral";
}

export type Formato = "materia" | "nota" | "descartar";
export type FotoOrigem = "fonte_autorizada" | "nenhuma";
export type OrigemPauta = "prefeitura" | "portal";

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
  return origem === "portal" || cidadeDestaque;
}
