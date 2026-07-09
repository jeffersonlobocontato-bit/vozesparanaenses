import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listRegions, listLatestArticles, type ArticleListItem, type Region } from "@/lib/content.functions";

const regionsQO = queryOptions({
  queryKey: ["regions"],
  queryFn: () => listRegions(),
});
const latestQO = queryOptions({
  queryKey: ["articles", "latest", 12],
  queryFn: () => listLatestArticles({ data: { limit: 12 } }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vozes Paranaenses — Notícias das 10 macrorregiões do Paraná" },
      {
        name: "description",
        content:
          "Cobertura editorial regional do Paraná: Metropolitana, Litoral, Campos Gerais, Norte Pioneiro, Norte Central, Noroeste, Centro Ocidental, Oeste, Sudoeste e Centro-Sul.",
      },
      { property: "og:title", content: "Vozes Paranaenses" },
      {
        property: "og:description",
        content: "Notícias das 10 macrorregiões do Paraná em um só lugar.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(regionsQO),
      context.queryClient.ensureQueryData(latestQO),
    ]);
  },
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar. {error.message}
    </div>
  ),
});

function Home() {
  const { data: regions } = useSuspenseQuery(regionsQO);
  const { data: articles } = useSuspenseQuery(latestQO);
  return <PortalHome regions={regions} articles={articles} />;
}

/* --------------------------- Filler manchetes --------------------------- */
/* Enquanto o pipeline não publica, exibimos manchetes plausíveis por região
   para que a home nunca apareça vazia. Substituídas automaticamente pelo
   conteúdo real assim que o artigo daquela região for publicado. */

const REGION_FALLBACK: Record<string, string> = {
  metropolitana: "Grande Curitiba integra tarifa entre 14 municípios da região",
  litoral: "Trecho da BR-277 é liberado após 12h de interdição em Paranaguá",
  "campos-gerais": "Indústrias de Ponta Grossa abrem mais de 500 vagas de emprego",
  "norte-pioneiro": "Jacarezinho recebe R$ 40 milhões para revitalização urbana",
  "norte-central": "Londrina lança programa de incentivo a startups de saúde",
  noroeste: "Setor de serviços lidera crescimento econômico em Umuarama",
  "centro-ocidental": "Campo Mourão inaugura polo tecnológico com apoio da UEM",
  oeste: "Cascavel bate recorde histórico de exportação de soja",
  sudoeste: "Francisco Beltrão inaugura novo hospital regional nesta semana",
  "centro-sul": "Guarapuava atrai investimento bilionário para energia renovável",
};

const HERO_FALLBACK = {
  category: "Destaque",
  title:
    "Governo anuncia novo pacote de investimentos em infraestrutura para os Campos Gerais",
  summary:
    "Obras incluem a duplicação de rodovias e a modernização do escoamento de safra, prometendo reduzir custos logísticos em até 15%.",
};

const SIDE_FALLBACK = [
  { cat: "Agronegócio", title: "Safra de soja no Paraná deve bater novo recorde histórico em 2024" },
  { cat: "Política", title: "Assembleia Legislativa vota hoje projeto que altera previdência estadual" },
  { cat: "Saúde", title: "Paraná reforça campanha de vacinação contra a gripe em todo o estado" },
];

const SECONDARY_FALLBACK = [
  { cat: "Esportes", title: "Paranaense 2024: confira os confrontos das quartas de final", summary: "Federação Paranaense confirmou datas e horários dos jogos decisivos." },
  { cat: "Cultura", title: "Museu Oscar Niemeyer abre nova exposição sobre arte paranaense", summary: "Mostra reúne 25 artistas que retratam a diversidade cultural do estado." },
];

const MOST_READ_FALLBACK = [
  "Concurso público estadual abre 1.200 vagas de nível superior",
  "Previsão do tempo: frente fria chega ao sul do estado na quarta",
  "Nota Paraná: confira os números sorteados do prêmio mensal",
];

const CATEGORIES = [
  "Últimas Notícias",
  "Política",
  "Economia",
  "Agronegócio",
  "Educação",
  "Segurança",
  "Esportes",
  "Cultura",
];

/* --------------------------- Editorias: cores --------------------------- */
/* Cada editoria tem uma cor-tag (padrão portais regionais tipo Catve). */
const EDITORIA_COLORS: Record<string, string> = {
  "ultimas-noticias": "bg-rose-600",
  "ultimas": "bg-rose-600",
  "destaque": "bg-rose-600",
  "politica": "bg-red-700",
  "economia": "bg-blue-700",
  "agronegocio": "bg-green-700",
  "agro": "bg-green-700",
  "educacao": "bg-indigo-600",
  "seguranca": "bg-slate-900",
  "policia": "bg-slate-900",
  "transito": "bg-red-600",
  "esportes": "bg-emerald-600",
  "cultura": "bg-fuchsia-600",
  "saude": "bg-teal-600",
  "cidades": "bg-amber-600",
  "geral": "bg-yellow-500",
};

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function editoriaColor(name?: string | null, slug?: string | null) {
  const key = (slug || (name ? slugify(name) : "")).trim();
  return EDITORIA_COLORS[key] ?? "bg-secondary";
}

