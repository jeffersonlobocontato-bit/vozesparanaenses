// Vozes Paranaenses — cidade e região da notícia
//
// A tag de REGIÃO vem da cidade de que a notícia FALA, nunca da cidade do
// jornal que publicou. Ex.: matéria sobre Palotina em jornal de Curitiba →
// região Oeste, não Metropolitana. A região da fonte só é usada como último
// recurso, e apenas quando a fonte é MUNICIPAL (prefeitura ou jornal de uma
// cidade só) — aí "não citou cidade nenhuma" significa "é da cidade-sede".

export type Cidade = { slug: string; nome: string; regiao_id: string };

export type FonteGeo = {
  regiao_id: string | null;
  cidade_slug?: string | null;
  abrangencia?: string | null;
};

export type Deteccao = { slug: string; regiao_id: string; via: "titulo" | "corpo" | "fonte" };

export function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Nomes de cidade que também são palavra comum, data, santo, sobrenome ou
// lugar de fora do PR. Só contam com contexto forte de lugar ("em Castro",
// "Prefeitura de Floresta", "município de São João") — "Fulano de Castro"
// ou "festa de São João" não fazem a notícia ser dessas cidades.
const NOMES_AMBIGUOS = new Set([
  "angulo", "atalaia", "bandeirantes", "barracao", "bom sucesso", "california", "castro",
  "ceu azul", "colombo", "colorado", "contenda", "farol", "faxinal", "fenix", "figueira",
  "floresta", "florida", "francisco alves", "ipiranga", "jussara", "lapa", "maria helena",
  "marmeleiro", "mercedes", "mirador", "palmas", "palmeira", "pinhao", "pitanga", "planalto",
  "porto rico", "primeiro de maio", "renascenca", "reserva", "roncador", "salgado filho",
  "santa fe", "santa helena", "sao joao", "sao tome", "terra roxa", "toledo", "turvo",
  "ventania", "vitorino", "antonina", "cruzeiro do sul", "rio negro", "nossa senhora das gracas",
]);

// "Curitiba, 22 de outubro" / "CURITIBA –" no início: dateline do veículo,
// não o assunto. Removido antes de contar.
function removerDateline(corpo: string): string {
  return corpo
    // "CURITIBA – texto" (tudo maiúsculo + travessão)
    .replace(/^\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{3,40}\s*[–—-]\s*/u, "")
    // "Curitiba, 22 de outubro de 2026 – texto"
    .replace(/^\s*[\p{L} ]{3,40},\s*\d{1,2}\s+de\s+\p{L}+(\s+de\s+\d{4})?\s*[–—-]?\s*/u, "");
}

/**
 * Detecta a cidade principal: cidade citada no TÍTULO vence; senão, a mais
 * citada no corpo (mínimo 2 menções, ou 1 com preposição "em/de/no/na").
 * Sem cidade no texto → cidade-sede da fonte, só se a fonte é municipal.
 */
export function detectarCidade(titulo: string, corpo: string, cidades: Cidade[], fonte?: FonteGeo): Deteccao | null {
  if (cidades.length) {
    const t = normalizar(titulo);
    const b = normalizar(removerDateline(corpo));
    let melhorTitulo: { c: Cidade; tam: number } | null = null;
    let melhorCorpo: { c: Cidade; score: number } | null = null;
    for (const c of cidades) {
      const n = normalizar(c.nome);
      if (n.length < 3) continue;
      const ambiguo = NOMES_AMBIGUOS.has(n);
      const lugarForte = new RegExp(`\\b(em|prefeitura( municipal)? de|municipio de|cidade de)\\s+${escapar(n)}\\b`);
      const re = new RegExp(`\\b${escapar(n)}\\b`);
      if (re.test(t) && (!ambiguo || lugarForte.test(t) || lugarForte.test(b))) {
        // Nome mais longo vence ("Foz do Iguaçu" > "Iguaçu"; "Campo Largo" > "Largo").
        if (!melhorTitulo || n.length > melhorTitulo.tam) melhorTitulo = { c, tam: n.length };
        continue;
      }
      const ocorrencias = (b.match(new RegExp(`\\b${escapar(n)}\\b`, "g")) ?? []).length;
      if (!ocorrencias) continue;
      if (ambiguo && !lugarForte.test(b)) continue;
      const comContexto = new RegExp(`\\b(em|de|no|na|do|da|para|prefeitura de|municipio de)\\s+${escapar(n)}\\b`).test(b);
      if (ocorrencias < 2 && !comContexto) continue;
      const score = ocorrencias + (comContexto ? 1 : 0);
      if (!melhorCorpo || score > melhorCorpo.score) melhorCorpo = { c, score };
    }
    if (melhorTitulo) return { slug: melhorTitulo.c.slug, regiao_id: melhorTitulo.c.regiao_id, via: "titulo" };
    if (melhorCorpo) return { slug: melhorCorpo.c.slug, regiao_id: melhorCorpo.c.regiao_id, via: "corpo" };
  }
  if (fonte?.abrangencia === "municipal" && fonte.cidade_slug) {
    const sede = cidades.find((c) => c.slug === fonte.cidade_slug);
    if (sede) return { slug: sede.slug, regiao_id: sede.regiao_id, via: "fonte" };
  }
  return null;
}

/** Acha a cidade pelo nome escrito (ex.: `cidade_principal` vinda da IA). */
export function cidadePorNome(nome: string | null | undefined, cidades: Cidade[]): Cidade | null {
  if (!nome) return null;
  const alvo = normalizar(nome).replace(/\s*[-–(\/].*$/, "").replace(/\s+pr$/, "").trim();
  return cidades.find((c) => normalizar(c.nome) === alvo) ?? null;
}

/** Carrega as 399 cidades ativas. */
// deno-lint-ignore no-explicit-any
export async function carregarCidades(sb: any): Promise<Cidade[]> {
  const { data } = await sb.from("cidades").select("slug, nome, regiao_id").eq("ativa", true).limit(1000);
  return (data ?? []) as Cidade[];
}
