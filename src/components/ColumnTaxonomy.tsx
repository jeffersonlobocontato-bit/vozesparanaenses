import { Link } from "@tanstack/react-router";
import type { ArticleListItem, ColunaAtalho } from "@/lib/content.functions";

export type ColumnTaxonomyData = {
  colunas: ColunaAtalho[];
  politica: ArticleListItem[];
  eleicoes: ArticleListItem[];
};

function ArticleLine({ a }: { a: ArticleListItem }) {
  if (!a.region) return null;
  return (
    <Link
      to="/$region/$slug"
      params={{ region: a.region.slug, slug: a.slug }}
      className="group flex gap-3 border-b border-slate-100 py-3 last:border-b-0"
    >
      {a.cover_image_url && (
        <img src={a.cover_image_url} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-md object-cover" />
      )}
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-[#0066CC]">
          {a.region.name}
        </span>
        <span className="mt-0.5 line-clamp-3 block text-sm font-semibold leading-snug text-[#0A2540] group-hover:underline">
          {a.title}
        </span>
      </span>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display mb-2 border-b-2 border-[#0A2540] pb-1 text-sm font-black uppercase tracking-wide text-[#0A2540]">
      {children}
    </h2>
  );
}

/** Barra lateral das páginas de coluna: outras colunas + editorias Política e Eleições 2026. */
export function ColumnSidebar({
  data,
  currentSlug,
}: {
  data: ColumnTaxonomyData;
  currentSlug: string;
}) {
  const outras = data.colunas.filter((c) => c.slug !== currentSlug);
  return (
    <aside className="space-y-8">
      {outras.length > 0 && (
        <section>
          <SectionTitle>Outras colunas</SectionTitle>
          <div className="space-y-3 pt-1">
            {outras.map((c) => (
              <Link
                key={c.slug}
                to={c.edicao ? "/coluna/$slug/$edicaoId" : "/coluna/$slug/arquivo"}
                params={c.edicao ? { slug: c.slug, edicaoId: c.edicao.slug ?? c.edicao.id } : { slug: c.slug }}
                className="group flex items-center gap-3"
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200">
                  {c.foto_colunista_url && (
                    <img src={c.foto_colunista_url} alt={c.nome} className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-[#0066CC]">{c.nome}</span>
                  <span className="line-clamp-2 block text-sm font-semibold leading-snug text-[#0A2540] group-hover:underline">
                    {c.edicao?.titulo ?? "Ver edições"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.politica.length > 0 && (
        <section>
          <SectionTitle>Política</SectionTitle>
          {data.politica.slice(0, 5).map((a) => <ArticleLine key={a.id} a={a} />)}
          <Link to="/editoria/$categoria" params={{ categoria: "politica" }} className="mt-2 inline-block text-xs font-bold uppercase text-[#0066CC] hover:underline">
            Ver toda a editoria →
          </Link>
        </section>
      )}

      {data.eleicoes.length > 0 && (
        <section>
          <SectionTitle>Eleições 2026</SectionTitle>
          {data.eleicoes.slice(0, 5).map((a) => <ArticleLine key={a.id} a={a} />)}
          <Link to="/editoria/$categoria" params={{ categoria: "eleicoes-2026" }} className="mt-2 inline-block text-xs font-bold uppercase text-[#0066CC] hover:underline">
            Ver toda a editoria →
          </Link>
        </section>
      )}
    </aside>
  );
}

/** Rodapé de conteúdo das páginas de coluna: grade com mais matérias das duas editorias. */
export function ColumnFooterTaxonomy({ data }: { data: ColumnTaxonomyData }) {
  const blocos = [
    { titulo: "Mais de Política", slug: "politica", itens: data.politica.slice(5, 11) },
    { titulo: "Mais de Eleições 2026", slug: "eleicoes-2026", itens: data.eleicoes.slice(5, 11) },
  ].filter((b) => b.itens.length > 0);

  if (blocos.length === 0) return null;

  return (
    <section className="mt-12 border-t border-slate-200 pt-8">
      <div className="grid gap-8 md:grid-cols-2">
        {blocos.map((b) => (
          <div key={b.slug}>
            <SectionTitle>{b.titulo}</SectionTitle>
            <div className="grid gap-1">
              {b.itens.map((a) => <ArticleLine key={a.id} a={a} />)}
            </div>
            <Link to="/editoria/$categoria" params={{ categoria: b.slug }} className="mt-2 inline-block text-xs font-bold uppercase text-[#0066CC] hover:underline">
              Ver toda a editoria →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}