import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { REGION_NAME_OVERRIDES, displayRegionName } from "./region-labels";
export { REGION_NAME_OVERRIDES, displayRegionName };

/**
 * Trata erros esperados enquanto o schema `002_vozes.sql` não foi rodado
 * no Supabase externo. Retorna `true` quando é seguro devolver vazio.
 */
function isMissingSchema(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

export type TemaConfig = {
  paleta?: { primaria?: string; acento?: string; fundo?: string };
  tipografia_destaque?: string;
  tipografia_corpo?: string;
  densidade?: "compacta" | "media" | "alta";
  elemento_assinatura?: string;
};

export type Region = {
  id: string;
  slug: string;
  name: string;
  main_city: string;
  description: string | null;
  hero_image_url: string | null;
  tema_config: TemaConfig;
};

export type Categoria = {
  id: string;
  slug: string;
  name: string;
};

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  region: { slug: string; name: string } | null;
  categoria: { slug: string; name: string } | null;
  fixado_posicao?: number | null;
  fixado_escopo?: "estado" | "regiao" | "cidades" | null;
  fixado_regioes?: string[] | null;
  fixado_cidades?: string[] | null;
};

export type ArticleFull = ArticleListItem & {
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  cidade_principal: string | null;
  cidades_mencionadas: string[] | null;
  updated_at: string | null;
  tldr: string | null;
  fatos_5w1h: FiveWOneH | null;
  faq: FaqItem[] | null;
  editor_responsavel: string | null;
};

export type FiveWOneH = {
  quem?: string | null;
  o_que?: string | null;
  quando?: string | null;
  onde?: string | null;
  por_que?: string | null;
  como?: string | null;
};

export type FaqItem = { pergunta: string; resposta: string };

function coerceFaq(v: unknown): FaqItem[] | null {
  if (!Array.isArray(v)) return null;
  const out: FaqItem[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const p = (item as Record<string, unknown>).pergunta ?? (item as Record<string, unknown>).question;
    const r = (item as Record<string, unknown>).resposta ?? (item as Record<string, unknown>).answer;
    if (typeof p === "string" && typeof r === "string" && p.trim() && r.trim()) {
      out.push({ pergunta: p.trim(), resposta: r.trim() });
    }
  }
  return out.length > 0 ? out : null;
}

function coerce5W1H(v: unknown): FiveWOneH | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const pick = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : null);
  const r: FiveWOneH = {
    quem: pick("quem"),
    o_que: pick("o_que"),
    quando: pick("quando"),
    onde: pick("onde"),
    por_que: pick("por_que"),
    como: pick("como"),
  };
  return Object.values(r).some((x) => x) ? r : null;
}

type RegiaoRow = {
  id: string;
  slug: string;
  nome: string;
  cidade_principal: string;
  descricao: string | null;
  hero_image_url: string | null;
  tema_config: TemaConfig | null;
};

function mapRegiao(r: RegiaoRow): Region {
  return {
    id: r.id,
    slug: r.slug,
    name: REGION_NAME_OVERRIDES[r.slug] ?? r.nome,
    main_city: r.cidade_principal,
    description: r.descricao,
    hero_image_url: r.hero_image_url,
    tema_config: r.tema_config ?? {},
  };
}


type MateriaRow = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  imagem_capa_url: string | null;
  publicado_em: string | null;
  regiao: { slug: string; nome: string } | null;
  categoria: { slug: string; nome: string } | null;
  fixado_posicao?: number | null;
  fixado_escopo?: string | null;
  fixado_regioes?: string[] | null;
  fixado_cidades?: string[] | null;
};

function mapMateria(m: MateriaRow): ArticleListItem {
  return {
    id: m.id,
    slug: m.slug,
    title: m.titulo,
    subtitle: m.subtitulo,
    summary: m.resumo,
    cover_image_url: m.imagem_capa_url,
    published_at: m.publicado_em,
    region: m.regiao
      ? { slug: m.regiao.slug, name: displayRegionName(m.regiao.slug, m.regiao.nome) }
      : null,
    categoria: m.categoria ? { slug: m.categoria.slug, name: m.categoria.nome } : null,
    fixado_posicao: typeof m.fixado_posicao === "number" ? m.fixado_posicao : null,
    fixado_escopo:
      m.fixado_escopo === "regiao" || m.fixado_escopo === "cidades" || m.fixado_escopo === "estado"
        ? m.fixado_escopo
        : null,
    fixado_regioes: Array.isArray(m.fixado_regioes) ? m.fixado_regioes : null,
    fixado_cidades: Array.isArray(m.fixado_cidades) ? m.fixado_cidades : null,
  };
}

