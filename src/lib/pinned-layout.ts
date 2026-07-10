export type PinnableArticle = {
  id: string;
  fixado_posicao?: number | null;
};

function isPinned(article: PinnableArticle): boolean {
  return typeof article.fixado_posicao === "number" && article.fixado_posicao !== null;
}

export function arrangePinnedSlots<T extends PinnableArticle>(
  articles: readonly T[],
  sideSlotCount: number,
): { hero: T | undefined; side: T[]; rest: T[] } {
  const used = new Set<string>();

  const take = (article: T | undefined): T | undefined => {
    if (!article || used.has(article.id)) return undefined;
    used.add(article.id);
    return article;
  };

  const takePinned = (position: number) =>
    take(articles.find((article) => article.fixado_posicao === position));

  const takeNextUnpinned = () =>
    take(articles.find((article) => !used.has(article.id) && !isPinned(article)));

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