import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";

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
};

export type ArticleFull = ArticleListItem & {
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

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
    name: r.nome,
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
    region: m.regiao ? { slug: m.regiao.slug, name: m.regiao.nome } : null,
    categoria: m.categoria ? { slug: m.categoria.slug, name: m.categoria.nome } : null,
  };
}

const MATERIA_LIST_COLS =
  "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";

const MATERIA_LIST_COLS_GEO =
  "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, cidade_principal, cidades_mencionadas, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";

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
        name: data.slug
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
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .order("publicado_em", { ascending: false })
      .limit(data.limit);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as unknown as MateriaRow[]).map(mapMateria);
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
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS_GEO)
      .eq("status", "publicado")
      .order("publicado_em", { ascending: false })
      .limit(poolSize);
    if (error) {
      if (isMissingSchema(error)) return [];
      // Se o schema geo ainda não rodou, cai no listagem simples.
      if ((error.message ?? "").toLowerCase().includes("cidade")) {
        const simple = await sb
          .from("generated_articles")
          .select(MATERIA_LIST_COLS)
          .eq("status", "publicado")
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

    return scored.slice(0, data.limit).map(({ row, prox }) => ({
      ...mapMateria(row),
      proximidade: prox,
      cidade_principal: row.cidade_principal,
    }));
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
    const { data: rows, error } = await sb
      .from("generated_articles")
      .select(MATERIA_LIST_COLS)
      .eq("status", "publicado")
      .eq("regiao_id", (region as { id: string }).id)
      .order("publicado_em", { ascending: false })
      .limit(data.limit);
    if (error) {
      if (isMissingSchema(error)) return [];
      throw new Error(error.message);
    }
    return ((rows ?? []) as unknown as MateriaRow[]).map(mapMateria);
  });

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
        "id, slug, titulo, subtitulo, resumo, corpo, imagem_capa_url, publicado_em, seo_title, seo_description, og_image_url, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
      )
      .eq("regiao_id", (region as { id: string }).id)
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw notFound();
    const r = row as unknown as MateriaRow & {
      corpo: string | null;
      seo_title: string | null;
      seo_description: string | null;
      og_image_url: string | null;
    };
    return {
      ...mapMateria(r),
      body_md: r.corpo,
      seo_title: r.seo_title,
      seo_description: r.seo_description,
      og_image_url: r.og_image_url,
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