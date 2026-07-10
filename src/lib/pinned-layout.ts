export type PinScope = "estado" | "regiao" | "cidades" | null | undefined;

export type PinnableArticle = {
  id: string;
  fixado_posicao?: number | null;
  fixado_escopo?: PinScope;
  fixado_regioes?: string[] | null;
  fixado_cidades?: string[] | null;
};

export type ViewerScope = {
  region?: string | null;
  city?: string | null;
};

function isPinned(article: PinnableArticle): boolean {
  return typeof article.fixado_posicao === "number" && article.fixado_posicao !== null;
}

/**
 * Um pin só é considerado "ativo" para o leitor se o escopo casar.
 *  - estado   → sempre ativo
 *  - regiao   → viewer tem região e ela está em fixado_regioes
 *  - cidades  → viewer tem cidade e ela está em fixado_cidades
 * Se o escopo é null (compat), trata como 'estado'.
 */
export function pinMatchesViewer(article: PinnableArticle, viewer: ViewerScope | undefined): boolean {
  if (!isPinned(article)) return false;
  const escopo: PinScope = article.fixado_escopo ?? "estado";
  if (escopo === "estado") return true;
  if (escopo === "regiao") {
    if (!viewer?.region) return false;
    return (article.fixado_regioes ?? []).includes(viewer.region);
  }
  if (escopo === "cidades") {
    if (!viewer?.city) return false;
    return (article.fixado_cidades ?? []).includes(viewer.city);
  }
  return true;
}

/** Peso de especificidade: cidade > região > estado. Usado como desempate. */
function scopeSpecificity(article: PinnableArticle): number {
  const e: PinScope = article.fixado_escopo ?? "estado";
  if (e === "cidades") return 3;
  if (e === "regiao") return 2;
  return 1;
}

export function arrangePinnedSlots<T extends PinnableArticle>(
  articles: readonly T[],
  sideSlotCount: number,
  viewer?: ViewerScope,
): { hero: T | undefined; side: T[]; rest: T[] } {
  const used = new Set<string>();

  const take = (article: T | undefined): T | undefined => {
    if (!article || used.has(article.id)) return undefined;
    used.add(article.id);
    return article;
  };

  const takePinned = (position: number) => {
    // Entre matérias fixadas nessa posição, escolhe a mais específica que casa com o viewer.
    const candidates = articles.filter(
      (a) =>
        a.fixado_posicao === position &&
        !used.has(a.id) &&
        pinMatchesViewer(a, viewer),
    );
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => scopeSpecificity(b) - scopeSpecificity(a));
    return take(candidates[0]);
  };

  const takeNextUnpinned = () =>
    take(
      articles.find(
        (article) =>
          !used.has(article.id) &&
          (!isPinned(article) || !pinMatchesViewer(article, viewer)),
      ),
    );

  const takeNextAny = () => take(articles.find((article) => !used.has(article.id)));
  const takeFallback = () => takeNextUnpinned() ?? takeNextAny();

  const hero = takePinned(0) ?? takeFallback();
  const side: T[] = [];

  for (let position = 1; position <= sideSlotCount; position += 1) {
    const article = takePinned(position) ?? takeFallback();
    if (article) side.push(article);
  }

  return {
    hero,
    side,
    rest: articles.filter((article) => !used.has(article.id)),
  };
}