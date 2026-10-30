import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { buscarMaterias } from "@/lib/busca.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

// Busca do site. O parâmetro "q" é lido pela medição otimizada do GA4
// (evento view_search_results) e é o alvo do SearchAction do JSON-LD.

const buscaQO = (q: string) =>
  queryOptions({
    queryKey: ["busca", q],
    queryFn: () => buscarMaterias({ data: { q } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/busca")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q.slice(0, 80) : "",
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ context, deps }) => {
    if (deps.q.trim().length >= 2) await context.queryClient.ensureQueryData(buscaQO(deps.q.trim()));
  },
  head: () => ({
    meta: [
      { title: "Buscar — Vozes Paranaenses" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [texto, setTexto] = useState(q);
  useEffect(() => setTexto(q), [q]);
  const termo = q.trim();
  const { data: resultados = [], isFetching } = useQuery({ ...buscaQO(termo), enabled: termo.length >= 2 });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Barlow',system-ui,sans-serif]">
      <SiteHeader />
      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E29F65]">Buscar</div>
          <form
            role="search"
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/busca", search: { q: texto.trim() } });
            }}
          >
            <input
              type="search"
              name="q"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cidade, assunto, nome…"
              aria-label="Buscar no Vozes Paranaenses"
              autoFocus
              className="min-w-0 flex-1 rounded-full border-2 border-[#12201E] px-5 py-3 text-base outline-none focus:border-[#E29F65]"
            />
            <button type="submit" className="rounded-full bg-[#12201E] px-6 py-3 text-sm font-bold text-white hover:bg-[#1d3330]">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        {termo.length < 2 ? (
          <p className="text-sm text-slate-500">Digite pelo menos duas letras.</p>
        ) : isFetching && resultados.length === 0 ? (
          <p className="text-sm text-slate-500">Buscando…</p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma matéria encontrada para “{termo}”.</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              {resultados.length} {resultados.length === 1 ? "matéria" : "matérias"} para “{termo}”
            </p>
            <ul className="divide-y divide-slate-200">
              {resultados.map((a) =>
                a.region ? (
                  <li key={a.id}>
                    <Link
                      to="/$region/$slug"
                      params={{ region: a.region.slug, slug: a.slug }}
                      className="group flex gap-4 py-4"
                    >
                      {a.cover_image_url && (
                        <img src={a.cover_image_url} alt="" loading="lazy" className="h-20 w-28 shrink-0 object-cover sm:h-24 sm:w-36" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#E29F65]">
                          {[a.categoria?.name, a.region.name].filter(Boolean).join(" · ")}
                          {a.published_at && (
                            <span className="ml-2 font-semibold normal-case tracking-normal text-slate-400">
                              {new Date(a.published_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                            </span>
                          )}
                        </div>
                        <h2 className="mt-1 font-['Newsreader',serif] text-lg font-semibold leading-snug text-[#12201E] group-hover:underline sm:text-xl">
                          {a.title}
                        </h2>
                        {a.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.summary}</p>}
                      </div>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
