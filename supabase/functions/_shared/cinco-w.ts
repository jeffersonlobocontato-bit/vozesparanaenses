// Veto do 5W1H: só vira conteúdo (matéria ou nota) a pauta cujos fatos
// apurados respondem às seis perguntas — quem, o quê, quando, onde, por quê
// e como. Sem isso a IA "escreve" sobre o nada (ex.: "Sem informações
// oficiais confirmadas", publicada em 24/10/2026 com os seis campos nulos).

export const PERGUNTAS_5W1H = ["quem", "o_que", "quando", "onde", "por_que", "como"] as const;
export type Pergunta5w1h = (typeof PERGUNTAS_5W1H)[number];

export const ROTULO_5W1H: Record<Pergunta5w1h, string> = {
  quem: "quem",
  o_que: "o quê",
  quando: "quando",
  onde: "onde",
  por_que: "por quê",
  como: "como",
};

// Respostas que a IA dá quando NÃO sabe — contam como vazio.
const NAO_RESPONDE = new RegExp(
  "^(" + [
    "n/?a", "-+", "\\?+", "null", "nenhum[a]?", "desconhecid[oa]s?", "indefinid[oa]",
    "n[aã]o (informad[oa]s?|especificad[oa]s?|divulgad[oa]s?|mencionad[oa]s?|consta|h[aá]|identificad[oa]s?|confirmad[oa]s?|dispon[ií]ve(l|is)|se aplica|apurad[oa]s?|citad[oa]s?|detalhad[oa]s?|esclarecid[oa]s?|definid[oa]s?|sabido)",
    "sem (informa[cç](ão|ões)|dados|detalhes|registro)",
    "(informa[cç](ão|ões)|dados?) n[aã]o (dispon[ií]ve(l|is)|informad[oa]s?|divulgad[oa]s?)",
  ].join("|") + ")(?=$|[\\s,.;:!?)-])", // \b não funciona depois de "há"
  "i",
);

export function respostaVazia(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.every(respostaVazia);
  const t = String(v).trim().replace(/[.;:]+$/, "").trim();
  if (t.length < 2) return true;
  return NAO_RESPONDE.test(t);
}

// Exceção da notícia POLICIAL (decisão editorial de 24/10/2026): ocorrência
// costuma sair sem motivo, horário exato ou nome dos envolvidos, e ainda
// assim é notícia. Basta o fato e o lugar — sem eles é texto vazio.
export const MINIMO_POLICIAL: Pergunta5w1h[] = ["o_que", "onde"];

/**
 * Perguntas que bloqueiam a publicação (vazio = pode escrever).
 * Regra geral: as seis. Policial: só o mínimo (o quê e onde).
 */
export function faltando5w1h(
  fatos: Partial<Record<Pergunta5w1h, unknown>>,
  opts: { policial?: boolean } = {},
): Pergunta5w1h[] {
  const exigidas = opts.policial ? MINIMO_POLICIAL : PERGUNTAS_5W1H;
  return exigidas.filter((p) => respostaVazia(fatos[p]));
}

export function motivoVeto5w1h(faltando: Pergunta5w1h[]): string {
  return `5W1H incompleto: sem ${faltando.map((p) => ROTULO_5W1H[p]).join(", ")}`;
}
