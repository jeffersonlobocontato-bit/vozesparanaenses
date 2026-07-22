import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getRegionBySlug,
  listClassificados,
  createClassificado,
} from "@/lib/content.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

const regionQO = (slug: string) =>
  queryOptions({ queryKey: ["region", slug], queryFn: () => getRegionBySlug({ data: { slug } }) });
const listQO = (slug: string) =>
  queryOptions({
    queryKey: ["classificados", slug],
    queryFn: () => listClassificados({ data: { regionSlug: slug } }),
  });

export const Route = createFileRoute("/$region/classificados")({
  loader: async ({ context, params }) => {
    const region = await context.queryClient.ensureQueryData(regionQO(params.region));
    const items = await context.queryClient.ensureQueryData(listQO(params.region));
    return { region, items };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `Classificados — ${loaderData.region.name} — Vozes Paranaenses` },
            {
              name: "description",
              content: `Classificados de emprego, imóveis e veículos em ${loaderData.region.name}.`,
            },
            // Sem anúncio classificado ainda nesta região: não indexa até ter
            // conteúdo de verdade — mesma regra já aplicada em cidade/editoria,
            // que faltava aqui (é a página que mais aparecia rankeando mal no
            // Search Console, e o motivo era só este: nunca decidia noindex
            // porque o loader não devolvia a lista pro head() checar).
            {
              name: "robots",
              content: (loaderData.items?.length ?? 0) > 0 ? "index, follow" : "noindex, follow",
            },
          ],
        }
      : { meta: [] },
  component: ClassificadosPage,
  notFoundComponent: () => <div className="p-8 text-center">Região não encontrada.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-slate-600">Erro: {error.message}</div>
  ),
});

function ClassificadosPage() {
  const { region: slug } = Route.useParams();
  const { data: region } = useSuspenseQuery(regionQO(slug));
  const { data: items } = useSuspenseQuery(listQO(slug));
  const router = useRouter();
  const create = useServerFn(createClassificado);

  const [cat, setCat] = useState<"emprego" | "imovel" | "veiculo">("emprego");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contato, setContato] = useState("");

  const mutation = useMutation({
    mutationFn: create,
    onSuccess: () => {
      setTitulo("");
      setDescricao("");
      setContato("");
      router.invalidate();
    },
  });

  const tema = region.tema_config ?? {};
  const primary = tema.paleta?.primaria ?? "#0A2540";

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A2540]/70">
            {region.name}
          </div>
          <h1 className="mt-1 font-display text-5xl leading-[1.02] text-[#0A2540] md:text-6xl">
            Classificados
          </h1>
          <p className="mt-2 text-slate-600">Emprego, imóveis e veículos publicados por moradores da região.</p>

          <div className="mt-8 space-y-3">
            {items.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
                Nenhum classificado ativo no momento. Seja o primeiro a publicar.
              </div>
            ) : (
              items.map((c) => (
                <article key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {c.categoria}
                  </div>
                  <h3 className="mt-1 font-bold text-slate-900">{c.titulo}</h3>
                  {c.descricao && <p className="mt-1 text-sm text-slate-600">{c.descricao}</p>}
                  {c.contato && (
                    <p className="mt-2 text-sm text-slate-800">
                      Contato: <span className="font-semibold">{c.contato}</span>
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-primary">Publicar classificado</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({
                data: { regionSlug: slug, categoria: cat, titulo, descricao, contato },
              });
            }}
          >
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value as typeof cat)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="emprego">Emprego</option>
              <option value="imovel">Imóvel</option>
              <option value="veiculo">Veículo</option>
            </select>
            <input
              required
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Contato (telefone/e-mail)"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {mutation.isPending ? "Publicando..." : "Publicar"}
            </button>
            {mutation.isError && (
              <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
            )}
          </form>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
