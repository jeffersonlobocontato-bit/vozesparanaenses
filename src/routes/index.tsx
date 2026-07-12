import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listRegions,
  listRankedArticles,
  getViewerLocation,
  listArticlesByCategoryGlobal,
  listArticlesWithoutImage,
  listMostReadArticles,
  type ArticleListItem,
  type RankedArticle,
  type Region,
  type ViewerLocation,
} from "@/lib/content.functions";
import { LocationBar, ProximityBadge } from "@/components/LocationBar";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdSlot } from "@/components/AdSlot";
import { AdsenseSlot } from "@/components/AdsenseSlot";
import { WhatsAppCTA } from "@/components/WhatsAppCTA";
import { arrangePinnedSlots } from "@/lib/pinned-layout";

const regionsQO = queryOptions({
  queryKey: ["regions"],
  queryFn: () => listRegions(),
});
const viewerLocQO = queryOptions({
  queryKey: ["viewer-location"],
  queryFn: () => getViewerLocation(),
});
const rankedQO = (loc: ViewerLocation) =>
  queryOptions({
    queryKey: ["articles", "ranked", loc.cidade ?? "", loc.regiaoSlug ?? "", 12],
    queryFn: () =>
      listRankedArticles({
        data: { cidade: loc.cidade, regiaoSlug: loc.regiaoSlug, limit: 12 },
      }),
  });

// Módulos por editoria — sequência exibida no scroll da home,
// no espírito dos grandes portais (G1, UOL, Folha).
const HOME_EDITORIAS: Array<{ slug: string; name: string }> = [
  { slug: "seguranca", name: "Segurança" },
  { slug: "politica", name: "Política" },
  { slug: "esportes", name: "Esportes" },
  { slug: "cidades", name: "Cidades" },
];

const editoriaQO = (slug: string) =>
  queryOptions({
    queryKey: ["articles", "cat-global", slug, 7],
    queryFn: () =>
      listArticlesByCategoryGlobal({ data: { categorySlug: slug, limit: 7 } }),
  });

const vaptVuptQO = queryOptions({
  queryKey: ["articles", "vapt-vupt", 8],
  queryFn: () => listArticlesWithoutImage({ data: { limit: 8 } }),
});

