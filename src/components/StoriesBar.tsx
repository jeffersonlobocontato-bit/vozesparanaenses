import { Link } from "@tanstack/react-router";
import type { ArticleListItem, ColunaAtalho } from "@/lib/content.functions";

export type StoryTopic = {
  label: string;
  categorySlug: string;
  artigos: ArticleListItem[];
};

type StoryItem = {
  key: string;
  label: string;
  image: string | null;
  to: string;
  params: Record<string, string>;
};

function initials(text: string) {
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Barra de "stories" no topo do mobile: círculos roláveis com a foto real da
 * última matéria de cada editoria em destaque e das colunas do portal.
 */
export function StoriesBar({
  topicos,
  colunas = [],
}: {
  topicos: StoryTopic[];
  colunas?: ColunaAtalho[];
}) {
  const items: StoryItem[] = [];

  for (const t of topicos) {
    const comFoto = t.artigos.find((a) => !!a.cover_image_url);
    if (!comFoto) continue;
    items.push({
      key: `cat-${t.categorySlug}`,
      label: t.label,
      image: comFoto.cover_image_url,
      to: "/editoria/$categoria",
      params: { categoria: t.categorySlug },
    });
  }

  for (const c of colunas) {
    if (!c.edicao) continue;
    items.push({
      key: `col-${c.slug}`,
      label: c.nome,
      image: c.foto_colunista_url ?? c.edicao.imagem_principal_url ?? null,
      to: "/coluna/$slug/$edicaoId",
      params: { slug: c.slug, edicaoId: c.edicao.slug ?? c.edicao.id },
    });
  }

  if (items.length === 0) return null;

  return (
    <nav aria-label="Atalhos em destaque" className="border-b border-slate-100 bg-white md:hidden">
      <ul className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s) => (
          <li key={s.key} className="shrink-0">
            <Link
              to={s.to as never}
              params={s.params as never}
              className="flex w-[72px] flex-col items-center gap-1.5"
            >
              <span className="block rounded-full bg-gradient-to-tr from-[#0A2540] to-[#2E6DA4] p-[2px]">
                <span className="block rounded-full bg-white p-[2px]">
                  {s.image ? (
                    <img
                      src={s.image}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0A2540] text-sm font-bold text-white">
                      {initials(s.label)}
                    </span>
                  )}
                </span>
              </span>
              <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-slate-700">
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
