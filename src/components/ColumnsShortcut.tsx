import { Link } from "@tanstack/react-router";
import type { ColunaAtalho } from "@/lib/content.functions";

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Módulo de atalhos para as colunas do portal (estilo "Blogs e colunas" da CNN):
 * cada coluna ativa com edição publicada vira um card com foto, nome e chamada
 * da edição atual. Ao criar novas colunas, elas entram automaticamente aqui.
 */
export function ColumnsShortcut({ colunas }: { colunas: ColunaAtalho[] }) {
  if (!colunas.length) return null;

  return (
    <section className="mb-10">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="font-display shrink-0 text-3xl uppercase tracking-tight text-primary md:text-4xl">
          Colunas<span className="text-secondary">.</span>
        </h2>
        <div className="h-1 w-full rounded-full bg-slate-200">
          <div className="h-1 w-24 rounded-full bg-secondary" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {colunas.map((c) => (
          <Link
            key={c.slug}
            to="/coluna/$slug/$edicaoId"
            params={{ slug: c.slug, edicaoId: c.edicao!.slug ?? c.edicao!.id }}
            className="group flex flex-col gap-3 bg-white p-5 transition-colors hover:bg-accent"
          >
            <div className="flex min-w-0 items-center gap-3">
              {c.foto_colunista_url ? (
                <img
                  src={c.foto_colunista_url}
                  alt={c.nome}
                  loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-secondary"
                />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-secondary">
                  {iniciais(c.nome)}
                </span>
              )}
              <p className="min-w-0 truncate text-sm font-bold uppercase tracking-wider text-secondary">
                {c.nome}
              </p>
            </div>

            <h3 className="font-display text-xl leading-tight text-slate-900 group-hover:underline">
              {c.edicao!.titulo}
            </h3>
            {c.edicao!.subtitulo && (
              <p className="line-clamp-2 text-sm text-slate-600">{c.edicao!.subtitulo}</p>
            )}

            <span className="mt-auto pt-2 text-sm font-semibold text-primary">
              Ler a coluna completa →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