const MATERIA_LIST_COLS =
  "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";

const MATERIA_LIST_COLS_GEO =
  "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, cidade_principal, cidades_mencionadas, fixado_posicao, fixado_escopo, fixado_regioes, fixado_cidades, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";

/**
 * Só a posição 0 deve subir automaticamente para o topo da lista.
 * As posições 1..N são laterais e são encaixadas pelo layout, não pela ordem.
 */
function sortWithPinned<T extends { fixado_posicao?: number | null }>(rows: T[]): T[] {
  const headline = rows.filter((r) => r.fixado_posicao === 0);
  const rest = rows.filter((r) => r.fixado_posicao !== 0);
  return [...headline, ...rest];
}

export const listRegions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Region[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data, error } = await sb
      .from("regioes")
      .select("id, slug, nome, cidade_principal, descricao, hero_image_url, tema_config")
      .eq("ativa", true)
      .order("nome");
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((data ?? []) as RegiaoRow[]).map(mapRegiao);
  },
);

export const getRegionBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<Region> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: row, error } = await sb
      .from("regioes")
      .select("id, slug, nome, cidade_principal, descricao, hero_image_url, tema_config")
      .eq("slug", data.slug)
      .eq("ativa", true)
      .maybeSingle();
    if (error && !isMissingSchema(error)) {
      throw new Error(error.message);
    }
    if (!row) {
      // Fallback enquanto o schema/seed não está no Supabase — evita 500 na rota /$region.
      return {
        id: data.slug,
        slug: data.slug,
        name:
          REGION_NAME_OVERRIDES[data.slug] ??
          data.slug
            .split("-")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" "),
        main_city: "",
        description: null,
        hero_image_url: null,
        tema_config: {},
      };
    }
    return mapRegiao(row as RegiaoRow);
  });

export const listCategorias = createServerFn({ method: "GET" }).handler(
  async (): Promise<Categoria[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data, error } = await sb
      .from("editorial_categories")
      .select("id, slug, nome")
      .order("nome");
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((data ?? []) as { id: string; slug: string; nome: string }[]).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.nome,
    }));
  });

export const listLatestArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number }) => ({ limit: d.limit ?? 12 }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const run = (cols: string) =>
      sb
        .from("generated_articles")
        .select(cols)
        .eq("status", "publicado")
        .not("imagem_capa_url", "is", null)
        .order("publicado_em", { ascending: false })
        .limit(data.limit);
    let res = await run(MATERIA_LIST_COLS);
    if (res.error && /fixado_(posicao|escopo|regioes|cidades)/i.test(res.error.message)) {
      res = await run(
        "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      );
    }
    if (res.error) {
      if (isMissingSchema(res.error)) return [];
      throw new Error(res.error.message);
    }
    const mapped = ((res.data ?? []) as unknown as MateriaRow[]).map(mapMateria);
    return sortWithPinned(mapped);
  });

/* -------------------- Geolocalização editorial (cidade + entorno) -------------------- */

export type ViewerLocation = {
  cidade: string | null;
  regiaoSlug: string | null;
  source: "cookie" | "ip" | "none";
};

export type RankedArticle = ArticleListItem & {
  proximidade: "cidade" | "regiao" | "estado";
  cidade_principal: string | null;
};

