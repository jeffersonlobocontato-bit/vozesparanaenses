import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listRegions,
  listRankedArticles,
  getPrimeiraDobra,
  type ItemDobra,
  getViewerLocation,
  listArticlesByCategoryGlobal,
  listArticlesWithoutImage,
  listMostReadArticles,
  listUltimaPorRegiao,
  cidadeSlug,
  type ArticleListItem,
  type RankedArticle,
  type Region,
  type ViewerLocation,
} from "@/lib/content.functions";
import { LocationBar, ProximityBadge } from "@/components/LocationBar";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdSlot } from "@/components/AdSlot";
import { AdsenseSlot } from "@/components/AdsenseSlot";
import { ColumnsShortcut } from "@/components/ColumnsShortcut";
import { StoriesBar, type StoryTopic } from "@/components/StoriesBar";
import { listColunasAtalhos, type ColunaAtalho } from "@/lib/content.functions";
import { WhatsAppCTA } from "@/components/WhatsAppCTA";
import { WeatherWidget } from "@/components/WeatherWidget";
import { arrangePinnedSlots } from "@/lib/pinned-layout";
import { Chapeu } from "@/components/Chapeu";
import { corDaRegiao } from "@/lib/cores-regioes";

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
    staleTime: 5 * 60 * 1000,
  });

// Módulos por editoria — sequência exibida no scroll da home,
// no espírito dos grandes portais (G1, UOL, Folha).
const HOME_EDITORIAS: Array<{ slug: string; name: string }> = [
  { slug: "seguranca", name: "Segurança" },
  { slug: "politica", name: "Política" },
  { slug: "esportes", name: "Esportes" },
  { slug: "cidades", name: "Cidades" },
  { slug: "internacional", name: "Internacional" },
];

const editoriaQO = (slug: string) =>
  queryOptions({
    queryKey: ["articles", "cat-global", slug, 7],
    queryFn: () =>
      listArticlesByCategoryGlobal({ data: { categorySlug: slug, limit: 7 } }),
    staleTime: 5 * 60 * 1000,
  });

// Editorias que viram "stories" no topo do mobile (subset de HOME_EDITORIAS).
const STORIES_EDITORIAS: Array<{ slug: string; name: string }> = [
  { slug: "politica", name: "Política" },
  { slug: "seguranca", name: "Segurança" },
  { slug: "esportes", name: "Esportes" },
  { slug: "cidades", name: "Cidades" },
];

// Primeira dobra por proximidade do leitor (cidade › Paraná › Brasil › mundo).
const dobraQO = (loc: ViewerLocation) =>
  queryOptions({
    queryKey: ["articles", "dobra", loc.cidade ?? "", loc.regiaoSlug ?? ""],
    queryFn: () => getPrimeiraDobra({ data: { cidade: loc.cidade, regiaoSlug: loc.regiaoSlug } }),
    staleTime: 5 * 60 * 1000,
  });

const vaptVuptQO = queryOptions({
  queryKey: ["articles", "vapt-vupt", 8],
  queryFn: () => listArticlesWithoutImage({ data: { limit: 8 } }),
  staleTime: 5 * 60 * 1000,
});

const mostReadQO = queryOptions({
  queryKey: ["articles", "most-read", 7, 5],
  queryFn: () => listMostReadArticles({ data: { days: 7, limit: 5 } }),
  staleTime: 5 * 60 * 1000,
});

const ultimaPorRegiaoQO = queryOptions({
  queryKey: ["articles", "ultima-por-regiao"],
  queryFn: () => listUltimaPorRegiao(),
  staleTime: 5 * 60 * 1000,
});

