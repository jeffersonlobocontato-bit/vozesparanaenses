import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { listColunaEdicoes } from "@/lib/content.functions";

export const Route = createFileRoute("/coluna/$slug/arquivo")({
  loader: async ({ params }) => {
    const edicoes = await listColunaEdicoes({ data: { slug: params.slug } });
    return { edicoes };
  },
  head: ({ params }) => ({
    meta: [{ title: `Arquivo — ${params.slug.replace(/-/g, " ")} — Vozes Paranaenses` }],
  }),
  component: ColunaArquivo,
});

function ColunaArquivo() {
  const { edicoes } = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-black text-[#0A2540]">Edições anteriores</h1>
        <p className="mt-2 text-slate-600">Todas as publicações já saídas nesta coluna, da mais recente à mais antiga.</p>

        <div className="mt-8 space-y-4">
          {edicoes.map((e) => (
            <Link
              key={e.id}
              to="/coluna/$slug/$edicaoId"
              params={{ slug, edicaoId: e.id }}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0066CC]"
            >
              {e.imagem_principal_url && (
                <img src={e.imagem_principal_url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
              )}
              <div>
                {e.publicado_em && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0066CC]">
                    {new Date(e.publicado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                )}
                <p className="mt-1 font-display text-lg font-bold leading-tight text-[#0A2540]">{e.titulo}</p>
                {e.subtitulo && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{e.subtitulo}</p>}
              </div>
            </Link>
          ))}
          {edicoes.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">
              Ainda não há edições anteriores.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