function normalizeCidade(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Converte um nome de cidade em slug URL-safe (ex.: "Foz do Iguaçu" → "foz-do-iguacu"). */
export function cidadeSlug(v: string | null | undefined): string {
  const base = normalizeCidade(v);
  return base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Formata o slug de volta em nome legível ("foz-do-iguacu" → "Foz Do Iguacu").
 *  Preferimos o `cidade_principal` original quando disponível. */
export function cidadeFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export type CityInRegion = { citySlug: string; name: string; count: number };

/** Todas as duplas (regionSlug, citySlug) publicadas — usado no sitemap. */
export const listAllCityLandings = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ regionSlug: string; citySlug: string; name: string; lastmod: string | null }[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data, error } = await sb
      .from("generated_articles")
      .select("cidade_principal, publicado_em, regiao:regioes(slug)")
      .eq("status", "publicado")
      .not("cidade_principal", "is", null)
      .order("publicado_em", { ascending: false })
      .limit(2000);
    if (error) {
      if (isMissingSchema(error) || /cidade_/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    const acc = new Map<
      string,
      { regionSlug: string; citySlug: string; name: string; lastmod: string | null }
    >();
    for (const r of (data ?? []) as unknown as {
      cidade_principal: string | null;
      publicado_em: string | null;
      regiao: { slug: string } | { slug: string }[] | null;
    }[]) {
      const regionSlug = Array.isArray(r.regiao) ? r.regiao[0]?.slug : r.regiao?.slug;
      if (!regionSlug || !r.cidade_principal) continue;
      const citySlug = cidadeSlug(r.cidade_principal);
      if (!citySlug) continue;
      const key = `${regionSlug}/${citySlug}`;
      const cur = acc.get(key);
      if (!cur) {
        acc.set(key, {
          regionSlug,
          citySlug,
          name: r.cidade_principal,
          lastmod: r.publicado_em,
        });
      }
    }
    return [...acc.values()];
  },
);

/** Lista as cidades cobertas em uma região com contagem de matérias publicadas. */
export const listCitiesInRegion = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; limit?: number }) => ({
    regionSlug: d.regionSlug,
    limit: d.limit ?? 400,
  }))
  .handler(async ({ data }): Promise<CityInRegion[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb
      .from("regioes")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (!region) return [];
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select("cidade_principal")
      .eq("status", "publicado")
      .eq("regiao_id", (region as { id: string }).id)
      .not("cidade_principal", "is", null)
      .order("publicado_em", { ascending: false })
      .limit(data.limit);
    if (error) {
      if (isMissingSchema(error)) return [];
      if (/cidade_/i.test(error.message)) return [];
      throw new Error(error.message);
    }
    const acc = new Map<string, CityInRegion>();
    for (const r of (rows ?? []) as { cidade_principal: string | null }[]) {
      const name = (r.cidade_principal ?? "").trim();
      if (!name) continue;
      const s = cidadeSlug(name);
      if (!s) continue;
      const cur = acc.get(s);
      if (cur) cur.count += 1;
      else acc.set(s, { citySlug: s, name, count: 1 });
    }
    return [...acc.values()].sort((a, b) => b.count - a.count);
  });

/** Matérias publicadas cujo `cidade_principal` (slugificado) bate com `citySlug`. */
export const listArticlesByCity = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; citySlug: string; limit?: number }) => ({
    regionSlug: d.regionSlug,
    citySlug: d.citySlug,
    limit: d.limit ?? 30,
  }))
  .handler(async ({ data }): Promise<{
    articles: ArticleListItem[];
    cityName: string;
  }> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb
      .from("regioes")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (!region) return { articles: [], cityName: cidadeFromSlug(data.citySlug) };
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS_GEO)
      .eq("status", "publicado")
      .eq("regiao_id", (region as { id: string }).id)
      .not("imagem_capa_url", "is", null)
      .order("publicado_em", { ascending: false })
      .limit(400);
    if (error) {
      if (isMissingSchema(error) || /cidade_/i.test(error.message)) {
        return { articles: [], cityName: cidadeFromSlug(data.citySlug) };
      }
      throw new Error(error.message);
    }
    let cityName = cidadeFromSlug(data.citySlug);
    const matched: MateriaRow[] = [];
    for (const row of (rows ?? []) as unknown as (MateriaRow & {
      cidade_principal: string | null;
      cidades_mencionadas: string[] | null;
    })[]) {
      const cp = row.cidade_principal ?? "";
      const mentions = row.cidades_mencionadas ?? [];
      if (cidadeSlug(cp) === data.citySlug) {
        if (cp && cityName.toLowerCase() === cidadeFromSlug(data.citySlug).toLowerCase()) cityName = cp;
        matched.push(row);
        continue;
      }
      if (mentions.some((m) => cidadeSlug(m) === data.citySlug)) {
        matched.push(row);
      }
    }
    return {
      articles: matched.slice(0, data.limit).map(mapMateria),
      cityName,
    };
  });

const LOC_COOKIE = "vp_loc";

