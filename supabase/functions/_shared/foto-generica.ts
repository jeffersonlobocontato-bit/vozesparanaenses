// Banco de fotos genéricas de assessoria (crédito institucional) para
// matérias de SEGURANÇA, ESPORTES e CLIMA/ALERTAS (qualquer editoria) que
// chegam sem foto liberada.
//
// As fotos vêm das galerias oficiais do Governo do Paraná (AEN, Sesp,
// PCPR, Polícia Rodoviária) e ficam no próprio site, em
// public/fotos-genericas/ — curadoria em scripts/fotos-genericas/ (branch
// fotos-genericas). São imagens de ARQUIVO, sem pessoas identificáveis em
// primeiro plano, e saem sempre com legenda de "imagem de arquivo".
//
// Não contam como "foto real" do fato: o Instagram não as usa nos cards, o
// Reels não as usa e a manchete da home não as escolhe (fotos-genericas na
// URL ou foto_origem = "generica_institucional").
//
// Para crescer o banco: baixe a foto da galeria oficial, salve em
// public/fotos-genericas/<id>.jpg (1600px) e acrescente a entrada abaixo.

export const SITE_FOTOS_GENERICAS = "https://vozesparanaenses.com.br/fotos-genericas";
export const FOTO_ORIGEM_GENERICA = "generica_institucional";

export type FotoGenerica = {
  id: string;
  credito: string;
  legenda: string;
};

// Polícia Rodoviária Federal / rodovia federal (BR): grupo próprio, com as
// fotos da galeria oficial da PRF. Vem antes do teste de "caso federal".
export const PRF = /\b(prf|policia rodoviaria federal|rodovias? federa(l|is)|br-?\d{3})/;

type Grupo = {
  /** "qualquer" = vale para toda editoria (clima/alertas). */
  editoria: "seguranca" | "esportes" | "qualquer";
  /** Casa com título + resumo (sem acento, minúsculo). Sem gatilho = padrão da editoria. */
  gatilho?: RegExp;
  fotos: FotoGenerica[];
};

// Critério da curadoria (29/10/2026, pedido do editor): foto NEUTRA e de
// cena — viatura ou agente em patrulha, perícia, resgate, céu de temporal —
// com profundidade. NUNCA fachada de delegacia/quartel (mostra a cidade
// errada), frota (várias viaturas enfileiradas — nunca, em lugar nenhum: regra de 29/10/2026), entrega no Palácio, autoridade, palanque
// ou evento. Fotos tiradas das galerias oficiais (AEN, Sesp, PMPR, PCPR,
// Polícia Penal, Polícia Científica, CBMPR, Sesa, DER) — lista e folhas
// de contato em scripts/fotos-genericas/ (branch fotos-genericas).
const AEN = (nome: string) => `Foto: ${nome}/AEN`;
const arq = (s: string) => `${s} (imagem de arquivo)`;
const f = (id: string, credito: string, legenda: string): FotoGenerica => ({ id, credito, legenda: arq(legenda) });

const PM = [
  f("pm-2", "Foto: Cb Ismael Ponchio/PMPR", "Policiais militares em patrulhamento"),
  f("pm-3", "Foto: PMPR", "Viatura e motocicleta da Polícia Militar"),
];

