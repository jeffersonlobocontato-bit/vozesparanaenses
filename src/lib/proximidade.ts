// Proximidade da notícia em relação ao leitor — o código de cor do design
// system (chapéu): cidade › região › Paraná › Brasil › Mundo.

export type Escopo = "cidade" | "regiao" | "parana" | "brasil" | "mundo";

type ArtigoGeo = {
  cidade_principal?: string | null;
  cidades_mencionadas?: string[] | null;
  region?: { slug: string; name: string } | null;
  categoria?: { slug: string; name: string } | null;
};

export function normalizarNome(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** A notícia é da cidade do leitor? (cidade principal ou citada) */
export function ehDaCidade(a: ArtigoGeo, cidadeLeitor: string | null | undefined): boolean {
  const c = normalizarNome(cidadeLeitor);
  if (!c) return false;
  if (normalizarNome(a.cidade_principal) === c) return true;
  return (a.cidades_mencionadas ?? []).some((m) => normalizarNome(m) === c);
}

export function escopoDe(a: ArtigoGeo): Escopo {
  const reg = a.region?.slug;
  if (reg === "internacional") return "mundo";
  if (reg === "nacional") return "brasil";
  if (a.cidade_principal) return "cidade";
  if (reg) return "regiao";
  return "parana";
}

// Editorias que não acrescentam nada ao chapéu (já ditas pelo escopo).
const ASSUNTO_REDUNDANTE = new Set(["nacional", "internacional", "cidades"]);

/** Chapéu da notícia: rótulo de proximidade + assunto. */
export function chapeuDe(a: ArtigoGeo, cidadeLeitor?: string | null): {
  escopo: Escopo;
  rotulo: string;
  assunto: string | null;
  daCidadeDoLeitor: boolean;
} {
  const escopo = escopoDe(a);
  const rotulo =
    escopo === "mundo" ? "Mundo"
    : escopo === "brasil" ? "Brasil"
    : escopo === "cidade" ? (a.cidade_principal as string)
    : escopo === "regiao" ? (a.region?.name ?? "Paraná")
    : "Paraná";
  const cat = a.categoria;
  const assunto = cat && !ASSUNTO_REDUNDANTE.has(cat.slug) ? cat.name : null;
  return { escopo, rotulo, assunto, daCidadeDoLeitor: ehDaCidade(a, cidadeLeitor) };
}

export const COR_ESCOPO: Record<Escopo, string> = {
  cidade: "text-escopo-cidade",
  regiao: "text-escopo-regiao",
  parana: "text-escopo-parana",
  brasil: "text-escopo-brasil",
  mundo: "text-escopo-mundo",
};
