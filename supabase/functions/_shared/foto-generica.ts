// Banco de fotos genéricas de assessoria (crédito institucional) para
// matérias de SEGURANÇA e ESPORTES que chegam sem foto liberada.
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

type Grupo = {
  editoria: "seguranca" | "esportes";
  /** Casa com título + resumo (sem acento, minúsculo). Sem gatilho = padrão da editoria. */
  gatilho?: RegExp;
  fotos: FotoGenerica[];
};

const AEN_PM = "Foto: Rodrigo Félix Leal/AEN";

// A ordem importa: o primeiro gatilho que casar decide.
export const GRUPOS: Grupo[] = [
  {
    editoria: "seguranca",
    gatilho: /\b(incendio|pegou fogo|fogo (em|atinge|destroi|destruiu)|chamas|bombeir|siate|resgat|afoga|soterr|desabamento|desabou|deslizamento|correnteza)/,
    fotos: [{ id: "bombeiros-1", credito: "Foto: Henrique Vieira/Sesp", legenda: "Viaturas do Corpo de Bombeiros do Paraná (imagem de arquivo)" }],
  },
  {
    editoria: "seguranca",
    // Só estrada (rodovia estadual): a foto é da Polícia Rodoviária Estadual.
    gatilho: /\b(rodovias?\b|prc?-?\d{3}|estrada|engavet|blitz|lei seca)/,
    fotos: [
      { id: "rodovia-1", credito: "Foto: Polícia Rodoviária do Paraná", legenda: "Viatura da Polícia Rodoviária Estadual (imagem de arquivo)" },
      { id: "rodovia-2", credito: "Foto: Polícia Rodoviária do Paraná", legenda: "Fiscalização da Polícia Rodoviária Estadual (imagem de arquivo)" },
      { id: "rodovia-3", credito: "Foto: Polícia Rodoviária do Paraná", legenda: "Motociclistas da Polícia Rodoviária Estadual (imagem de arquivo)" },
    ],
  },
  {
    editoria: "seguranca",
    // Trânsito urbano: quem atende é a PM.
    gatilho: /\b(acidente de transito|colisao|colidi|capot|atropel|tomba|batida entre|motociclista|motoboy)/,
    fotos: [
      { id: "pm-viatura-1", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
      { id: "pm-viatura-2", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
      { id: "pm-viatura-3", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
    ],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(pericia|perito|iml|necropsia|cientifica|corpo (e |foi )?encontrado|ossada|cadaver)/,
    fotos: [{ id: "cientifica-1", credito: "Foto: Sesp", legenda: "Viaturas da Polícia Científica do Paraná (imagem de arquivo)" }],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(presidio|penitenciar|cadeia publica|detento|custodiad|policia penal|depen|rebeliao|fuga de presos|sistema prisional)/,
    fotos: [{ id: "penal-1", credito: "Foto: Geraldo Bubniak/AEN", legenda: "Viaturas da Polícia Penal do Paraná (imagem de arquivo)" }],
  },
  {
    editoria: "seguranca",
    gatilho: /\b(delegacia|delegad[oa]|inquerito|policia civil|pcpr|investigac|indiciad|mandado de prisao|golpe|estelionat)/,
    fotos: [
      { id: "civil-1", credito: "Foto: PCPR", legenda: "Delegacia da Polícia Civil do Paraná (imagem de arquivo)" },
      { id: "civil-2", credito: "Foto: PCPR", legenda: "Delegacia da Polícia Civil do Paraná (imagem de arquivo)" },
    ],
  },
  {
    editoria: "seguranca",
    // Padrão: só quando é caso de polícia (queda em casa, mal súbito etc. ficam sem foto).
    gatilho: /\b(policia|pm\b|policiais|policial|rotam|bpfron|prend|preso|presa|prisao|flagrante|furt|roub|assalt|homicid|assassin|tiro|disparo|arma|droga|trafic|apreen|abordag|agred|agress|ameac|violencia|crime|suspeit|facad|esfaque)/,
    fotos: [
      { id: "pm-viatura-1", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
      { id: "pm-viatura-2", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
      { id: "pm-viatura-3", credito: AEN_PM, legenda: "Viaturas da Polícia Militar do Paraná (imagem de arquivo)" },
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
// ilustrativa), e casos federais (PF, Receita, PRF, Gaeco, BR) — o banco é
// das forças estaduais e mostraria a corporação errada.
export const SEM_FOTO = /\b(estupr|abuso sexual|infantojuvenil|pedofil|maus-tratos|vulneravel)/;
export const FEDERAL = /\b(policia federal|pf\b|receita federal|gaeco|prf\b|policia rodoviaria federal|br-?\d{3})/;

export function escolherFotoGenerica(
  editoria: string | null | undefined,
  texto: string,
  semente: string,
): (FotoGenerica & { url: string }) | null {
  if (editoria !== "seguranca" && editoria !== "esportes") return null;
  const t = norm(texto);
  if (editoria === "seguranca" && (SEM_FOTO.test(t) || FEDERAL.test(t))) return null;
  const grupo = GRUPOS.find((g) => g.editoria === editoria && (!g.gatilho || g.gatilho.test(t)));
  if (!grupo) return null;
  const foto = grupo.fotos[hash(semente) % grupo.fotos.length];
  return { ...foto, url: `${SITE_FOTOS_GENERICAS}/${foto.id}.jpg` };
}

export function ehFotoGenerica(url: string | null | undefined, origem?: string | null): boolean {
  return origem === FOTO_ORIGEM_GENERICA || /\/fotos-genericas\//.test(url ?? "");
}