export const getViewerLocation = createServerFn({ method: "GET" }).handler(
  async (): Promise<ViewerLocation> => {
    const { getCookie, getRequestHeader } = await import(
      "@tanstack/react-start/server"
    );
    const raw = getCookie(LOC_COOKIE);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          cidade?: string | null;
          regiaoSlug?: string | null;
        };
        if (parsed.cidade || parsed.regiaoSlug) {
          return {
            cidade: parsed.cidade ?? null,
            regiaoSlug: parsed.regiaoSlug ?? null,
            source: "cookie",
          };
        }
      } catch {
        /* cookie inválido — ignorar */
      }
    }
    // Cloudflare Workers: header cf-ipcity (best-effort, sem região)
    const cfCity = getRequestHeader("cf-ipcity");
    if (cfCity) {
      return { cidade: cfCity, regiaoSlug: null, source: "ip" };
    }
    return { cidade: null, regiaoSlug: null, source: "none" };
  },
);

export const setViewerLocation = createServerFn({ method: "POST" })
  .inputValidator((d: { cidade?: string | null; regiaoSlug?: string | null }) => ({
    cidade: d.cidade ? String(d.cidade).slice(0, 80) : null,
    regiaoSlug: d.regiaoSlug ? String(d.regiaoSlug).slice(0, 60) : null,
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(LOC_COOKIE, JSON.stringify(data), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 dias
    });
    return { ok: true };
  });

export const listRankedArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { cidade?: string | null; regiaoSlug?: string | null; limit?: number }) => ({
    cidade: d.cidade ?? null,
    regiaoSlug: d.regiaoSlug ?? null,
    limit: d.limit ?? 12,
  }))
  .handler(async ({ data }): Promise<RankedArticle[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    // Puxamos um pool maior para reordenar em memória.
    const poolSize = Math.max(data.limit * 4, 40);
    const runRanked = (cols: string) =>
      sb
        .from("generated_articles")
        .select(cols)
        .eq("status", "publicado")
        .not("imagem_capa_url", "is", null)
        .order("publicado_em", { ascending: false })
        .limit(poolSize);
    let rankedRes = await runRanked(MATERIA_LIST_COLS_GEO);
    if (rankedRes.error && /fixado_(posicao|escopo|regioes|cidades)/i.test(rankedRes.error.message)) {
      rankedRes = await runRanked(
        "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, cidade_principal, cidades_mencionadas, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      );
    }
    let rows = (rankedRes.data ?? []) as unknown[];
    const { error } = rankedRes;
    if (error) {
      if (isMissingSchema(error)) return [];
      // Se o schema geo ainda não rodou, cai no listagem simples.
      if ((error.message ?? "").toLowerCase().includes("cidade")) {
        const simple = await sb
          .from("generated_articles")
          .select(MATERIA_LIST_COLS)
          .eq("status", "publicado")
          .not("imagem_capa_url", "is", null)
          .order("publicado_em", { ascending: false })
          .limit(data.limit);
        if (simple.error) throw new Error(simple.error.message);
        return ((simple.data ?? []) as unknown as MateriaRow[]).map((m) => ({
          ...mapMateria(m),
          proximidade: "estado" as const,
          cidade_principal: null,
        }));
      }
      throw new Error(error.message);
    }

    const pinnedRes = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS_GEO)
      .eq("status", "publicado")
      .not("fixado_posicao", "is", null)
      .order("fixado_posicao", { ascending: true })
      .limit(10);
    if (!pinnedRes.error && pinnedRes.data) {
      const seen = new Set((rows as Array<{ id: string }>).map((row) => row.id));
      const pinnedRows = pinnedRes.data as unknown as Array<{ id: string }>;
      rows = [
        ...rows,
        ...pinnedRows.filter((row) => !seen.has(row.id)),
      ];
    }

    const cidadeNorm = normalizeCidade(data.cidade);
    const regiao = data.regiaoSlug;

    type Row = MateriaRow & {
      cidade_principal: string | null;
      cidades_mencionadas: string[] | null;
    };

    const scored = ((rows ?? []) as unknown as Row[]).map((r) => {
      const cp = normalizeCidade(r.cidade_principal);
      const mencionadas = (r.cidades_mencionadas ?? []).map(normalizeCidade);
      let score = 0;
      let prox: RankedArticle["proximidade"] = "estado";
      if (cidadeNorm && (cp === cidadeNorm || mencionadas.includes(cidadeNorm))) {
        score += 100;
        prox = "cidade";
      }
      if (regiao && r.regiao?.slug === regiao) {
        score += 50;
        if (prox === "estado") prox = "regiao";
      }
      const ts = r.publicado_em ? new Date(r.publicado_em).getTime() : 0;
      // recência entra como desempate leve (max ~10 pontos)
      const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - Math.min(10, ageDays));
      return { row: r, score, prox };
    });

    scored.sort((a, b) => b.score - a.score);

    const pinnedScored = scored
      .filter(({ row }) => typeof row.fixado_posicao === "number" && row.fixado_posicao !== null)
      .sort((a, b) => (a.row.fixado_posicao ?? 999) - (b.row.fixado_posicao ?? 999));
    const regularScored = scored.filter(
      ({ row }) => !(typeof row.fixado_posicao === "number" && row.fixado_posicao !== null),
    );

    const ranked = [...pinnedScored, ...regularScored].slice(0, data.limit).map(({ row, prox }) => ({
      ...mapMateria(row),
      proximidade: prox,
      cidade_principal: row.cidade_principal,
    }));
    return sortWithPinned(ranked);
  });

