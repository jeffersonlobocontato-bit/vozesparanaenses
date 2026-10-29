// Cobertura por município: Vozes × veículos regionais que acompanhamos.
// Dados da RPC cobertura_municipios (migração 094). Regras puras aqui, usadas
// pela página /admin/cobertura (mapa, comparativo e prospecção).
import { DIAG_PREFEITURAS as diag } from "./diag-prefeituras";

export type Municipio = {
  slug: string;
  nome: string;
  regiao: string;
  regiao_nome: string;
  maior: boolean;
  vozes_materias: number;
  vozes_notas: number;
  conc_total: number;
  conc_veiculos: number;
  conc_maior: number;
  conc_lider: string | null;
  conc_lista: { nome: string; n: number }[];
  prefeitura: "monitorada" | "inativa" | "nao_cadastrada";
  prefeitura_noticias: number;
  cliente: string | null;
};

export type Situacao = "so_vozes" | "vozes_lidera" | "disputa" | "conc_lidera" | "so_conc" | "sem";

/**
 * Quem lidera a cobertura da cidade, comparando o Vozes (matérias + notas)
 * com o MAIOR veículo concorrente na mesma janela:
 *  - só Vozes: ninguém mais publicou;
 *  - Vozes lidera: publicamos mais que o maior concorrente;
 *  - disputa: publicamos ao menos metade do que o maior concorrente;
 *  - concorrência lidera: publicamos menos da metade;
 *  - só concorrência: não publicamos nada e algum veículo publicou;
 *  - sem cobertura: ninguém publicou.
 */
export function situacao(m: Pick<Municipio, "vozes_materias" | "vozes_notas" | "conc_total" | "conc_maior">): Situacao {
  const v = m.vozes_materias + m.vozes_notas;
  if (v === 0 && m.conc_total === 0) return "sem";
  if (m.conc_total === 0) return "so_vozes";
  if (v === 0) return "so_conc";
  if (v > m.conc_maior) return "vozes_lidera";
  if (v * 2 >= m.conc_maior) return "disputa";
  return "conc_lidera";
}

/** Participação do Vozes no que se publicou sobre a cidade (0–1). */
export function participacao(m: Pick<Municipio, "vozes_materias" | "vozes_notas" | "conc_total">): number {
  const v = m.vozes_materias + m.vozes_notas;
  return v + m.conc_total ? v / (v + m.conc_total) : 0;
}

// Paleta: laranja = Vozes (quanto mais forte, mais lideramos); tinta/verde
// acinzentado = concorrência; cinza = ninguém.
export const SITUACAO: Record<Situacao, { rotulo: string; cor: string; texto: string; descricao: string }> = {
  so_vozes: { rotulo: "Só o Vozes", cor: "#B5651D", texto: "#ffffff", descricao: "Nenhum veículo monitorado publicou sobre a cidade." },
  vozes_lidera: { rotulo: "Vozes lidera", cor: "#E29F65", texto: "#12201E", descricao: "Publicamos mais que o maior concorrente." },
  disputa: { rotulo: "Disputa", cor: "#F4D6B8", texto: "#12201E", descricao: "Publicamos ao menos metade do que o maior concorrente publicou." },
  conc_lidera: { rotulo: "Concorrência lidera", cor: "#8FA8A2", texto: "#12201E", descricao: "Publicamos menos da metade do maior concorrente." },
  so_conc: { rotulo: "Só concorrência", cor: "#2F4A45", texto: "#ffffff", descricao: "Algum veículo publicou e o Vozes não." },
  sem: { rotulo: "Sem cobertura", cor: "#E4E7E5", texto: "#12201E", descricao: "Ninguém publicou sobre a cidade na janela." },
};
export const ORDEM_SITUACAO: Situacao[] = ["so_vozes", "vozes_lidera", "disputa", "conc_lidera", "so_conc", "sem"];

/** Escala de calor (0 = nada) em degraus, com corte por quantis simples. */
export function degrau(valor: number, max: number, passos = 6): number {
  if (valor <= 0 || max <= 0) return 0;
  return Math.min(passos, Math.max(1, Math.ceil((Math.log1p(valor) / Math.log1p(max)) * passos)));
}
export const CALOR_CONC = ["#EEF1EF", "#D3DDDA", "#AFC2BD", "#86A39C", "#5E827A", "#3B5F57", "#1B3530"];
export const CALOR_VOZES = ["#EEF1EF", "#FBE6D3", "#F6CFA9", "#EFB57F", "#E29F65", "#C97C3A", "#9A5718"];

// ---------- Prospecção (Portal da Imprensa) ----------
const DIAG = diag.cidades;
export const DIAG_TESTADO_EM = diag.testado_em;

export type Prioridade = "A" | "B" | "C" | "D" | "cliente";
/** A = nenhum veículo cobre e a prefeitura produz; B = nenhum cobre, prefeitura no robô sem produção; C = nenhum cobre e prefeitura fora do robô; D = coberta. */
export function prioridade(m: Municipio): Prioridade {
  if (m.cliente === "aprovado" || m.cliente === "pendente") return "cliente";
  if (m.conc_total > 0) return "D";
  if (m.prefeitura === "monitorada" && m.prefeitura_noticias > 0) return "A";
  if (m.prefeitura === "monitorada") return "B";
  return "C";
}

export const MOTIVOS: Record<string, { titulo: string; estrategia: string }> = {
  produzindo: { titulo: "Produzindo", estrategia: "Candidata natural ao Portal da Imprensa: já tem assessoria ativa." },
  vai_render: { titulo: "No robô, deve render nos próximos ciclos", estrategia: "Acompanhar: se em 7 dias não render, volta para revisão." },
  publica_pouco: { titulo: "No robô, publica pouco", estrategia: "Contato com a assessoria: mostrar a página da cidade e o Portal da Imprensa como canal fixo." },
  ilegivel: { titulo: "No robô, mas o site não rende", estrategia: "Revisar o endereço cadastrado e testar de novo no diagnóstico." },
  nao_respondeu: { titulo: "Site não respondeu ao robô", estrategia: "Confirmar com a assessoria o endereço da área de notícias e cadastrar; enquanto isso, oferecer o autocadastro no Portal." },
  navegador: { titulo: "Site montado no navegador", estrategia: "Leitor pago só para as maiores; Portal da Imprensa para as pequenas." },
  sem_data: { titulo: "Lista sem data", estrategia: "Ajuste técnico no leitor de datas para esse modelo de site." },
  parado: { titulo: "Site parado", estrategia: "Argumento direto para o Portal: a notícia chega aos leitores sem depender do site." },
  sem_teste: { titulo: "Fora do robô, sem teste", estrategia: "Rodar o diagnóstico para essa cidade." },
};

/** Situação da prefeitura no robô + teste do diagnóstico (motivo e estratégia). */
export function motivo(m: Municipio): keyof typeof MOTIVOS {
  const d = DIAG[m.slug]?.site;
  if (m.prefeitura === "monitorada") {
    if (m.prefeitura_noticias > 0) return "produzindo";
    if (d === "boa") return "vai_render";
    if (d === "so_velha") return "publica_pouco";
    if (d === "vazia" || d === "sem_data") return "ilegivel";
    return "publica_pouco";
  }
  if (d === "nada") return "nao_respondeu";
  if (d === "vazia") return "navegador";
  if (d === "sem_data") return "sem_data";
  if (d === "so_velha") return "parado";
  return "sem_teste";
}
