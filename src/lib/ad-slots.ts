/**
 * Registro central dos espaços de anúncio do portal.
 *
 * Cada slot tem:
 *  - `label`: nome legível para o painel de anúncios
 *  - `desktop`: formato (WxH) servido em telas >= 768px
 *  - `mobile`: formato servido em telas < 768px
 *  - `descricao`: onde o slot aparece no site (ajuda o operador comercial)
 *
 * Se `desktop === mobile`, o painel exige apenas 1 upload por criativo.
 * Se forem diferentes, o operador precisa subir 2 peças (uma pra cada
 * variante) para o slot preencher em qualquer viewport.
 */

export type AdFormato =
  | "970x90"
  | "728x90"
  | "300x250"
  | "300x600"
  | "320x50";

export type AdVariante = "desktop" | "mobile";

export type AdSlotDef = {
  slot: AdSlotName;
  label: string;
  descricao: string;
  desktop: AdFormato;
  mobile: AdFormato;
};

export type AdSlotName =
  | "home_topo"
  | "home_sidebar_hero"
  | "home_sidebar_quadrado"
  | "home_sidebar_alto"
  | "materia_topo"
  | "materia_meio"
  | "materia_rodape";

export const AD_SLOTS: Record<AdSlotName, AdSlotDef> = {
  home_topo: {
    slot: "home_topo",
    label: "Home — Topo (super banner)",
    descricao: "Faixa acima da manchete principal da home.",
    desktop: "970x90",
    mobile: "320x50",
  },
  home_sidebar_hero: {
    slot: "home_sidebar_hero",
    label: "Home — Sidebar hero",
    descricao: "Coluna lateral direita, junto aos destaques secundários.",
    desktop: "300x250",
    mobile: "300x250",
  },
  home_sidebar_quadrado: {
    slot: "home_sidebar_quadrado",
    label: "Home — Sidebar quadrado",
    descricao: "Coluna lateral direita, abaixo do VAPT-VUPT.",
    desktop: "300x250",
    mobile: "300x250",
  },
  home_sidebar_alto: {
    slot: "home_sidebar_alto",
    label: "Home — Sidebar alto (half page)",
    descricao: "Coluna lateral direita, formato vertical grande.",
    desktop: "300x600",
    mobile: "300x250",
  },
  materia_topo: {
    slot: "materia_topo",
    label: "Matéria — Topo",
    descricao: "Faixa entre a categoria/breadcrumb e o título da matéria.",
    desktop: "728x90",
    mobile: "320x50",
  },
  materia_meio: {
    slot: "materia_meio",
    label: "Matéria — Meio",
    descricao: "Retângulo intercalado no corpo da matéria.",
    desktop: "300x250",
    mobile: "300x250",
  },
  materia_rodape: {
    slot: "materia_rodape",
    label: "Matéria — Rodapé",
    descricao: "Faixa antes das notícias relacionadas.",
    desktop: "970x90",
    mobile: "320x50",
  },
};

export const AD_SLOT_LIST: AdSlotDef[] = Object.values(AD_SLOTS);

/** Retorna o formato certo para a viewport atual. */
export function formatoForViewport(slot: AdSlotName, isMobile: boolean): AdFormato {
  const def = AD_SLOTS[slot];
  return isMobile ? def.mobile : def.desktop;
}

/** Precisa de 2 uploads (desktop + mobile)? */
export function needsMobileVariant(slot: AdSlotName): boolean {
  const def = AD_SLOTS[slot];
  return def.desktop !== def.mobile;
}