export const listArticlesByRegion = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; limit?: number }) => ({
    regionSlug: d.regionSlug,
    limit: d.limit ?? 20,
  }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region, error: regionErr } = await sb
      .from("regioes")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (regionErr && isMissingSchema(regionErr)) return [];
    if (!region) return [];
    const runRegion = (cols: string) =>
      sb
        .from("generated_articles")
        .select(cols)
        .eq("status", "publicado")
        .eq("regiao_id", (region as { id: string }).id)
        .not("imagem_capa_url", "is", null)
        .order("publicado_em", { ascending: false })
        .limit(data.limit);
    let res = await runRegion(MATERIA_LIST_COLS);
    if (res.error && /fixado_(posicao|escopo|regioes|cidades)/i.test(res.error.message)) {
      res = await runRegion(
        "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      );
    }
    if (res.error) {
      if (isMissingSchema(res.error)) return [];
      throw new Error(res.error.message);
    }
    let rows = (res.data ?? []) as unknown[];
    const pinnedRes = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .eq("regiao_id", (region as { id: string }).id)
      .not("imagem_capa_url", "is", null)
      .not("fixado_posicao", "is", null)
      .order("fixado_posicao", { ascending: true })
      .limit(10);
    if (!pinnedRes.error && pinnedRes.data) {
      const seen = new Set((rows as Array<{ id: string }>).map((row) => row.id));
      const pinnedRows = pinnedRes.data as unknown as Array<{ id: string }>;
      rows = [
        ...rows,
        ...pinnedRows.filter((row) => !seen.has(row.id)),
      ];
    }
    const mapped = ((rows ?? []) as unknown as MateriaRow[]).map(mapMateria);
    return sortWithPinned(mapped);
  });

/**
 * Matérias mais lidas dos últimos N dias — agregadas a partir dos
 * pageviews em `analytics_events`. Usa service role no server (agregado
 * é global, não expõe dados por usuário).
 */
export const listMostReadArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { days?: number; limit?: number }) => ({
    days: Math.min(Math.max(d.days ?? 7, 1), 30),
    limit: Math.min(Math.max(d.limit ?? 5, 1), 20),
  }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalServiceRole } = await import("./external-supabase.server");
    const sb = getExternalServiceRole();
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await sb
      .from("analytics_events")
      .select("pagina")
      .eq("tipo_evento", "pageview")
      .gte("ts", since)
      .not("pagina", "is", null)
      .limit(20000);
    if (error) {
      if (isMissingSchema(error)) return [];
      return [];
    }
    // Conta por pagina no formato /{region}/{slug} — descarta home, /admin, editorias.
    const counts = new Map<string, { region: string; slug: string; n: number }>();
    for (const row of (events ?? []) as { pagina: string | null }[]) {
      const p = row.pagina;
      if (!p) continue;
      const parts = p.split("?")[0].split("#")[0].split("/").filter(Boolean);
      if (parts.length !== 2) continue;
      const [region, slug] = parts;
      if (!region || !slug) continue;
      if (region === "admin" || region === "editoria" || region === "autor" || region === "auth" || region === "api") continue;
      const key = `${region}/${slug}`;
      const cur = counts.get(key);
      if (cur) cur.n += 1;
      else counts.set(key, { region, slug, n: 1 });
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, data.limit * 4);
    if (top.length === 0) return [];
    const slugs = top.map((t) => t.slug);
    const { data: rows, error: artErr } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .in("slug", slugs);
    if (artErr) return [];
    const bySlug = new Map<string, ArticleListItem>();
    for (const r of (rows ?? []) as unknown as MateriaRow[]) {
      const item = mapMateria(r);
      // Só considera se o par region/slug bate — evita colisão de slug entre regiões.
      const match = top.find((t) => t.slug === item.slug && t.region === item.region?.slug);
      if (match) bySlug.set(`${match.region}/${match.slug}`, item);
    }
    const ordered: ArticleListItem[] = [];
    for (const t of top) {
      const it = bySlug.get(`${t.region}/${t.slug}`);
      if (it) ordered.push(it);
      if (ordered.length >= data.limit) break;
    }
    return ordered;
  });

