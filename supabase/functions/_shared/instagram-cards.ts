// Vozes Paranaenses — cards do Instagram (renderização no servidor).
//
// Desenha os formatos aprovados na tela "Vozes · Cards do Instagram"
// (3:4, 1080×1440) com a ASSINATURA A: o chapéu de proximidade dentro do
// balão de fala do logo, na cor do escopo, com a ponta tocando o título, e
// o ponto laranja do logo fechando o título. Rodapé com o ícone e
// "vozes paranaenses".
//
// Sem dependência de Deno: monta a árvore que o Satori entende (objetos no
// formato de elemento React) e devolve o SVG; quem chama converte para PNG
// (resvg) e carrega as fontes. Assim dá para testar fora do Supabase.

// ---------- Tokens (design system Vozes Paranaenses) ----------
export const COR = {
  surface: "#fbfcfa",
  surfaceRaised: "#f1f5f2",
  surfaceWarm: "#f8f1e8",
  ink: "#14211c",
  inkMuted: "#4a5a53",
  rule: "#d6dfd9",
  dark: "#0f1714",
  darkInk: "#eaf0ec",
  darkMuted: "#b3c0b9",
  darkRule: "#2a3832",
  brand: "#1e5b45",
  accent: "#e29f65",
  alerta: "#b8241a",
};

/** Cor do balão por escopo de proximidade (fundo claro / fundo escuro). */
export const ESCOPO = {
  cidade: { claro: "#9a4d16", escuro: "#f0b07a" },
  regiao: { claro: "#1e5b45", escuro: "#6fbf98" },
  parana: { claro: "#1b5e9a", escuro: "#7ab8f0" },
  brasil: { claro: "#3d4a44", escuro: "#c9d4ce" },
  mundo: { claro: "#5f4b8b", escuro: "#c3b2ec" },
} as const;
export type Escopo = keyof typeof ESCOPO;

export const COR_REGIAO: Record<string, string> = {
  metropolitana: "#1F5FA8",
  litoral: "#0B7285",
  "campos-gerais": "#5F7A1B",
  "norte-pioneiro": "#A0522D",
  "norte-central": "#B3261E",
  noroeste: "#8C6D0F",
  "centro-ocidental": "#7B4AA0",
  oeste: "#2E7D32",
  sudoeste: "#B02A6B",
  "centro-sul": "#455A64",
};

export const NOME_REGIAO: Record<string, string> = {
  metropolitana: "Metropolitana",
  litoral: "Litoral",
  "campos-gerais": "Campos Gerais",
  "norte-pioneiro": "Norte Pioneiro",
  "norte-central": "Norte",
  noroeste: "Noroeste",
  "centro-ocidental": "Centro Oeste",
  oeste: "Oeste",
  sudoeste: "Sudoeste",
  "centro-sul": "Centro-Sul",
};

/** Cores claras demais para texto branco no balão: o texto vai em tinta. */
function textoSobre(fundo: string): string {
  const h = fundo.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? COR.ink : "#ffffff";
}

// Ícone do logo (balão verde, V branco, ponto laranja) — cópia exata do
// design system (Logos/vozes-icone-amigavel.svg e -escuro.svg).
const ICONE_CLARO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><path fill="#1E5B45" d="M64 28h120a48 48 0 0 1 48 48v84a48 48 0 0 1-48 48H108l-52 34a6 6 0 0 1-9.2-5.6L52 206A48 48 0 0 1 16 160V76a48 48 0 0 1 48-48z"/><polyline points="72.3,91.7 124,144.3 175.7,91.7" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><circle cx="214" cy="46" r="34.4" fill="#E29F65"/></svg>`;
const ICONE_ESCURO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><path fill="#6FBF98" d="M64 28h120a48 48 0 0 1 48 48v84a48 48 0 0 1-48 48H108l-52 34a6 6 0 0 1-9.2-5.6L52 206A48 48 0 0 1 16 160V76a48 48 0 0 1 48-48z"/><polyline points="72.3,91.7 124,144.3 175.7,91.7" fill="none" stroke="#0F1714" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><circle cx="214" cy="46" r="34.4" fill="#E9A973"/></svg>`;

