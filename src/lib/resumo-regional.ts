// Resumo do dia por região, pronto para colar no canal/grupo de WhatsApp
// "Vozes {Região}" ou na legenda do Instagram da região. Sem IA: lista as
// matérias publicadas no dia (com foto primeiro, depois as mais recentes) e
// as notas da coluna regional, com link rastreado (utm) para o GA separar a
// audiência que vem de cada canal.

export const SITE = "https://vozesparanaenses.com.br";

export type ItemResumo = {
  titulo: string;
  slug: string;
  regiaoSlug: string;
  cidade: string | null;
  publicadoEm: string;
  temFoto: boolean;
};

export type NotaResumo = { titulo: string; cidade: string | null };

export type Canal = "whatsapp" | "instagram";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "quarta, 28/10" no fuso de Brasília. */
export function rotuloDoDia(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function linkRastreado(caminho: string, canal: Canal, regiaoSlug: string): string {
  const p = new URLSearchParams({ utm_source: canal, utm_medium: "social", utm_campaign: `resumo-${regiaoSlug}` });
  return `${SITE}${caminho}?${p.toString()}`;
}

/** Ordem do resumo: com foto primeiro (puxa mais clique), depois a mais recente. */
export function ordenarParaResumo(itens: ItemResumo[]): ItemResumo[] {
  return [...itens].sort((a, b) => Number(b.temFoto) - Number(a.temFoto) || b.publicadoEm.localeCompare(a.publicadoEm));
}

export function montarResumo(p: {
  regiaoSlug: string;
  regiaoNome: string;
  diaIso: string;
  itens: ItemResumo[];
  notas: NotaResumo[];
  canal: Canal;
  maximo?: number;
}): string {
  const max = p.maximo ?? 8;
  const itens = ordenarParaResumo(p.itens).slice(0, max);
  const negrito = (s: string) => (p.canal === "whatsapp" ? `*${s}*` : s);
  const linhas: string[] = [`${negrito(`Vozes ${p.regiaoNome}`)} · resumo de ${rotuloDoDia(p.diaIso)}`, ""];
  if (!itens.length && !p.notas.length) {
    linhas.push("Hoje não saiu notícia da região no portal.");
    return linhas.join("\n");
  }
  itens.forEach((it, i) => {
    const onde = it.cidade ? ` (${it.cidade})` : "";
    linhas.push(`${i + 1}. ${negrito(it.titulo)}${onde}`);
    if (p.canal === "whatsapp") linhas.push(linkRastreado(`/${it.regiaoSlug}/${it.slug}`, p.canal, p.regiaoSlug));
    linhas.push("");
  });
  if (p.notas.length) {
    linhas.push(negrito(`Notas da coluna Vozes ${p.regiaoNome}`));
    for (const n of p.notas.slice(0, 5)) linhas.push(`• ${n.titulo}${n.cidade ? ` (${n.cidade})` : ""}`);
    if (p.canal === "whatsapp") linhas.push(linkRastreado(`/vozes/${p.regiaoSlug}`, p.canal, p.regiaoSlug));
    linhas.push("");
  }
  if (p.canal === "whatsapp") {
    linhas.push(`Todas as notícias da região: ${linkRastreado(`/${p.regiaoSlug}`, p.canal, p.regiaoSlug)}`);
  } else {
    linhas.push("Leia todas no link da bio.");
    linhas.push(`#VozesParanaenses #${p.regiaoNome.replace(/[^\p{L}\p{N}]/gu, "")}`);
  }
  return linhas.join("\n").trim();
}