const mostReadQO = queryOptions({
  queryKey: ["articles", "most-read", 7, 5],
  queryFn: () => listMostReadArticles({ data: { days: 7, limit: 5 } }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vozes Paranaenses — Notícias de todas as regiões do Estado" },
      {
        name: "description",
        content:
          "Portal de Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul.",
      },
      { property: "og:title", content: "Vozes Paranaenses — Notícias de todas as regiões do Estado" },
      {
        property: "og:description",
        content: "Portal de Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: async ({ context }) => {
    const [loc] = await Promise.all([
      context.queryClient.ensureQueryData(viewerLocQO),
      context.queryClient.ensureQueryData(regionsQO),
    ]);
    await context.queryClient.ensureQueryData(rankedQO(loc));
    await Promise.all(
      HOME_EDITORIAS.map((e) =>
        context.queryClient.ensureQueryData(editoriaQO(e.slug)),
      ),
    );
    await context.queryClient.ensureQueryData(vaptVuptQO);
    await context.queryClient.ensureQueryData(mostReadQO);
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
  const { data: loc } = useSuspenseQuery(viewerLocQO);
  const { data: articles } = useSuspenseQuery(rankedQO(loc));
  const { data: vaptVupt } = useSuspenseQuery(vaptVuptQO);
  const { data: mostRead } = useSuspenseQuery(mostReadQO);
  return (
    <PortalHome
      regions={regions}
      articles={articles}
      vaptVupt={vaptVupt}
      mostRead={mostRead}
    />
  );
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
  { cat: "Cidades", title: "Municípios do Paraná ampliam serviços digitais para moradores" },
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

/* --------------------------- Editorias: paleta monocromática azul --------------------------- */
/* Escala de 6 tons — do azul-marinho ao azul-céu. Cada editoria ancora num tom;
   no hover, desloca para o tom vizinho (mais claro ou mais escuro), criando
   interação sutil sem quebrar a identidade cromática do portal. */
type BlueTag = { base: string; hover: string; text: string };

const BLUE_SCALE: Record<string, BlueTag> = {
  // 900 — azul-marinho profundo
  "seguranca":  { base: "bg-[#002147]", hover: "hover:bg-[#0D3D6C]", text: "text-white" },
  "policia":    { base: "bg-[#002147]", hover: "hover:bg-[#0D3D6C]", text: "text-white" },
  "politica":   { base: "bg-[#002147]", hover: "hover:bg-[#2E6DA4]", text: "text-white" },
  // 800 — azul-noite
  "economia":   { base: "bg-[#0D3D6C]", hover: "hover:bg-[#2E6DA4]", text: "text-white" },
  "transito":   { base: "bg-[#0D3D6C]", hover: "hover:bg-[#002147]", text: "text-white" },
  // 600 — azul-clássico (institucional Vozes)
  "ultimas-noticias": { base: "bg-[#2E6DA4]", hover: "hover:bg-[#0D3D6C]", text: "text-white" },
  "ultimas":    { base: "bg-[#2E6DA4]", hover: "hover:bg-[#0D3D6C]", text: "text-white" },
  "destaque":   { base: "bg-[#2E6DA4]", hover: "hover:bg-[#0D3D6C]", text: "text-white" },
  "cidades":    { base: "bg-[#2E6DA4]", hover: "hover:bg-[#4A85B0]", text: "text-white" },
  "geral":      { base: "bg-[#2E6DA4]", hover: "hover:bg-[#4A85B0]", text: "text-white" },
  // 500 — azul-aço
  "agronegocio":{ base: "bg-[#4A85B0]", hover: "hover:bg-[#2E6DA4]", text: "text-white" },
  "agro":       { base: "bg-[#4A85B0]", hover: "hover:bg-[#2E6DA4]", text: "text-white" },
  "educacao":   { base: "bg-[#4A85B0]", hover: "hover:bg-[#7BB3D9]", text: "text-white" },
  // 400 — azul-céu
  "saude":      { base: "bg-[#7BB3D9]", hover: "hover:bg-[#4A85B0]", text: "text-[#002147]" },
  "esportes":   { base: "bg-[#7BB3D9]", hover: "hover:bg-[#4A85B0]", text: "text-[#002147]" },
  "cultura":    { base: "bg-[#7BB3D9]", hover: "hover:bg-[#A9D0E5]", text: "text-[#002147]" },
};

const BLUE_DEFAULT: BlueTag = {
  base: "bg-[#2E6DA4]",
  hover: "hover:bg-[#0D3D6C]",
  text: "text-white",
};

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function editoriaTag(name?: string | null, slug?: string | null): BlueTag {
  const key = (slug || (name ? slugify(name) : "")).trim();
  return BLUE_SCALE[key] ?? BLUE_DEFAULT;
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
  const tag = editoriaTag(name, slug);
  return (
    <span
      className={`inline-block cursor-pointer ${tag.base} ${tag.hover} ${tag.text} text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-sm transition-colors duration-200 ${className}`}
    >
      {name}
    </span>
  );
}

/* --------------------------- Portal Home --------------------------- */

function useTodayBR() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "America/Sao_Paulo",
      }),
    );
  }, []);
  return label;
}