/**
 * Notícias publicadas SEM foto de capa — módulo "VAPT-VUPT".
 * Não entram na primeira dobra; ficam no bloco dedicado ao lado das Mais Lidas.
 */
export const listArticlesWithoutImage = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number }) => ({ limit: d.limit ?? 8 }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const run = (cols: string) =>
      sb
        .from("generated_articles")
        .select(cols)
        .eq("status", "publicado")
        .is("imagem_capa_url", null)
        .order("publicado_em", { ascending: false })
        .limit(data.limit);
    let res = await run(MATERIA_LIST_COLS);
    if (res.error && /fixado_(posicao|escopo|regioes|cidades)/i.test(res.error.message)) {
      res = await run(
        "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      );
    }
    if (res.error) {
      if (isMissingSchema(res.error)) return [];
      throw new Error(res.error.message);
    }
    return ((res.data ?? []) as unknown as MateriaRow[]).map(mapMateria);
  });

/**
 * Matérias relacionadas para cross-linking dentro de uma matéria aberta.
 * Prioriza: mesma cidade (match em cidade_principal OU em cidades_mencionadas)
 * → resto da mesma região. Retorna dois grupos exclusivos entre si.
 */
export const listRelatedArticles = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      articleId: string;
      regionSlug: string;
      cidade?: string | null;
      limit?: number;
    }) => ({
      articleId: d.articleId,
      regionSlug: d.regionSlug,
      cidade: d.cidade ?? null,
      limit: d.limit ?? 6,
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ mesmaCidade: ArticleListItem[]; mesmaRegiao: ArticleListItem[] }> => {
      const { getExternalSupabase } = await import("./external-supabase.server");
      const sb = getExternalSupabase();
      const { data: region } = await sb
        .from("regioes")
        .select("id")
        .eq("slug", data.regionSlug)
        .maybeSingle();
      if (!region) return { mesmaCidade: [], mesmaRegiao: [] };
      const { data: rows, error } = await sb
        .from("generated_articles")
        .select(MATERIA_LIST_COLS_GEO)
        .eq("status", "publicado")
        .eq("regiao_id", (region as { id: string }).id)
        .neq("id", data.articleId)
        .not("imagem_capa_url", "is", null)
        .order("publicado_em", { ascending: false })
        .limit(80);
      if (error) {
        if (isMissingSchema(error) || /cidade_/i.test(error.message)) {
          // Fallback sem colunas geo
          const simple = await sb
            .from("generated_articles")
            .select(MATERIA_LIST_COLS)
            .eq("status", "publicado")
            .eq("regiao_id", (region as { id: string }).id)
            .neq("id", data.articleId)
            .not("imagem_capa_url", "is", null)
            .order("publicado_em", { ascending: false })
            .limit(data.limit);
          if (simple.error) return { mesmaCidade: [], mesmaRegiao: [] };
          return {
            mesmaCidade: [],
            mesmaRegiao: ((simple.data ?? []) as unknown as MateriaRow[]).map(mapMateria),
          };
        }
        throw new Error(error.message);
      }
      const cityKey = data.cidade ? cidadeSlug(data.cidade) : null;
      const mesmaCidade: ArticleListItem[] = [];
      const mesmaRegiao: ArticleListItem[] = [];
      for (const r of (rows ?? []) as unknown as (MateriaRow & {
        cidade_principal: string | null;
        cidades_mencionadas: string[] | null;
      })[]) {
        const item = mapMateria(r);
        const rowCity = cidadeSlug(r.cidade_principal);
        const mentions = (r.cidades_mencionadas ?? []).map((m) => cidadeSlug(m));
        const cityMatch = !!cityKey && (rowCity === cityKey || mentions.includes(cityKey));
        if (cityMatch && mesmaCidade.length < data.limit) mesmaCidade.push(item);
        else if (mesmaRegiao.length < data.limit) mesmaRegiao.push(item);
      }
      return { mesmaCidade, mesmaRegiao };
    },
  );