function CategoryTag({
  name,
  slug,
  className = "",
}: {
  name: string;
  slug?: string | null;
  className?: string;
}) {
  const color = editoriaColor(name, slug);
  return (
    <span
      className={`inline-block ${color} text-white text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-sm ${className}`}
    >
      {name}
    </span>
  );
}

/* --------------------------- Portal Home --------------------------- */

function formatDateBR() {
  const d = new Date();
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function PortalHome({ regions, articles }: { regions: Region[]; articles: ArticleListItem[] }) {
  const REGIONS_FALLBACK: Region[] = [
    { id: "fb-metropolitana", slug: "metropolitana", name: "Metropolitana" },
    { id: "fb-litoral", slug: "litoral", name: "Litoral" },
    { id: "fb-campos-gerais", slug: "campos-gerais", name: "Campos Gerais" },
    { id: "fb-norte-pioneiro", slug: "norte-pioneiro", name: "Norte Pioneiro" },
    { id: "fb-norte-central", slug: "norte-central", name: "Norte Central" },
    { id: "fb-noroeste", slug: "noroeste", name: "Noroeste" },
    { id: "fb-centro-ocidental", slug: "centro-ocidental", name: "Centro Ocidental" },
    { id: "fb-oeste", slug: "oeste", name: "Oeste" },
    { id: "fb-sudoeste", slug: "sudoeste", name: "Sudoeste" },
    { id: "fb-centro-sul", slug: "centro-sul", name: "Centro-Sul" },
  ] as unknown as Region[];
  if (!regions || regions.length === 0) regions = REGIONS_FALLBACK;
  const [hero, ...rest] = articles;
  const side = rest.slice(0, 3);
  const secondary = rest.slice(3, 5);

  const articleByRegion = new Map<string, ArticleListItem>();
  for (const a of articles) {
    if (a.region && !articleByRegion.has(a.region.slug)) articleByRegion.set(a.region.slug, a);
  }

  return (
    <div className="w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b-4 border-primary">
        <div className="mx-auto max-w-7xl px-4">
          <div className="py-5 flex flex-col md:flex-row justify-between items-center gap-4">
            <Link to="/" className="flex flex-col">
              <h1 className="font-display text-4xl md:text-5xl leading-none tracking-tight text-primary flex items-baseline gap-2">
                VOZES <span className="text-secondary font-light">PARANAENSES</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
                O portal editorial das 10 regiões do Paraná
              </p>
            </Link>
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-bold text-primary">Curitiba, 22°C</p>
                <p className="text-[10px] text-slate-500 uppercase capitalize">{formatDateBR()}</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <button className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold rounded uppercase hover:opacity-90 transition">
                Assine Já
              </button>
            </div>
          </div>
          <nav className="flex overflow-x-auto no-scrollbar py-3 border-t border-slate-100 gap-6 text-xs font-bold uppercase text-slate-600 whitespace-nowrap">
            {CATEGORIES.map((c, i) => (
              <a key={c} href="#" className={i === 0 ? "text-secondary" : "hover:text-secondary transition-colors"}>
                {c}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Publicidade — Super Banner topo */}
        <div className="mb-8 rounded bg-slate-100 border border-slate-200 h-24 md:h-28 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Publicidade — 970x90
          </span>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 lg:col-span-8">
            <HeroCard article={hero} />
          </div>
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {[0, 1, 2].map((i) => {
              const a = side[i];
              const fb = SIDE_FALLBACK[i];
              const to = a?.region
                ? { to: "/$region/$slug" as const, params: { region: a.region.slug, slug: a.slug } }
                : null;
              const inner = (
                <>
                  <span className={`text-xs font-black uppercase tracking-widest ${i === 0 ? "text-secondary" : "text-slate-500"}`}>
                    {a?.region?.name ?? fb.cat}
                  </span>
                  <h3 className="font-display text-2xl md:text-[1.6rem] leading-tight mt-2 hover:text-secondary transition-colors">
                    {a?.title ?? fb.title}
                  </h3>
                </>
              );
              const borderCls = i === 0 ? "border-secondary" : "border-slate-300";
              return to ? (
                <Link key={i} {...to} className={`block border-l-4 pl-4 py-1 ${borderCls}`}>{inner}</Link>
              ) : (
                <div key={i} className={`border-l-4 pl-4 py-1 ${borderCls} cursor-pointer`}>{inner}</div>
              );
            })}
            <div className="mt-auto rounded bg-slate-100 border border-slate-200 h-64 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Publicidade — 300x250</span>
            </div>
          </div>
        </div>

        {/* Publicidade — Retângulo entre blocos */}
        <div className="mb-12 rounded bg-slate-100 border border-slate-200 h-24 md:h-28 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Publicidade — 728x90
          </span>
        </div>

        {/* Notícias das Regiões */}
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="font-display text-3xl md:text-4xl text-primary uppercase tracking-tight shrink-0">
              Notícias das Regiões
            </h2>
            <div className="h-1 w-full bg-slate-200 rounded-full">
              <div className="h-1 w-24 bg-secondary rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            {regions.map((r) => {
              const a = articleByRegion.get(r.slug);
              const title = a?.title ?? REGION_FALLBACK[r.slug] ?? `Últimas notícias de ${r.name}`;
              return (
                <Link
                  key={r.id}
                  to={a ? "/$region/$slug" : "/$region"}
                  params={a ? { region: r.slug, slug: a.slug } : { region: r.slug }}
                  className="bg-white p-6 hover:bg-accent transition-colors group block"
                >
                  <p className="text-xs md:text-sm font-bold text-secondary mb-2 uppercase tracking-wider">
                    {r.name}
                  </p>
                  <h4 className="font-display text-2xl md:text-xl xl:text-2xl leading-tight group-hover:underline text-slate-900">
                    {title}
                  </h4>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Publicidade — Half-page antes de secundárias */}
        <div className="mb-12 rounded bg-slate-100 border border-slate-200 h-24 md:h-28 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Publicidade — 970x90
          </span>
        </div>

        {/* Secondary + Mais lidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {[0, 1].map((i) => {
              const a = secondary[i];
              const fb = SECONDARY_FALLBACK[i];
              const Wrap: React.ElementType = a?.region ? Link : "div";
              const wrapProps = a?.region
                ? { to: "/$region/$slug", params: { region: a.region.slug, slug: a.slug } }
                : {};
              return (
                <Wrap key={i} {...wrapProps} className="flex flex-col gap-3 group cursor-pointer">
                  <div className="w-full aspect-video bg-slate-200 rounded-lg overflow-hidden">
                    {a?.cover_image_url ? (
                      <img src={a.cover_image_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                    )}
                  </div>
                  <span className="text-secondary text-xs font-bold uppercase tracking-wider">
                    {a?.region?.name ?? fb.cat}
                  </span>
                  <h4 className="font-display text-2xl md:text-3xl leading-tight group-hover:text-secondary">
                    {a?.title ?? fb.title}
                  </h4>
                  <p className="text-base text-slate-600 line-clamp-2">
                    {a?.summary ?? fb.summary}
                  </p>
                </Wrap>
              );
            })}
          </div>

          <aside className="space-y-6">
            <div className="bg-white p-5 rounded-lg border border-slate-200">
              <h5 className="text-sm font-black uppercase text-primary border-b border-slate-100 pb-2 mb-4 tracking-wider">
                Mais Lidas
              </h5>
              <div className="space-y-4">
                {MOST_READ_FALLBACK.map((t, i) => (
                  <div key={i} className="flex gap-3 group cursor-pointer">
                    <span className="font-display text-4xl leading-none text-slate-200">{i + 1}</span>
                    <p className="text-base font-bold leading-snug group-hover:text-secondary transition-colors">
                      {t}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded bg-slate-100 border border-slate-200 h-64 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Publicidade — 300x250</span>
            </div>
            <div className="rounded bg-slate-100 border border-slate-200 h-[600px] flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Publicidade — 300x600</span>
            </div>
          </aside>
        </div>

        {/* Publicidade — Rodapé */}
        <div className="mt-12 rounded bg-slate-100 border border-slate-200 h-24 md:h-28 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Publicidade — 970x90
          </span>
        </div>
      </main>

      <footer className="bg-primary text-primary-foreground py-12 mt-8">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h2 className="font-display text-3xl tracking-tight mb-3">VOZES PARANAENSES</h2>
            <p className="text-white/70 text-xs leading-relaxed max-w-md">
              Cobertura editorial das 10 macrorregiões do Paraná — cada região com sua identidade, todas em um só domínio.
            </p>
          </div>
          <div className="md:col-span-2 flex md:justify-end items-end">
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Vozes Paranaenses
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroCard({ article }: { article: ArticleListItem | undefined }) {
  const title = article?.title ?? HERO_FALLBACK.title;
  const summary = article?.summary ?? HERO_FALLBACK.summary;
  const cat = article?.region?.name ?? HERO_FALLBACK.category;
  const to = article?.region
    ? { to: "/$region/$slug" as const, params: { region: article.region.slug, slug: article.slug } }
    : null;

  const Inner = (
    <div className="group relative overflow-hidden rounded-lg h-full">
      <div className="w-full aspect-[16/9] bg-slate-200">
        {article?.cover_image_url ? (
          <img src={article.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/80 via-primary to-secondary/60" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
      <div className="absolute bottom-0 left-0 p-6 md:p-8">
        <span className="bg-secondary text-white text-[10px] font-bold px-2 py-1 uppercase mb-3 inline-block tracking-wider">
          {cat}
        </span>
        <h2 className="font-display text-3xl md:text-5xl text-white leading-tight group-hover:underline">
          {title}
        </h2>
        <p className="mt-3 text-slate-200 text-sm md:text-base max-w-2xl line-clamp-2">
          {summary}
        </p>
      </div>
    </div>
  );

  return to ? <Link {...to} className="block h-full">{Inner}</Link> : Inner;
}