function PortalHome({
  regions,
  articles,
  vaptVupt,
  mostRead,
}: {
  regions: Region[];
  articles: RankedArticle[];
  vaptVupt: ArticleListItem[];
  mostRead: ArticleListItem[];
}) {
  const REGIONS_FALLBACK: Region[] = [
    { id: "fb-metropolitana", slug: "metropolitana", name: "Metropolitana" },
    { id: "fb-litoral", slug: "litoral", name: "Litoral" },
    { id: "fb-campos-gerais", slug: "campos-gerais", name: "Campos Gerais" },
    { id: "fb-norte-pioneiro", slug: "norte-pioneiro", name: "Norte Pioneiro" },
    { id: "fb-norte-central", slug: "norte-central", name: "Norte" },
    { id: "fb-noroeste", slug: "noroeste", name: "Noroeste" },
    { id: "fb-centro-ocidental", slug: "centro-ocidental", name: "Centro Oeste" },
    { id: "fb-oeste", slug: "oeste", name: "Oeste" },
    { id: "fb-sudoeste", slug: "sudoeste", name: "Sudoeste" },
    { id: "fb-centro-sul", slug: "centro-sul", name: "Centro-Sul" },
  ] as unknown as Region[];
  if (!regions || regions.length === 0) regions = REGIONS_FALLBACK;
  // Primeira dobra (hero + laterais + secundárias) só aceita matérias com foto.
  // Sem imagem, a matéria vai para o módulo VAPT-VUPT ao lado das Mais Lidas.
  const articlesComFoto = articles.filter((a) => !!a.cover_image_url);
  // Home estadual — só pins de escopo 'estado' aparecem como fixados;
  // pins de região/cidade caem no rest e viram matéria comum.
  const { hero, side, rest } = arrangePinnedSlots(articlesComFoto, 4, {});
  const secondary = rest.slice(0, 2);

  const articleByRegion = new Map<string, ArticleListItem>();
  for (const a of articles) {
    if (a.region && !articleByRegion.has(a.region.slug)) articleByRegion.set(a.region.slug, a);
  }

  const todayBR = useTodayBR();

  return (
    <div className="w-full bg-white text-slate-900">
      <SiteHeader />

      {/* Faixa data/editorias — sub-nav densa estilo CGN */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-2 whitespace-nowrap">
          <span
            suppressHydrationWarning
            className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 capitalize"
          >
            {todayBR ?? "\u00A0"}
          </span>
          <span className="h-3 w-px shrink-0 bg-slate-300" />
          {CATEGORIES.map((c) => (
            <a
              key={c}
              href="#"
              className="shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-600 transition-colors hover:text-[#0A2540]"
            >
              {c}
            </a>
          ))}
        </div>
      </div>

      <LocationBar />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* CTA — Comunidade WhatsApp (topo) */}
        <div className="mb-6 flex justify-start">
          <WhatsAppCTA variant="button" />
        </div>

        {/* Publicidade — Super Banner topo */}
        <AdSlot size="970x90" className="mb-6" />

        {/* Hero */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-12 lg:col-span-8">
            <HeroCard article={hero} />
          </div>
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {[0, 1, 2, 3].map((i) => {
              const a = side[i];
              const fb = SIDE_FALLBACK[i];
              const to = a?.region
                ? { to: "/$region/$slug" as const, params: { region: a.region.slug, slug: a.slug } }
                : null;
              const catName = a?.categoria?.name ?? a?.region?.name ?? fb.cat;
              const catSlug = a?.categoria?.slug ?? null;
              const inner = (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryTag name={catName} slug={catSlug} />
                    {a && <ProximityBadge proximidade={a.proximidade} />}
                  </div>
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
            <AdSlot size="300x250" className="mt-auto" />
          </div>
        </div>

        {/* AdSense — Grupo 1 (entre hero e regiões) */}
        <div className="mb-8 empty:hidden">
          <AdsenseSlot slot="9449330789" />
        </div>

        {/* Notícias das Regiões */}
        <section className="mb-10">
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

        {/* AdSense — Grupo 2 (antes das secundárias) */}
        <div className="mb-8 empty:hidden">
          <AdsenseSlot slot="5202964012" />
        </div>

        {/* Secondary + Mais lidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          <div className="md:col-span-3 space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
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
                  <CategoryTag
                    name={a?.categoria?.name ?? a?.region?.name ?? fb.cat}
                    slug={a?.categoria?.slug ?? null}
                    className="self-start"
                  />
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

            {HOME_EDITORIAS.map((e, i) => (
              <div key={e.slug} className="space-y-6">
                <EditoriaModule slug={e.slug} name={e.name} />
                {i === 1 && (
                  <div className="empty:hidden">
                    <AdsenseSlot
                      slot="1638590691"
                      format="fluid"
                      layoutKey="-6t+ed+2i-1n-4w"
                      fullWidthResponsive={false}
                      className="min-h-[250px]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <aside className="space-y-6">
            <div className="bg-white p-5 rounded-lg border border-slate-200">
              <h5 className="text-sm font-black uppercase text-primary border-b border-slate-100 pb-2 mb-4 tracking-wider">
                Mais Lidas
              </h5>
              <div className="space-y-4">
                {(mostRead.length > 0
                  ? mostRead.map((a, i) => ({
                      key: a.id,
                      title: a.title,
                      to: a.region
                        ? { to: "/$region/$slug" as const, params: { region: a.region.slug, slug: a.slug } }
                        : null,
                      i,
                    }))
                  : MOST_READ_FALLBACK.map((t, i) => ({ key: `fb-${i}`, title: t, to: null, i }))
                ).map(({ key, title, to, i }) =>
                  to ? (
                    <Link key={key} {...to} className="flex gap-3 group cursor-pointer">
                      <span className="font-display text-4xl leading-none text-slate-200">{i + 1}</span>
                      <p className="text-base font-bold leading-snug group-hover:text-secondary transition-colors">
                        {title}
                      </p>
                    </Link>
                  ) : (
                    <div key={key} className="flex gap-3 group cursor-pointer">
                      <span className="font-display text-4xl leading-none text-slate-200">{i + 1}</span>
                      <p className="text-base font-bold leading-snug group-hover:text-secondary transition-colors">
                        {title}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
            <VaptVuptModule articles={vaptVupt} />
            <AdSlot size="300x250" />
            <AdSlot size="300x600" />
          </aside>
        </div>

        {/* AdSense — Grupo 3 (rodapé) */}
        <div className="mt-10 empty:hidden">
          <AdsenseSlot slot="2880053002" />
        </div>

        {/* Módulos por editoria — sequência estilo grandes portais */}
        <div className="mt-12 space-y-12">
          {HOME_EDITORIAS.slice(1).map((e, i) => (
            <div key={e.slug} className="space-y-12">
              <EditoriaModule slug={e.slug} name={e.name} />
              {/* AdSense Multiplex entre blocos de editoria */}
              {i === 0 && (
                <div className="empty:hidden">
                  <AdsenseSlot
                    slot="1638590691"
                    format="fluid"
                    layoutKey="-6t+ed+2i-1n-4w"
                    fullWidthResponsive={false}
                    className="min-h-[250px]"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA — Comunidade WhatsApp (rodapé da home) */}
        <div className="mt-10 flex justify-start">
          <WhatsAppCTA variant="button" />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function EditoriaModule({ slug, name }: { slug: string; name: string }) {
  const { data: articles } = useSuspenseQuery(editoriaQO(slug));
  if (!articles || articles.length === 0) return null;
  const [lead, ...rest] = articles;
  const secondary = rest.slice(0, 4);
  const list = rest.slice(4, 7);

  const leadLink = lead.region
    ? { to: "/$region/$slug" as const, params: { region: lead.region.slug, slug: lead.slug } }
    : null;

  return (
    <section aria-labelledby={`editoria-${slug}`}>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/editoria/$categoria"
          params={{ categoria: slug }}
          id={`editoria-${slug}`}
          className="font-display text-3xl md:text-4xl text-primary uppercase tracking-tight shrink-0 hover:text-secondary transition-colors"
        >
          {name}
        </Link>
        <div className="h-1 w-full bg-slate-200 rounded-full">
          <div className="h-1 w-24 bg-secondary rounded-full" />
        </div>
        <Link
          to="/editoria/$categoria"
          params={{ categoria: slug }}
          className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary hover:underline"
        >
          Ver tudo
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead */}
        {leadLink ? (
          <Link {...leadLink} className="group block lg:col-span-2">
            <div className="w-full aspect-[16/9] bg-slate-200 overflow-hidden rounded-lg">
              {lead.cover_image_url ? (
                <img
                  src={lead.cover_image_url}
                  alt=""
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
              )}
            </div>
            <div className="pt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CategoryTag name={name} slug={slug} />
                {lead.region && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {lead.region.name}
                  </span>
                )}
              </div>
              <h3 className="font-display text-2xl md:text-4xl leading-tight mt-2 group-hover:text-secondary">
                {lead.title}
              </h3>
              {lead.summary && (
                <p className="mt-2 text-slate-600 line-clamp-2 text-base">{lead.summary}</p>
              )}
            </div>
          </Link>
        ) : null}

        {/* Secondary grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          {secondary.slice(0, 2).map((a) =>
            a.region ? (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: a.region.slug, slug: a.slug }}
                className="group flex gap-3"
              >
                <div className="w-28 shrink-0 aspect-square bg-slate-200 overflow-hidden rounded">
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                    {a.region.name}
                  </span>
                  <h4 className="font-display text-base md:text-lg leading-snug group-hover:text-secondary mt-1">
                    {a.title}
                  </h4>
                </div>
              </Link>
            ) : null,
          )}
        </div>
      </div>

      {(secondary.slice(2).length > 0 || list.length > 0) && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-slate-200 pt-6">
          {[...secondary.slice(2), ...list].map((a) =>
            a.region ? (
              <Link
                key={a.id}
                to="/$region/$slug"
                params={{ region: a.region.slug, slug: a.slug }}
                className="group block"
              >
                <div className="w-full aspect-[16/10] bg-slate-200 overflow-hidden rounded">
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt="" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                  )}
                </div>
                <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-secondary">
                  {a.region.name}
                </span>
                <h4 className="font-display text-lg leading-snug group-hover:text-secondary mt-1">
                  {a.title}
                </h4>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function HeroCard({ article }: { article: RankedArticle | undefined }) {
  return _HeroCardImpl({ article });
}

function VaptVuptModule({ articles }: { articles: ArticleListItem[] }) {
  if (!articles || articles.length === 0) return null;
  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200">
      <div className="flex items-baseline justify-between border-b border-slate-100 pb-2 mb-4">
        <h5 className="text-sm font-black uppercase text-primary tracking-wider">
          VAPT-VUPT
        </h5>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Rápidas
        </span>
      </div>
      <div className="space-y-3">
        {articles.map((a) => {
          const catName = a.categoria?.name ?? a.region?.name ?? "Geral";
          const catSlug = a.categoria?.slug ?? null;
          const inner = (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <CategoryTag name={catName} slug={catSlug} className="text-[10px] px-1.5 py-0.5" />
                {a.region && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {a.region.name}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold leading-snug mt-1 group-hover:text-secondary transition-colors">
                {a.title}
              </p>
            </>
          );
          return a.region ? (
            <Link
              key={a.id}
              to="/$region/$slug"
              params={{ region: a.region.slug, slug: a.slug }}
              className="group block border-l-2 border-slate-200 pl-3 hover:border-secondary"
            >
              {inner}
            </Link>
          ) : (
            <div key={a.id} className="group block border-l-2 border-slate-200 pl-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function _HeroCardImpl({ article }: { article: RankedArticle | undefined }) {
  const title = article?.title ?? HERO_FALLBACK.title;
  const summary = article?.summary ?? HERO_FALLBACK.summary;
  const catName = article?.categoria?.name ?? article?.region?.name ?? HERO_FALLBACK.category;
  const catSlug = article?.categoria?.slug ?? null;
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
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <CategoryTag name={catName} slug={catSlug} className="text-xs px-3 py-1.5" />
          {article && <ProximityBadge proximidade={article.proximidade} />}
        </div>
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