function svgDataUri(svg: string): string {
  // btoa só aceita latin-1; os SVGs acima são ASCII.
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ---------- Árvore do Satori ----------
// deno-lint-ignore no-explicit-any
export type No = { type: string; props: Record<string, any> };
type Filho = No | string | null | false | undefined;
// deno-lint-ignore no-explicit-any
function h(type: string, props: Record<string, any> = {}, ...filhos: Filho[]): No {
  const kids = filhos.filter((f) => f !== null && f !== false && f !== undefined) as (No | string)[];
  return { type, props: { ...props, children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids } };
}
const div = (style: Record<string, unknown>, ...filhos: Filho[]) => h("div", { style: { display: "flex", ...style } }, ...filhos);

const F = {
  titulo: "Newsreader",
  ui: "Barlow",
  chapeu: "Barlow Condensed",
  marca: "Fraunces",
};

/** Assinatura A: chapéu dentro do balão, ponta para baixo à esquerda. */
function chapeuBalao(texto: string, fundo: string): No {
  const cor = textoSobre(fundo);
  const ponta = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="26" viewBox="0 0 36 26"><path d="M0 0H36L7 24.5A3.2 3.2 0 0 1 1.6 21.6Z" fill="${fundo}"/></svg>`;
  return div(
    { position: "relative", alignSelf: "flex-start", alignItems: "center", padding: "15px 28px 15px 24px", background: fundo, borderRadius: 22 },
    h("span", { style: { fontFamily: F.chapeu, fontWeight: 600, fontSize: 31, lineHeight: 1, letterSpacing: "0.08em", textTransform: "uppercase", color: cor } }, texto),
    h("img", { src: svgDataUri(ponta), width: 36, height: 26, style: { position: "absolute", left: 30, bottom: -22 } }),
  );
}

/** Título com o ponto laranja do logo no fim (ponto final da marca). */
function tituloComPonto(texto: string, estilo: Record<string, unknown>, corPonto: string, tamPonto: number): No {
  // Uma caixa por palavra, para a quebra de linha ser a do texto corrido; a
  // última palavra e o ponto ficam juntos (nunca o ponto sozinho na linha).
  const palavras = texto.trim().split(/\s+/);
  const ultima = palavras.pop() ?? "";
  const espaco = "0.26em";
  return div(
    { flexWrap: "wrap", alignItems: "baseline", ...estilo },
    ...palavras.map((p) => h("span", { style: { marginRight: espaco } }, p)),
    h(
      "span",
      { style: { display: "flex", alignItems: "baseline", height: "100%" } },
      ultima,
      h("span", { style: { width: tamPonto, height: tamPonto, marginLeft: Math.round(tamPonto / 2), borderRadius: tamPonto, background: corPonto, alignSelf: "flex-end", marginBottom: Math.round(tamPonto * 1.05) } }),
    ),
  );
}

function rodape(escuro: boolean, direita: Filho[], borda: string): No {
  const cor = escuro ? "#ffffff" : COR.brand;
  return div(
    { alignItems: "center", justifyContent: "space-between", paddingTop: 28, borderTop: `2px solid ${borda}`, gap: 24 },
    div(
      { alignItems: "center", gap: 14 },
      h("img", { src: svgDataUri(escuro ? ICONE_ESCURO : ICONE_CLARO), width: 54, height: 54 }),
      div(
        { flexDirection: "column", fontFamily: F.marca, fontWeight: 700, color: cor, lineHeight: 0.92 },
        h("span", { style: { fontSize: 33, letterSpacing: -0.4 } }, "vozes"),
        h("span", { style: { fontSize: 20 } }, "paranaenses"),
      ),
    ),
    div({ flexDirection: "column", alignItems: "flex-end", gap: 6 }, ...direita),
  );
}

const CTA = (texto: string, cor: string) => h("span", { style: { fontFamily: F.ui, fontWeight: 600, fontSize: 25, color: cor } }, texto);
const CREDITO = (texto: string, cor: string) => h("span", { style: { fontFamily: F.ui, fontWeight: 500, fontSize: 19, color: cor } }, texto);

/** Corpo do título conforme o tamanho do texto (cabe sem estourar o card). */
export function corpoTitulo(texto: string, base: number): number {
  const n = texto.length;
  if (n <= 50) return base;
  if (n <= 70) return Math.round(base * 0.9);
  if (n <= 90) return Math.round(base * 0.8);
  return Math.round(base * 0.7);
}

export function limitar(texto: string | null | undefined, max: number): string {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:.\-–]$/, "") + "…";
}

// ---------- Formatos ----------
export type CardFoto = {
  formato: "foto";
  chapeu: string;
  cor: string;
  titulo: string;
  linhaFina?: string | null;
  foto: string; // data URI ou URL
  credito?: string | null;
  cta?: string;
  // Lâmina de carrossel (Giro): posição atual e total.
  lamina?: { atual: number; total: number; rotulo: string };
  tag?: string | null; // editoria, no canto superior direito
};

/**
 * Fundos do card tipográfico. Dois posts seguidos nunca saem com a mesma cor:
 * o robô escolhe o fundo olhando o post anterior e o seguinte da fila.
 */
export type Fundo = "tinta" | "verde" | "papel" | "areia";
const TOM: Record<Fundo, { bg: string; ink: string; muted: string; rule: string; escuro: boolean; ponto: string }> = {
  tinta: { bg: COR.dark, ink: COR.darkInk, muted: COR.darkMuted, rule: COR.darkRule, escuro: true, ponto: "#e9a973" },
  verde: { bg: COR.brand, ink: "#ffffff", muted: "#cfe3d8", rule: "rgba(255,255,255,0.22)", escuro: true, ponto: COR.accent },
  papel: { bg: COR.surface, ink: COR.ink, muted: COR.inkMuted, rule: COR.rule, escuro: false, ponto: COR.accent },
  areia: { bg: COR.surfaceWarm, ink: COR.ink, muted: COR.inkMuted, rule: "#e6d8c6", escuro: false, ponto: "#d9823f" },
};

/** "Cor" do post na grade do perfil, para comparar vizinhos. */
export function chaveVisual(card: { formato?: string; fundo?: string } | null | undefined, tipo?: string): string {
  const f = card?.formato ?? tipo;
  if (f === "foto") return "foto";
  if (f === "alerta") return (card as { fundo?: string } | null | undefined)?.fundo === "papel" ? "claro" : "alerta";
  if (f === "giro-capa" || f === "giro" || f === "coluna") return "claro";
  if (f === "tipografico") {
    const fu = (card?.fundo ?? "tinta") as Fundo;
    return fu === "verde" ? "verde" : fu === "papel" || fu === "areia" ? "claro" : "escuro";
  }
  return f ?? "escuro";
}

/** Fundo diferente dos vizinhos (anterior e seguinte na grade). */
export function escolherFundo(vizinhos: Array<string | null | undefined>, ordem: Fundo[] = ["tinta", "verde", "papel", "areia"]): Fundo {
  const proibidas = new Set(vizinhos.filter(Boolean));
  return ordem.find((f) => !proibidas.has(chaveVisual({ formato: "tipografico", fundo: f }))) ?? "verde";
}

// Tag da editoria (canto do card): ícone + nome, para diferenciar cards vizinhos.
const ICONES: Record<string, string> = {
  seguranca: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  mundo: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ambiente: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  economia: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  saude: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  educacao: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  transito: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  clima: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6M8 14v6M12 16v6"/>',
  cultura: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  brasil: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  cidades: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  geral: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>',
};
/** Ícone da tag a partir do nome da editoria. */
export function iconeDaEditoria(nome: string): string {
  const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/segur|polic/.test(n)) return "seguranca";
  if (/mundo|internac/.test(n)) return "mundo";
  if (/ambient|clima|tempo/.test(n)) return /tempo|clima/.test(n) ? "clima" : "ambiente";
  if (/econ|agro|negoc/.test(n)) return "economia";
  if (/saude/.test(n)) return "saude";
  if (/educa/.test(n)) return "educacao";
  if (/transit|rodov/.test(n)) return "transito";
  if (/cultur|evento|lazer/.test(n)) return "cultura";
  if (/brasil|nacional/.test(n)) return "brasil";
  if (/cidade/.test(n)) return "cidades";
  return "geral";
}
function tagEditoria(texto: string, cor: string, fundoTag: string): No {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONES[iconeDaEditoria(texto)]}</svg>`;
  return div(
    { alignItems: "center", gap: 12, padding: "10px 20px 10px 14px", border: `2px solid ${cor}`, borderRadius: 999, background: fundoTag },
    h("img", { src: svgDataUri(svg), width: 34, height: 34 }),
    h("span", { style: { fontFamily: F.chapeu, fontWeight: 700, fontSize: 28, letterSpacing: "0.12em", textTransform: "uppercase", color: cor } }, texto),
  );
}

export type CardTipografico = {
  formato: "tipografico";
  chapeu: string;
  cor: string; // cor de escopo para fundo escuro
  corClara?: string; // cor de escopo para fundo claro
  fundo?: Fundo;
  tag?: string | null; // editoria, no canto superior direito
  titulo: string;
  linhaFina?: string | null;
  destaque?: { valor: string; rotulo: string } | null;
  cta?: string;
};

export type CardAlerta = {
  formato: "alerta";
  chapeu: string;
  quando?: string | null;
  titulo: string;
  dados: Array<{ valor: string; unidade?: string; rotulo: string }>;
  orientacao?: string | null;
  cta?: string;
  /** "vermelho" (padrão) ou "papel": fundo claro com faixa vermelha, para não
   *  repetir a cor de um alerta vizinho na grade. */
  fundo?: "vermelho" | "papel";
};

export type CardGiroCapa = {
  formato: "giro-capa";
  data: string;
  itens: Array<{ regiao: string; cidade?: string | null; titulo: string }>;
};

export type CardColuna = {
  formato: "coluna";
  coluna: string;
  titulo: string;
  linhaFina?: string | null;
  notas: string[];
  cta?: string;
};

export type Card = CardFoto | CardTipografico | CardAlerta | CardGiroCapa | CardColuna;

const W = 1080;
const H = 1440;

function cardFoto(c: CardFoto): No {
  const tam = corpoTitulo(c.titulo, 84);
  return div(
    { position: "relative", width: W, height: H, background: COR.dark, overflow: "hidden" },
    h("img", { src: c.foto, width: W, height: H, style: { position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" } }),
    div({
      position: "absolute", left: 0, top: 0, width: W, height: H,
      backgroundImage: c.lamina
        ? "linear-gradient(180deg, rgba(15,23,20,0.55) 0%, rgba(15,23,20,0) 18%, rgba(15,23,20,0) 38%, rgba(15,23,20,0.84) 64%, rgba(15,23,20,0.96) 100%)"
        : "linear-gradient(180deg, rgba(15,23,20,0) 32%, rgba(15,23,20,0.82) 60%, rgba(15,23,20,0.96) 100%)",
    }),
    c.lamina
      ? div(
        { position: "absolute", left: 72, right: 72, top: 56, alignItems: "center", justifyContent: "space-between" },
        h("span", { style: { fontFamily: F.chapeu, fontWeight: 700, fontSize: 28, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ffffff" } }, c.lamina.rotulo),
        div({ gap: 8 }, ...Array.from({ length: c.lamina.total }, (_, i) => div({ width: c.lamina!.total > 6 ? 32 : 56, height: 6, background: i + 1 === c.lamina!.atual ? "#ffffff" : "rgba(255,255,255,0.35)" }))),
      )
      : c.tag ? div({ position: "absolute", top: 48, right: 56 }, tagEditoria(c.tag, "#ffffff", "rgba(15,23,20,0.45)")) : null,
    div(
      { position: "absolute", left: 72, right: 72, bottom: 168, flexDirection: "column" },
      chapeuBalao(c.chapeu, c.cor),
      tituloComPonto(c.titulo, { marginTop: 44, fontFamily: F.titulo, fontWeight: 700, fontSize: tam, lineHeight: 1.04, letterSpacing: -0.8, color: "#ffffff" }, COR.accent, Math.round(tam * 0.21)),
      c.linhaFina ? h("span", { style: { marginTop: 26, fontFamily: F.titulo, fontSize: 34, lineHeight: 1.32, color: "#d9e3dd" } }, limitar(c.linhaFina, 150)) : null,
    ),
    div(
      { position: "absolute", left: 72, right: 72, bottom: 56, flexDirection: "column" },
      rodape(true, [CTA(c.cta ?? "Leia no link da bio", "#ffffff"), c.credito ? CREDITO(limitar(c.credito, 60), COR.darkMuted) : null], "rgba(255,255,255,0.22)"),
    ),
  );
}

function cardTipografico(c: CardTipografico): No {
  const tam = corpoTitulo(c.titulo, c.destaque ? 74 : 96);
  const t = TOM[c.fundo ?? "tinta"];
  const corEscopo = c.fundo === "verde" ? COR.accent : t.escuro ? c.cor : (c.corClara ?? COR.brand);
  return div(
    { width: W, height: H, padding: "112px 72px 56px 72px", background: t.bg, flexDirection: "column", position: "relative" },
    c.tag ? div({ position: "absolute", top: 40, right: 56 }, tagEditoria(c.tag, t.escuro ? "#ffffff" : COR.brand, t.escuro ? "rgba(255,255,255,0.06)" : "rgba(30,91,69,0.06)")) : null,
    div({ marginTop: c.tag ? 30 : 0 }, chapeuBalao(c.chapeu, corEscopo)),
    c.destaque
      ? div(
        { flexDirection: "column", marginTop: 64 },
        h("span", { style: { fontFamily: F.titulo, fontWeight: 700, fontSize: c.destaque.valor.length > 8 ? 150 : c.destaque.valor.length > 6 ? 200 : 300, lineHeight: 0.86, letterSpacing: -8, color: t.ink } }, c.destaque.valor),
        h("span", { style: { marginTop: 18, fontFamily: F.chapeu, fontWeight: 600, fontSize: 34, letterSpacing: "0.08em", textTransform: "uppercase", color: corEscopo } }, c.destaque.rotulo),
      )
      : null,
    tituloComPonto(c.titulo, { marginTop: c.destaque ? 64 : 56, fontFamily: F.titulo, fontWeight: 700, fontSize: tam, lineHeight: 1.06, letterSpacing: -0.6, color: t.ink }, t.ponto, Math.round(tam * 0.21)),
    c.linhaFina ? h("span", { style: { marginTop: 28, fontFamily: F.titulo, fontSize: 34, lineHeight: 1.32, color: t.muted } }, limitar(c.linhaFina, 170)) : null,
    div({ flexGrow: 1 }),
    rodape(t.escuro, [CTA(c.cta ?? "Leia no link da bio", t.ink)], t.rule),
  );
}

function cardAlerta(c: CardAlerta): No {
  const tam = corpoTitulo(c.titulo, 92);
  const papel = c.fundo === "papel";
  // Paleta das duas versões: vermelho (texto branco) e papel (texto tinta, faixa vermelha).
  const t = papel
    ? { bg: COR.surfaceWarm, ink: COR.ink, sub: COR.alerta, caixa: "rgba(184,36,26,0.08)", seloBg: COR.alerta, seloTx: "#ffffff", balao: COR.alerta, regra: COR.rule }
    : { bg: COR.alerta, ink: "#ffffff", sub: "#ffe1dd", caixa: "rgba(0,0,0,0.22)", seloBg: "#ffffff", seloTx: COR.alerta, balao: "#ffffff", regra: "rgba(255,255,255,0.3)" };
  const triangulo = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${t.seloTx}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  const dados = c.dados.slice(0, 3);
  return div(
    { width: W, height: H, padding: "88px 72px 56px 72px", background: t.bg, flexDirection: "column", color: t.ink, position: "relative", ...(papel ? { borderLeft: `28px solid ${COR.alerta}` } : {}) },
    div(
      { alignItems: "center", justifyContent: "space-between" },
      div(
        { alignItems: "center", gap: 16, padding: "14px 26px", background: t.seloBg, borderRadius: 4 },
        h("img", { src: svgDataUri(triangulo), width: 40, height: 40 }),
        h("span", { style: { fontFamily: F.chapeu, fontWeight: 700, fontSize: 44, lineHeight: 1, letterSpacing: "0.14em", color: t.seloTx } }, "ALERTA"),
      ),
      c.quando ? h("span", { style: { fontFamily: F.ui, fontWeight: 600, fontSize: 26, color: t.sub } }, c.quando) : null,
    ),
    div({ marginTop: 88 }, chapeuBalao(c.chapeu, t.balao)),
    tituloComPonto(c.titulo, { marginTop: 44, fontFamily: F.titulo, fontWeight: 700, fontSize: tam, lineHeight: 1.02, letterSpacing: -1, color: t.ink }, COR.accent, Math.round(tam * 0.2)),
    dados.length
      ? div(
        { marginTop: 64, gap: 16 },
        ...dados.map((d) =>
          div(
            { flexDirection: "column", gap: 6, padding: "22px 22px", background: t.caixa, flexGrow: 1, flexBasis: 0 },
            div(
              { alignItems: "baseline" },
              h("span", { style: { fontFamily: F.titulo, fontWeight: 700, fontSize: d.valor.length > 6 ? 48 : 64, lineHeight: 1 } }, d.valor),
              d.unidade ? h("span", { style: { fontFamily: F.titulo, fontWeight: 700, fontSize: 30, marginLeft: 8 } }, d.unidade) : null,
            ),
            h("span", { style: { fontFamily: F.ui, fontWeight: 600, fontSize: 24, color: t.sub } }, d.rotulo),
          )
        ),
      )
      : null,
    div(
      { marginTop: 40, flexDirection: "column", gap: 14, fontFamily: F.ui, fontWeight: 600, fontSize: 30, lineHeight: 1.3 },
      c.orientacao ? h("span", {}, limitar(c.orientacao, 140)) : null,
      h("span", {}, "Emergência: Defesa Civil 199 · Bombeiros 193"),
    ),
    div({ flexGrow: 1 }),
    rodape(!papel, [CTA(c.cta ?? "Mais informações no link da bio", t.ink)], t.regra),
  );
}

function cardGiroCapa(c: CardGiroCapa): No {
  const itens = c.itens.slice(0, 10);
  const compacto = itens.length > 6;
  const seta = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14211c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`;
  return div(
    { width: W, height: H, padding: `${compacto ? 80 : 104}px 72px 56px 72px`, background: COR.surfaceRaised, flexDirection: "column", color: COR.ink },
    chapeuBalao("Paraná · Giro das regiões", ESCOPO.parana.claro),
    tituloComPonto("Giro pelo Paraná", { marginTop: 44, fontFamily: F.titulo, fontWeight: 700, fontSize: compacto ? 96 : 128, lineHeight: 0.94, letterSpacing: -2, color: COR.ink }, COR.accent, compacto ? 18 : 22),
    h("span", { style: { marginTop: 20, fontFamily: F.ui, fontWeight: 600, fontSize: 30, color: COR.inkMuted } }, `${c.data} · ${itens.length} ${itens.length === 1 ? "região" : "regiões"}`),
    div(
      { marginTop: compacto ? 36 : 56, flexDirection: "column", borderTop: `2px solid ${COR.ink}` },
      ...itens.map((it, i) => {
        const cor = COR_REGIAO[it.regiao] ?? COR.brand;
        return div(
          { gap: 20, padding: compacto ? "14px 0" : "24px 0", borderBottom: `1px solid ${COR.rule}`, alignItems: "flex-start" },
          h("span", { style: { width: compacto ? 48 : 64, fontFamily: F.titulo, fontWeight: 700, fontSize: compacto ? 40 : 52, lineHeight: 1, color: cor } }, String(i + 1)),
          div(
            { flexDirection: "column", gap: compacto ? 2 : 6, flexGrow: 1, flexBasis: 0 },
            h("span", { style: { fontFamily: F.chapeu, fontWeight: 700, fontSize: compacto ? 22 : 26, letterSpacing: "0.08em", textTransform: "uppercase", color: cor } }, [NOME_REGIAO[it.regiao] ?? it.regiao, it.cidade].filter(Boolean).join(" · ")),
            h("span", { style: { fontFamily: F.titulo, fontWeight: 600, fontSize: compacto ? 28 : 36, lineHeight: 1.18 } }, limitar(it.titulo, compacto ? 70 : 80)),
          ),
        );
      }),
    ),
    div({ flexGrow: 1 }),
    rodape(false, [div({ alignItems: "center", gap: 10 }, CTA("Arraste para o lado", COR.ink), h("img", { src: svgDataUri(seta), width: 28, height: 28 }))], COR.rule),
  );
}

function cardColuna(c: CardColuna): No {
  const tam = corpoTitulo(c.titulo, 100);
  const notas = c.notas.slice(0, 6);
  return div(
    { width: W, height: H, padding: "104px 72px 56px 72px", background: COR.surfaceWarm, flexDirection: "column", color: COR.ink },
    chapeuBalao(`Coluna · ${c.coluna}`, COR.brand),
    tituloComPonto(c.titulo, { marginTop: 52, fontFamily: F.titulo, fontWeight: 700, fontSize: tam, lineHeight: 1, letterSpacing: -1.4, color: COR.ink }, COR.accent, Math.round(tam * 0.2)),
    c.linhaFina ? h("span", { style: { marginTop: 32, fontFamily: F.titulo, fontStyle: "italic", fontSize: 36, lineHeight: 1.34, color: COR.inkMuted } }, limitar(c.linhaFina, 190)) : null,
    notas.length
      ? div(
        { marginTop: 64, borderTop: `2px solid ${COR.ink}`, paddingTop: 22, flexDirection: "column", gap: 16 },
        h("span", { style: { fontFamily: F.chapeu, fontWeight: 700, fontSize: 26, letterSpacing: "0.1em", textTransform: "uppercase", color: COR.inkMuted } }, "Nesta edição"),
        div(
          { flexWrap: "wrap", gap: "18px 40px" },
          ...notas.map((n) => h("span", { style: { width: 448, fontFamily: F.titulo, fontWeight: 600, fontSize: 38, lineHeight: 1.2 } }, limitar(n, 40))),
        ),
      )
      : null,
    div({ flexGrow: 1 }),
    rodape(false, [CTA(c.cta ?? "A coluna inteira no link da bio", COR.ink)], "#e6d8c6"),
  );
}

export function arvoreDoCard(c: Card): No {
  switch (c.formato) {
    case "foto": return cardFoto(c);
    case "tipografico": return cardTipografico(c);
    case "alerta": return cardAlerta(c);
    case "giro-capa": return cardGiroCapa(c);
    case "coluna": return cardColuna(c);
  }
}

export const LARGURA = W;
export const ALTURA = H;

/** Fontes que o Satori precisa (nome, peso, estilo, arquivo .woff do @fontsource). */
export const FONTES = [
  { name: "Newsreader", weight: 400, style: "normal", arquivo: "newsreader/files/newsreader-latin-400-normal.woff" },
  { name: "Newsreader", weight: 400, style: "italic", arquivo: "newsreader/files/newsreader-latin-400-italic.woff" },
  { name: "Newsreader", weight: 600, style: "normal", arquivo: "newsreader/files/newsreader-latin-600-normal.woff" },
  { name: "Newsreader", weight: 700, style: "normal", arquivo: "newsreader/files/newsreader-latin-700-normal.woff" },
  { name: "Barlow", weight: 500, style: "normal", arquivo: "barlow/files/barlow-latin-500-normal.woff" },
  { name: "Barlow", weight: 600, style: "normal", arquivo: "barlow/files/barlow-latin-600-normal.woff" },
  { name: "Barlow Condensed", weight: 600, style: "normal", arquivo: "barlow-condensed/files/barlow-condensed-latin-600-normal.woff" },
  { name: "Barlow Condensed", weight: 700, style: "normal", arquivo: "barlow-condensed/files/barlow-condensed-latin-700-normal.woff" },
  { name: "Fraunces", weight: 700, style: "normal", arquivo: "fraunces/files/fraunces-latin-700-normal.woff" },
] as const;
