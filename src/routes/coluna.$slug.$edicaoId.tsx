import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import {
  getColunaEdicaoPorId,
  listColunasAtalhos,
  listArticlesByCategoryGlobal,
  type ColunaNota,
} from "@/lib/content.functions";
import { ColumnSidebar, ColumnFooterTaxonomy } from "@/components/ColumnTaxonomy";

export const Route = createFileRoute("/coluna/$slug/$edicaoId")({
  loader: async ({ params }) => {
    const [edicao, colunas, politica, eleicoes] = await Promise.all([
      getColunaEdicaoPorId({ data: { id: params.edicaoId } }),
      listColunasAtalhos(),
      listArticlesByCategoryGlobal({ data: { categorySlug: "politica", limit: 11, requireImage: false } }),
      listArticlesByCategoryGlobal({ data: { categorySlug: "eleicoes-2026", limit: 11, requireImage: false } }),
    ]);
    if (!edicao) throw notFound();
    return { edicao, taxonomia: { colunas, politica, eleicoes } };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.edicao.titulo} — Vozes Paranaenses` },
      { name: "description", content: loaderData.edicao.subtitulo ?? "" },
    ] : [],
  }),
  component: ColunaEdicaoPage,
});

function ColunaEdicaoPage() {
  const { edicao, taxonomia } = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <main className="min-w-0">
        <Link to="/coluna/$slug/arquivo" params={{ slug }} className="text-sm font-semibold text-[#0066CC] hover:underline">
          ← Ver todas as edições
        </Link>

        {edicao.imagem_principal_url && (
          <img src={edicao.imagem_principal_url} alt={edicao.titulo} className="mt-4 h-56 w-full rounded-xl object-cover sm:h-72" />
        )}

        <h1 className="font-display mt-4 text-3xl font-black leading-tight text-[#0A2540] sm:text-4xl">
          {edicao.titulo}
        </h1>
        {edicao.subtitulo && <p className="mt-2 text-base font-medium text-slate-600">{edicao.subtitulo}</p>}
        {edicao.publicado_em && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {new Date(edicao.publicado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        )}

        <div className="mt-6 space-y-6">
          {edicao.notas.map((nota: ColunaNota) => (
            <div key={nota.id} className="border-l-2 border-[#0066CC] pl-4">
              <h2 className="font-display text-lg font-bold text-[#0A2540]">{nota.titulo_gatilho}</h2>
              {nota.imagem_url && (
                <img src={nota.imagem_url} alt="" className="my-3 w-full max-w-md rounded-lg object-cover sm:float-left sm:mr-4 sm:w-56" />
              )}
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{nota.corpo}</p>
              <div className="clear-both" />
            </div>
          ))}
        </div>

        {edicao.pergunta_engajamento && (
          <div className="mt-7 rounded-xl bg-[#0066CC]/5 p-4">
            <p className="text-sm font-semibold text-[#0A2540]">🗳️ {edicao.pergunta_engajamento}</p>
          </div>
        )}

        <ColumnFooterTaxonomy data={taxonomia} />
      </main>
      <ColumnSidebar data={taxonomia} currentSlug={slug} />
      </div>
      <SiteFooter />
    </div>
  );
}
