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
// FORMATO (regra da foto — nunca corremos risco com foto de terceiro):
//   foto da fonte com crédito institucional ............ MATÉRIA com a foto
//   prioridade ALTA sem foto liberada ................... MATÉRIA com foto
//                                                         geral da cidade
//   prioridade MÉDIA/BAIXA sem foto liberada ............ NOTA na coluna
//                                                         "Vozes {Cidade}"
//   estourou a cota da região/editoria .................. NOTA
//   sem cidade identificada e prioridade baixa .......... descarta
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
export type FotoOrigem = "fonte_autorizada" | "cidade_geral" | "nenhuma";

export function decidirFormato(p: {
  prioridade: Prioridade;
  valorNoticioso: boolean;
  fotoStatus: FotoStatus;
  forcarNota: boolean;
  temCidade: boolean;
}): { formato: Formato; foto: FotoOrigem; motivo: string } {
  if (!p.valorNoticioso) return { formato: "descartar", foto: "nenhuma", motivo: "sem valor noticioso" };

  const quer = (formato: Formato, foto: FotoOrigem, motivo: string) => {
    // Nota precisa de cidade (vai para a coluna "Vozes {Cidade}"). Sem
    // cidade: pauta baixa é descartada; o resto vira matéria regional.
    if (formato === "nota" && !p.temCidade) {
      return p.prioridade === "baixa"
        ? { formato: "descartar" as Formato, foto: "nenhuma" as FotoOrigem, motivo: "nota sem cidade identificada" }
        : { formato: "materia" as Formato, foto: "cidade_geral" as FotoOrigem, motivo: `${motivo}; sem cidade para coluna` };
    }
    return { formato, foto, motivo };
  };

  if (p.forcarNota) return quer("nota", "nenhuma", "cota da região/editoria atingida");
  if (p.fotoStatus === "autorizada") return quer("materia", "fonte_autorizada", "foto com crédito institucional");
  if (p.prioridade === "alta") return quer("materia", "cidade_geral", "pauta prioritária sem foto liberada");
  return quer("nota", "nenhuma", `prioridade ${p.prioridade} sem foto liberada`);
}