export const listArticlesByCategory = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; categorySlug: string; limit?: number }) => ({
    regionSlug: d.regionSlug,
    categorySlug: d.categorySlug,
    limit: d.limit ?? 30,
  }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const [{ data: region }, { data: category }] = await Promise.all([
      sb.from("regioes").select("id").eq("slug", data.regionSlug).maybeSingle(),
      sb.from("editorial_categories").select("id").eq("slug", data.categorySlug).maybeSingle(),
    ]);
    if (!region || !category) return [];
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .eq("regiao_id", (region as { id: string }).id)
      .eq("categoria_id", (category as { id: string }).id)
      .not("imagem_capa_url", "is", null)
      .order("publicado_em", { ascending: false })
      .limit(data.limit);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as unknown as MateriaRow[]).map(mapMateria);
  });

/** Lista matérias por editoria em TODAS as regiões (usado por Nacional / Internacional). */
export const listArticlesByCategoryGlobal = createServerFn({ method: "GET" })
  .inputValidator((d: { categorySlug: string; limit?: number; requireImage?: boolean }) => ({
    categorySlug: d.categorySlug,
    limit: d.limit ?? 30,
    requireImage: d.requireImage ?? true,
  }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: category } = await sb
      .from("editorial_categories")
      .select("id")
      .eq("slug", data.categorySlug)
      .maybeSingle();
    if (!category) return [];
    let q = sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .eq("categoria_id", (category as { id: string }).id);
    if (data.requireImage) q = q.not("imagem_capa_url", "is", null);
    const { data: rows, error } = await q
      .order("publicado_em", { ascending: false })
      .limit(data.limit);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as unknown as MateriaRow[]).map(mapMateria);
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; slug: string }) => d)
  .handler(async ({ data }): Promise<ArticleFull> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb
      .from("regioes")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (!region) throw notFound();
    const { data: row, error } = await sb
      .from("generated_articles")
      .select(
        "id, slug, titulo, subtitulo, resumo, corpo, imagem_capa_url, publicado_em, updated_at, cidade_principal, cidades_mencionadas, tldr, fatos_5w1h, faq, editor_responsavel, seo_title, seo_description, og_image_url, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      )
      .eq("regiao_id", (region as { id: string }).id)
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error) {
      // Fallback quando as colunas geo/updated_at ainda não existirem no schema.
      if (/column .* does not exist|cidade_|updated_at|tldr|fatos_5w1h|faq|editor_responsavel/i.test(error.message)) {
        const { data: legacy, error: legacyErr } = await sb
          .from("generated_articles")
          .select(
            "id, slug, titulo, subtitulo, resumo, corpo, imagem_capa_url, publicado_em, seo_title, seo_description, og_image_url, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
          )
          .eq("regiao_id", (region as { id: string }).id)
          .eq("slug", data.slug)
          .eq("status", "publicado")
          .maybeSingle();
        if (legacyErr) throw new Error(legacyErr.message);
        if (!legacy) throw notFound();
        const lr = legacy as unknown as MateriaRow & {
          corpo: string | null;
          seo_title: string | null;
          seo_description: string | null;
          og_image_url: string | null;
        };
        return {
          ...mapMateria(lr),
          body_md: lr.corpo,
          seo_title: lr.seo_title,
          seo_description: lr.seo_description,
          og_image_url: lr.og_image_url,
          cidade_principal: null,
          cidades_mencionadas: null,
          updated_at: null,
          tldr: null,
          fatos_5w1h: null,
          faq: null,
          editor_responsavel: null,
        };
      }
      throw new Error(error.message);
    }
    if (!row) throw notFound();
    const r = row as unknown as MateriaRow & {
      corpo: string | null;
      seo_title: string | null;
      seo_description: string | null;
      og_image_url: string | null;
      cidade_principal: string | null;
      cidades_mencionadas: string[] | null;
      updated_at: string | null;
      tldr: string | null;
      fatos_5w1h: unknown;
      faq: unknown;
      editor_responsavel: string | null;
    };
    return {
      ...mapMateria(r),
      body_md: r.corpo,
      seo_title: r.seo_title,
      seo_description: r.seo_description,
      og_image_url: r.og_image_url,
      cidade_principal: r.cidade_principal,
      cidades_mencionadas: r.cidades_mencionadas,
      updated_at: r.updated_at,
      tldr: r.tldr && r.tldr.trim() ? r.tldr.trim() : null,
      fatos_5w1h: coerce5W1H(r.fatos_5w1h),
      faq: coerceFaq(r.faq),
      editor_responsavel: r.editor_responsavel && r.editor_responsavel.trim() ? r.editor_responsavel.trim() : null,
    };
  });