// A ordem importa: o primeiro gatilho que casar decide. Segurança primeiro;
// clima ("qualquer") depois, para valer em toda editoria.
export const GRUPOS: Grupo[] = [
  {
    editoria: "seguranca",
    gatilho: /\b(afoga|correnteza|arrastad[oa] pel[oa] (rio|agua)|guarda-vidas|salva-vidas)/,
    fotos: [
      f("cbm-agua-1", "Foto: Corpo de Bombeiros do Paraná", "Equipe de resgate aquático do Corpo de Bombeiros"),
      f("cbm-praia-1", "Foto: Corpo de Bombeiros do Paraná", "Guarda-vidas do Corpo de Bombeiros"),
    ],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(incendio|pegou fogo|fogo (em|atinge|destroi|destruiu)|chamas|bombeir|siate|resgat|soterr|desabamento|desabou)/,
    fotos: [
      f("cbm-1", "Foto: Sesp", "Viatura do Corpo de Bombeiros"),
      f("cbm-2", "Foto: Corpo de Bombeiros do Paraná", "Equipe de resgate do Corpo de Bombeiros"),
      f("cbm-3", "Foto: Corpo de Bombeiros do Paraná", "Equipe de resgate do Corpo de Bombeiros"),
    ],
  },
  {
    editoria: "seguranca",
    // Rodovia federal / PRF: galeria oficial da PRF no Paraná (Flickr
    // prfparana, fotos de divulgação com crédito do autor) — agentes de
    // costas ou distantes em fiscalização, sem rosto em primeiro plano.
    gatilho: PRF,
    fotos: [
      f("prf-1", "Foto: André Filgueira/PRF", "Policial rodoviária federal em fiscalização na rodovia"),
      f("prf-2", "Foto: André Filgueira/PRF", "Policial rodoviária federal em fiscalização de veículo"),
      f("prf-3", "Foto: André Filgueira/PRF", "Abordagem da PRF em rodovia federal"),
      f("prf-4", "Foto: André Filgueira/PRF", "Policial rodoviária federal acompanha o fluxo na rodovia"),
      f("prf-5", "Foto: PRF", "Fiscalização de carga pela PRF"),
      f("prf-6", "Foto: André Filgueira/PRF", "Policial rodoviário federal orienta o trânsito"),
      f("prf-7", "Foto: PRF", "Motopoliciamento da PRF em rodovia federal"),
    ],
  },
  {
    editoria: "seguranca",
    // Só estrada (rodovia estadual): Polícia Rodoviária Estadual.
    gatilho: /\b(rodovias?\b|prc?-?\d{3}|estrada|engavet|blitz|lei seca)/,
    fotos: [
      f("rodovia-1", "Foto: Polícia Rodoviária do Paraná", "Viatura da Polícia Rodoviária Estadual"),
      f("rodovia-2", "Foto: Polícia Rodoviária do Paraná", "Fiscalização da Polícia Rodoviária Estadual"),
      f("rodovia-3", "Foto: Polícia Rodoviária do Paraná", "Motociclistas da Polícia Rodoviária Estadual"),
      f("rodovia-4", "Foto: DER-PR", "Fiscalização em rodovia estadual"),
    ],
  },
  {
    editoria: "seguranca",
    // Trânsito urbano: o que se vê na cena é o socorro.
    gatilho: /\b(acidente de transito|colisao|colidi|capot|atropel|tomba|batida entre|motociclista|motoboy)/,
    fotos: [
      f("samu-1", "Foto: Sesa", "Atendimento do Samu"),
      f("samu-2", "Foto: Sesa", "Ambulância do Samu"),
      f("samu-3", "Foto: Secom", "Ambulância do Samu"),
    ],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(pericia|perito|iml|necropsia|cientifica|corpo (e |foi )?encontrado|ossada|cadaver)/,
    fotos: [
      f("pci-1", "Foto: Paulo Henrique/Sesp", "Laboratório da Polícia Científica"),
      f("pci-2", "Foto: Paulo Henrique/Sesp", "Análise pericial em laboratório da Polícia Científica"),
      f("pci-3", "Foto: Polícia Científica do Paraná", "Perícia da Polícia Científica"),
    ],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(presidio|penitenciar|cadeia publica|detento|custodiad|policia penal|depen|rebeliao|fuga de presos|sistema prisional)/,
    fotos: [
      f("ppen-1", "Foto: Paulo Henrique/Sesp", "Viatura da Polícia Penal"),
      f("ppen-2", "Foto: Ricardo Almeida/Sesp", "Policial penal em unidade prisional"),
      f("ppen-3", "Foto: Polícia Penal do Paraná", "Treinamento da Polícia Penal"),
    ],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(delegacia|delegad[oa]|inquerito|policia civil|pcpr|investigac|indiciad|mandado de prisao|golpe|estelionat)/,
    fotos: [
      f("pcpr-1", "Foto: PCPR", "Policiais civis em operação"),
      f("pcpr-4", "Foto: PCPR", "Policiais civis em operação"),
      f("pcpr-3", "Foto: PCPR", "Viatura do canil da Polícia Civil"),
    ],
  },
  {
    editoria: "seguranca",
    // Padrão: só quando é caso de polícia (queda em casa, mal súbito etc. ficam sem foto).
    gatilho: /\b(policia|pm\b|policiais|policial|rotam|bpfron|prend|preso|presa|prisao|flagrante|furt|roub|assalt|homicid|assassin|tiro|disparo|arma|droga|trafic|apreen|abordag|agred|agress|ameac|violencia|crime|suspeit|facad|esfaque)/,
    fotos: PM,
  },
  // ---- Clima e alertas (qualquer editoria; também o Instagram) ----
  {
    editoria: "qualquer",
    gatilho: /\b(deslizament|queda de barreira|barranco|rodovias? (interditad|bloquead)|interdicao (total|parcial)|cratera|erosao)/,
    fotos: [
      f("clima-interdicao-1", "Foto: DER-PR", "Rodovia interditada após chuva"),
      f("clima-interdicao-2", "Foto: DER-PR", "Bloqueio em rodovia após deslizamento"),
      f("clima-interdicao-3", "Foto: DER-PR", "Estrago no asfalto causado pela chuva"),
    ],
  },
  {
    editoria: "qualquer",
    gatilho: /\b(enchente|inundac|alagament|alagad|cheia do rio|rio (sobe|transbord)|transbord)/,
    fotos: [f("clima-enchente-1", "Foto: DER-PR", "Rio cheio após chuva")],
  },
  {
    editoria: "qualquer",
    gatilho: /\b(temporal|tempestade|granizo|vendaval|ventania|ventos? (fortes?|intensos?)|ciclone|tornado|alerta (de|laranja|vermelho|amarelo))/,
    fotos: [
      f("clima-temporal-1", AEN("José Fernando Ogura"), "Nuvens de temporal sobre lavoura"),
      f("clima-temporal-2", AEN("Gilson Abreu"), "Céu carregado de chuva"),
      f("clima-temporal-3", AEN("Gilson Abreu"), "Chuva se aproximando no campo"),
      f("clima-temporal-4", AEN("Geraldo Bubniak"), "Tempestade se aproximando de Curitiba"),
    ],
  },
  {
    editoria: "qualquer",
    gatilho: /\b(geada|frio intenso|massa de ar (polar|frio)|onda de frio|temperatura negativa|abaixo de zero|neve)/,
    fotos: [
      f("clima-geada-1", AEN("Roberto Dziura Jr"), "Geada em parque"),
      f("clima-geada-2", AEN("Roberto Dziura Jr"), "Amanhecer com geada"),
    ],
  },
  {
    editoria: "qualquer",
    gatilho: /\b(onda de calor|calor (intenso|extremo)|estiagem|seca\b|baixa umidade|racionamento|rodizio de agua|nivel (dos|das) (reservatorios|represas))/,
    fotos: [
      f("clima-seca-1", AEN("Roberto Dziura Jr"), "Lavoura sob sol forte"),
      f("clima-seca-2", AEN("Roberto Dziura Jr"), "Campo em dia de sol"),
      f("clima-seca-3", "Foto: AEN", "Reservatório com nível baixo"),
    ],
  },
  {
    editoria: "qualquer",
    gatilho: /\b(chuva|chuvas|chuvoso|garoa|guarda-chuva|frente fria)/,
    fotos: [
      f("clima-chuva-1", AEN("Geraldo Bubniak"), "Dia de chuva"),
      f("clima-chuva-2", AEN("Roberto Dziura Jr"), "Pedestre em dia de chuva"),
      f("clima-chuva-3", AEN("Roberto Dziura Jr"), "Pedestres em dia de chuva"),
    ],
  },
  {
    editoria: "esportes",
    gatilho: /\b(coritiba|couto pereira)\b/,
    fotos: [{ id: "couto-pereira-1", credito: "Foto: Geraldo Bubniak/AEN", legenda: "Estádio Couto Pereira, em Curitiba (imagem de arquivo)" }],
  },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Escolhe a foto genérica (ou null). `semente` (id da matéria) alterna entre
 * as fotos do mesmo grupo para a home não repetir a mesma imagem.
 */
// Sem foto genérica: crimes sexuais e contra crianças (nenhuma imagem
// ilustrativa), e casos federais (PF, Receita, Gaeco) — mostraria a
// corporação errada. PRF/BR tem grupo próprio (fotos da PRF) e vem antes.
export const SEM_FOTO = /\b(estupr|abuso sexual|infantojuvenil|pedofil|maus-tratos|vulneravel)/;
export const FEDERAL = /\b(policia federal|pf\b|receita federal|gaeco)/;

export function escolherFotoGenerica(
  editoria: string | null | undefined,
  texto: string,
  semente: string,
): (FotoGenerica & { url: string }) | null {
  const r = escolherFotoGenericaInedita(editoria, texto, semente, new Set());
  return r && "foto" in r ? r.foto : null;
}

export const urlFotoGenerica = (id: string) => `${SITE_FOTOS_GENERICAS}/${id}.jpg`;

/**
 * Como escolherFotoGenerica, mas pula as fotos em `evitar` (URLs já usadas
 * por OUTRA matéria recente de outro assunto — regra de 30/10/2026: duas
 * matérias de temas diferentes nunca com a mesma foto). Se o grupo do tema
 * existe e todas as fotos dele já estão em uso, devolve { repetida: true }:
 * a pauta vira nota na coluna da região em vez de repetir a foto.
 */
export function escolherFotoGenericaInedita(
  editoria: string | null | undefined,
  texto: string,
  semente: string,
  evitar: Set<string>,
): { foto: FotoGenerica & { url: string } } | { repetida: true } | null {
  const t = norm(texto);
  if (SEM_FOTO.test(t)) return null;
  const ehPrf = editoria === "seguranca" && PRF.test(t);
  if (editoria === "seguranca" && !ehPrf && FEDERAL.test(t)) return null;
  const grupo = GRUPOS.find((g) => (g.editoria === editoria || g.editoria === "qualquer") && (!g.gatilho || g.gatilho.test(t)));
  if (!grupo) return null;
  const n = grupo.fotos.length;
  const inicio = hash(semente) % n;
  for (let i = 0; i < n; i++) {
    const foto = grupo.fotos[(inicio + i) % n];
    const url = urlFotoGenerica(foto.id);
    if (!evitar.has(url)) return { foto: { ...foto, url } };
  }
  return { repetida: true };
}

export function ehFotoGenerica(url: string | null | undefined, origem?: string | null): boolean {
  return origem === FOTO_ORIGEM_GENERICA || /\/fotos-genericas\//.test(url ?? "");
}