const colunasAtalhosQO = queryOptions({
  queryKey: ["colunas", "atalhos"],
  queryFn: () => listColunasAtalhos(),
  staleTime: 5 * 60 * 1000,
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
    // Tudo em paralelo (antes eram 8 esperas em fila: ~5–10 s para montar a
    // home). Só a manchete e o ranking dependem da cidade do leitor, que sai
    // do cookie/IP sem ir ao banco.
    const qc = context.queryClient;
    const locP = qc.ensureQueryData(viewerLocQO);
    await Promise.all([
      qc.ensureQueryData(regionsQO),
      locP.then((loc) => Promise.all([qc.ensureQueryData(rankedQO(loc)), qc.ensureQueryData(dobraQO(loc))])),
      ...HOME_EDITORIAS.map((e) => qc.ensureQueryData(editoriaQO(e.slug))),
      qc.ensureQueryData(vaptVuptQO),
      qc.ensureQueryData(mostReadQO),
      qc.ensureQueryData(colunasAtalhosQO),
      qc.ensureQueryData(ultimaPorRegiaoQO),
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
  const { data: loc } = useSuspenseQuery(viewerLocQO);
  const { data: articles } = useSuspenseQuery(rankedQO(loc));
  const { data: vaptVupt } = useSuspenseQuery(vaptVuptQO);
  const { data: dobra } = useSuspenseQuery(dobraQO(loc));
  const { data: mostRead } = useSuspenseQuery(mostReadQO);
  const { data: colunas } = useSuspenseQuery(colunasAtalhosQO);
  const { data: ultimaPorRegiao } = useSuspenseQuery(ultimaPorRegiaoQO);
  // Stories do mobile: reaproveita as consultas de editoria já carregadas.
  const storyTopicos: StoryTopic[] = STORIES_EDITORIAS.map((e) => ({
    label: e.name,
    categorySlug: e.slug,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    artigos: useSuspenseQuery(editoriaQO(e.slug)).data,
  }));
  return (
    <PortalHome
      regions={regions}
      articles={articles}
      vaptVupt={vaptVupt}
      dobra={dobra}
      mostRead={mostRead}
      loc={loc}
      colunas={colunas}
      storyTopicos={storyTopicos}
      ultimaPorRegiao={ultimaPorRegiao}
    />
  );
}

/* Sem manchete de enchimento: espaço sem matéria real fica de fora ou vira
   atalho para a região — portal de notícias nunca mostra título inventado. */


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
  "internacional": { base: "bg-[#0D3D6C]", hover: "hover:bg-[#2E6DA4]", text: "text-white" },
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

/**
 * Etiqueta da cidade da matéria. Pela regra do título (supabase/functions/
 * _shared/titulo.ts), matéria com cidade identificada não repete a cidade
 * no título — a cidade aparece aqui.
 */
function CityTag({ cidade, className = "" }: { cidade?: string | null; className?: string }) {
  if (!cidade) return null;
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wider ${className || "text-slate-500"}`}>
      {cidade}
    </span>
  );
}

/* --------------------------- Portal Home --------------------------- */

function PortalHome({
  regions,
  articles,
  vaptVupt,
  dobra,
  mostRead,
  loc,
  colunas,
  storyTopicos,
  ultimaPorRegiao = {},
}: {
  regions: Region[];
  articles: RankedArticle[];
  vaptVupt: ArticleListItem[];
  dobra?: { hero: ItemDobra | null; side: ItemDobra[] };
  mostRead: ArticleListItem[];
  loc?: { cidade: string | null; regiaoSlug: string | null };
  colunas?: ColunaAtalho[];
  storyTopicos?: StoryTopic[];
  ultimaPorRegiao?: Record<string, ArticleListItem>;
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
  const { hero: heroPr, side: sidePr, rest } = arrangePinnedSlots(articlesComFoto, 4, {});

  // Primeira dobra por proximidade (getPrimeiraDobra). Sem dados, cai no
  // ranking estadual de antes.
  const hero: RankedArticle | ItemDobra | undefined = dobra?.hero ?? heroPr;
  const side: Array<RankedArticle | ItemDobra> = dobra?.side.length ? dobra.side : sidePr;
  const naDobra = new Set([hero?.id, ...side.map((a) => a.id)].filter(Boolean) as string[]);
  const secondary = rest.concat(sidePr).filter((a) => !naDobra.has(a.id)).slice(0, 2);
  // Completa a coluna da direita até a altura da manchete (foto + título longo):
  // 3 notas compactas com miniatura, das próximas matérias com foto.
  const usados = new Set([...naDobra, ...secondary.map((a) => a.id)]);
  // Com anúncio na coluna, as notas encolhem na medida do espaço que ele ocupa
  // (coluna ≈ 470px de largura no desktop; cada nota ≈ 100px de altura).
  const [anuncioLateral, setAnuncioLateral] = useState<{ w: number; h: number } | null>(null);
  const notasDireita = anuncioLateral
    ? Math.max(0, 3 - Math.ceil(((470 * anuncioLateral.h) / anuncioLateral.w) / 100))
    : 3;
  const extrasDireita = rest.concat(sidePr).filter((a) => !usados.has(a.id)).slice(0, notasDireita);
  const cidadeLeitor = loc?.cidade ?? null;

  const articleByRegion = new Map<string, ArticleListItem>();
  for (const a of articles) {
    if (a.region && !articleByRegion.has(a.region.slug)) articleByRegion.set(a.region.slug, a);
  }


  return (
    <div className="w-full bg-white text-slate-900">
      <SiteHeader />

      <StoriesBar topicos={storyTopicos ?? []} colunas={colunas ?? []} />

      <LocationBar />

      <main>
        {/* Faixa 1 — primeira dobra, fundo base */}
        <div className="mx-auto max-w-7xl px-4 py-6">
        {/* CTA WhatsApp no topo */}
        <div className="mb-6 flex justify-start">
          <WhatsAppCTA variant="button" />
        </div>

        {/* Publicidade — Super Banner topo (oculto a pedido) */}
        {/* <AdSlot slot="home_topo" className="mb-6" /> */}

        {/* Primeira dobra — manchete : coluna da direita = φ : 1 */}
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <HeroCard article={hero} cidadeLeitor={cidadeLeitor} />
          </div>
          <div className="flex min-w-0 flex-col">
            <ul className="flex flex-col">
              {[0, 1, 2, 3].map((i) => {
                const a = side[i];
                if (!a) return null;
                const nota = a && "nota" in a ? a.nota : undefined;
                const inner = (
                  <>
                    <Chapeu artigo={a} cidadeLeitor={cidadeLeitor} />
                    <h3 className="mt-1.5 text-[1.375rem] leading-[1.22] font-semibold text-ink group-hover:underline decoration-2 underline-offset-4">
                      {a.title}
                    </h3>
                    {nota && <span className="mt-1 block text-[0.8125rem] font-medium text-ink-subtle">Nota da coluna Vozes {a?.cidade_principal}</span>}
                  </>
                );
                const cls = `group block py-3 ${i === 0 ? "border-t-2 border-ink" : "border-t border-rule"}`;
                return (
                  <li key={a?.id ?? i}>
                    {nota ? (
                      <Link to="/vozes/$cidade" params={{ cidade: nota.cidadeSlug }} className={cls}>{inner}</Link>
                    ) : a?.region ? (
                      <Link to="/$region/$slug" params={{ region: a.region.slug, slug: a.slug }} className={cls}>{inner}</Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {extrasDireita.length > 0 && (
              <ul className="flex flex-col border-t border-rule">
                {extrasDireita.map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/$region/$slug"
                      params={{ region: a.region?.slug ?? "parana", slug: a.slug }}
                      className="group flex gap-3 border-b border-rule py-3 last:border-b-0"
                    >
                      {a.cover_image_url && (
                        <img src={a.cover_image_url} alt="" loading="lazy" className="h-[4.5rem] w-28 shrink-0 object-cover" />
                      )}
                      <span className="min-w-0">
                        <Chapeu artigo={a} cidadeLeitor={cidadeLeitor} />
                        <span className="mt-1 block font-display text-[1.0625rem] leading-[1.25] font-semibold text-ink line-clamp-3 group-hover:underline decoration-2 underline-offset-4">
                          {a.title}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <AdSlot slot="home_sidebar_hero" className="mt-auto pt-4" onPreenchido={setAnuncioLateral} />
          </div>
        </div>

        {/* AdSense — Grupo 1 (entre hero e regiões) */}
        <div className="mb-8 empty:hidden">
          <AdsenseSlot slot="9449330789" />
        </div>

        </div>

        {/* Faixa 2 — Notícias das Regiões, fundo frio */}
        <div className="border-y border-rule bg-surface-raised">
        <section className="mx-auto max-w-7xl px-4 py-10">
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
              const a = ultimaPorRegiao[r.slug] ?? articleByRegion.get(r.slug);
              return (
                <Link
                  key={r.id}
                  to={a ? "/$region/$slug" : "/$region"}
                  params={a ? { region: r.slug, slug: a.slug } : { region: r.slug }}
                  className="bg-white p-6 hover:bg-accent transition-colors group block"
                >
                  <p className="text-xs md:text-sm font-bold mb-2 uppercase tracking-wider" style={{ color: corDaRegiao(r.slug) }}>
                    {r.name}
                  </p>
                  {a ? (
                    <h4 className="font-display text-2xl md:text-xl xl:text-2xl leading-tight group-hover:underline text-slate-900">
                      {a.title}
                    </h4>
                  ) : (
                    <span className="text-base font-semibold text-slate-500 group-hover:underline">Ver as notícias da região</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        </div>

        {/* Faixa 3 — Colunas, fundo quente (opinião e voz) */}
        {(colunas ?? []).length > 0 && (
          <div className="border-b border-rule bg-surface-warm">
            <div className="mx-auto max-w-7xl px-4 pt-10 pb-0">
              <ColumnsShortcut colunas={colunas ?? []} />
            </div>
          </div>
        )}

        {/* Faixa 4 — destaques, editorias e mais lidas, fundo base */}
        <div className="mx-auto max-w-7xl px-4 py-10">

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
              if (!a) return null;
              const Wrap: React.ElementType = a?.region ? Link : "div";
              const wrapProps = a?.region
                ? { to: "/$region/$slug", params: { region: a.region.slug, slug: a.slug } }
                : {};
              return (
                <Wrap key={i} {...wrapProps} className="flex flex-col gap-3 group cursor-pointer">
                  <div className="w-full aspect-video bg-slate-200 overflow-hidden">
                    {a?.cover_image_url ? (
                      <img src={a.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                    )}
                  </div>
                  <Chapeu artigo={a} cidadeLeitor={cidadeLeitor} />
                  <h4 className="font-display text-2xl md:text-[1.75rem] leading-tight text-ink group-hover:underline decoration-2 underline-offset-4">
                    {a.title}
                  </h4>
                  <p className="text-base text-ink-muted line-clamp-2">
                    {a.summary}
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
            <WeatherWidget
              citySlug={loc?.cidade ? cidadeSlug(loc.cidade) : undefined}
              cidadeNome={loc?.cidade ?? undefined}
            />
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
                  : []
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
            <AdSlot slot="home_sidebar_quadrado" />
            <AdSlot slot="home_sidebar_alto" />
          </aside>
        </div>

        {/* AdSense — Grupo 3 (rodapé) */}
        <div className="mt-10 empty:hidden">
          <AdsenseSlot slot="4261702843" format="autorelaxed" />
        </div>

        {/* CTA — Comunidade WhatsApp (rodapé da home) */}
        <div className="mt-10 flex justify-start">
          <WhatsAppCTA variant="button" />
        </div>
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
                  alt={lead.title}
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
                    <img src={a.cover_image_url} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
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
                    <img src={a.cover_image_url} alt={a.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" />
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

function HeroCard({ article, cidadeLeitor }: { article: RankedArticle | ItemDobra | undefined; cidadeLeitor?: string | null }) {
  return _HeroCardImpl({ article, cidadeLeitor });
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
                {(a.cidade_principal || a.region) && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {a.cidade_principal ?? a.region?.name}
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

function _HeroCardImpl({ article, cidadeLeitor }: { article: RankedArticle | ItemDobra | undefined; cidadeLeitor?: string | null }) {
  if (!article) return null;
  const title = article.title;
  const summary = article.subtitle ?? article.summary;
  const to = article?.region
    ? { to: "/$region/$slug" as const, params: { region: article.region.slug, slug: article.slug } }
    : null;

  const Inner = (
    <article className="group">
      {article?.cover_image_url && (
        <div className="aspect-video w-full overflow-hidden bg-slate-100">
          <img src={article.cover_image_url} alt="" className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
        </div>
      )}
      <div className={article?.cover_image_url ? "mt-4" : ""}>
        <Chapeu artigo={article} cidadeLeitor={cidadeLeitor} />
        <h1 className="mt-1.5 text-[2rem] leading-[1.09] md:text-[2.875rem] md:leading-[1.04] text-ink group-hover:underline decoration-2 underline-offset-[6px]">
          {title}
        </h1>
        {summary && (
          <p className="mt-2 max-w-[44rem] font-display text-lg md:text-xl leading-snug font-normal text-ink-muted line-clamp-2">
            {summary}
          </p>
        )}
      </div>
    </article>
  );

  return to ? <Link {...to} className="block">{Inner}</Link> : Inner;
}
