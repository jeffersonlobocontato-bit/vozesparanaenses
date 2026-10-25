import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { listInstagramPublicados, type PostInstagramPublico } from "@/lib/instagram.functions";

// Link da bio do @vozesparanaenses: cada post do Instagram com a matéria
// por trás dele. O Giro pelo Paraná abre a lista das regiões.

const postsQO = queryOptions({
  queryKey: ["instagram-publicados"],
  queryFn: () => listInstagramPublicados(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/instagram")({
  head: () => ({
    meta: [
      { title: "Do Instagram — Vozes Paranaenses" },
      { name: "description", content: "As matérias dos posts do @vozesparanaenses no Instagram, do mais novo ao mais antigo." },
      { property: "og:title", content: "Do Instagram — Vozes Paranaenses" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQO),
  component: InstagramPage,
  errorComponent: () => <div className="p-8 text-center text-sm text-slate-600">Não foi possível carregar os posts agora.</div>,
});

const caminho = (url: string) => url.replace(/^https:\/\/vozesparanaenses\.com\.br/, "") || "/";
const quando = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function InstagramPage() {
  const { data: posts } = useSuspenseQuery(postsQO);
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B5651D]">@vozesparanaenses</p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-[#12201E] md:text-5xl">Do Instagram para a matéria</h1>
        <p className="mt-2 text-slate-600">Toque no post que você viu para ler a matéria completa.</p>
        {posts.length === 0 ? (
          <p className="mt-10 text-sm text-slate-500">Os posts aparecem aqui assim que forem publicados.</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {posts.map((p) => <Item key={p.id} post={p} />)}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Item({ post }: { post: PostInstagramPublico }) {
  const imagem = post.imagem ? (
    <img src={post.imagem} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-lg border border-slate-200 object-cover" />
  ) : (
    <div className="aspect-[3/4] w-full rounded-lg bg-slate-100" />
  );
  if (post.links.length <= 1) {
    const l = post.links[0];
    return (
      <li>
        <a href={l ? caminho(l.url) : "/"} className="group block">
          {imagem}
          <p className="mt-2 line-clamp-3 text-sm font-semibold leading-snug text-[#12201E] group-hover:underline">{l?.titulo || "Ver no portal"}</p>
          <p className="mt-0.5 text-xs text-slate-500">{quando(post.publicado_em)}</p>
        </a>
      </li>
    );
  }
  return (
    <li className="col-span-2 sm:col-span-3">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-3 sm:flex-row">
        <div className="w-full max-w-[180px] shrink-0">{imagem}</div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B5651D]">
            {post.tipo === "giro" ? "Giro pelo Paraná" : "Neste post"} · {quando(post.publicado_em)}
          </p>
          <ol className="mt-2 space-y-1.5">
            {post.links.map((l) => (
              <li key={l.url}>
                <a href={caminho(l.url)} className="inline-flex items-start gap-1 text-sm font-semibold leading-snug text-[#12201E] hover:underline">
                  {l.titulo} <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </li>
  );
}
