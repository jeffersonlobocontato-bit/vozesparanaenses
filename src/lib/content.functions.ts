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
    if (error) {
      if (isMissingSchema(error)) throw notFound();
      throw new Error(error.message);
    }
    if (!row) throw notFound();
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