export const createWhatsappLead = createServerFn({ method: "POST" })
  .inputValidator((d: { nome: string; telefone: string; regiaoSlug?: string; fonte?: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    let regiao_id: string | null = null;
    if (data.regiaoSlug) {
      const { data: r } = await sb.from("regioes").select("id").eq("slug", data.regiaoSlug).maybeSingle();
      regiao_id = (r as { id: string } | null)?.id ?? null;
    }
    const { error } = await sb.from("whatsapp_leads").insert({
      nome: data.nome,
      telefone: data.telefone,
      regiao_id,
      fonte_captura: data.fonte ?? "site",
      consentimento_lgpd: true,
      consentimento_timestamp: new Date().toISOString(),
      canal_ou_lista: "canal_nativo",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClassificados = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string }) => d)
  .handler(async ({ data }): Promise<
    { id: string; categoria: string; titulo: string; descricao: string | null; contato: string | null; criado_em: string }[]
  > => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region, error: regionErr } = await sb.from("regioes").select("id").eq("slug", data.regionSlug).maybeSingle();
    if (regionErr && isMissingSchema(regionErr)) return [];
    if (!region) return [];
    const { data: rows, error } = await sb
      .from("classificados")
      .select("id, categoria, titulo, descricao, contato, criado_em")
      .eq("regiao_id", (region as { id: string }).id)
      .eq("ativo", true)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return (rows ?? []) as {
      id: string;
      categoria: string;
      titulo: string;
      descricao: string | null;
      contato: string | null;
      criado_em: string;
    }[];
  });

export const createClassificado = createServerFn({ method: "POST" })
  .inputValidator((d: {
    regionSlug: string;
    categoria: "emprego" | "imovel" | "veiculo";
    titulo: string;
    descricao?: string;
    contato: string;
  }) => d)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb.from("regioes").select("id").eq("slug", data.regionSlug).maybeSingle();
    if (!region) throw new Error("Região não encontrada");
    const { error } = await sb.from("classificados").insert({
      regiao_id: (region as { id: string }).id,
      categoria: data.categoria,
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      contato: data.contato,
      ativo: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const listArticlesByAuthor = createServerFn({ method: "GET" })
  .inputValidator((d: { authorSlug: string; limit?: number }) => d)
  .handler(
    async ({
      data,
    }): Promise<{ authorName: string | null; articles: ArticleListItem[] }> => {
      const { getExternalSupabase } = await import("./external-supabase.server");
      const { slugifyAuthor } = await import("./authors");
      const sb = getExternalSupabase();
      const { data: rows, error } = await sb
        .from("generated_articles")
        .select(
          "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, editor_responsavel, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
        )
        .eq("status", "publicado")
        .not("editor_responsavel", "is", null)
        .order("publicado_em", { ascending: false })
        .limit(500);
      if (error) {
        if (isMissingSchema(error)) return { authorName: null, articles: [] };
        throw new Error(error.message);
      }
      const list = (rows ?? []) as unknown as (MateriaRow & {
        editor_responsavel: string | null;
      })[];
      const matched = list.filter(
        (r) =>
          r.editor_responsavel &&
          slugifyAuthor(r.editor_responsavel) === data.authorSlug,
      );
      const authorName =
        matched[0]?.editor_responsavel?.trim() ?? null;
      const articles = matched
        .slice(0, data.limit ?? 50)
        .map((r) => mapMateria(r));
      return { authorName, articles };
    },
  );

export const listAuthors = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ slug: string; name: string; lastmod: string | null }[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const { slugifyAuthor } = await import("./authors");
    const sb = getExternalSupabase();
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select("editor_responsavel, publicado_em")
      .eq("status", "publicado")
      .not("editor_responsavel", "is", null)
      .order("publicado_em", { ascending: false })
      .limit(1000);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    const seen = new Map<string, { name: string; lastmod: string | null }>();
    for (const r of (rows ?? []) as {
      editor_responsavel: string | null;
      publicado_em: string | null;
    }[]) {
      const name = r.editor_responsavel?.trim();
      if (!name) continue;
      const slug = slugifyAuthor(name);
      if (!slug) continue;
      if (!seen.has(slug)) seen.set(slug, { name, lastmod: r.publicado_em });
    }
    return Array.from(seen.entries()).map(([slug, v]) => ({ slug, ...v }));
  },
);
