import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";

export type Region = {
  id: string;
  slug: string;
  name: string;
  main_city: string;
  description: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hero_image_url: string | null;
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
};

export type ArticleFull = ArticleListItem & {
  body_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

export const listRegions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Region[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data, error } = await sb
      .from("regions")
      .select(
        "id, slug, name, main_city, description, primary_color, accent_color, hero_image_url",
      )
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Region[];
  },
);

export const getRegionBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<Region> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: row, error } = await sb
      .from("regions")
      .select(
        "id, slug, name, main_city, description, primary_color, accent_color, hero_image_url",
      )
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw notFound();
    return row as Region;
  });

export const listLatestArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number }) => ({ limit: d.limit ?? 12 }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: rows, error } = await sb
      .from("articles")
      .select(
        "id, slug, title, subtitle, summary, cover_image_url, published_at, region:regions(slug, name)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ArticleListItem[];
  });

export const listArticlesByRegion = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; limit?: number }) => ({
    regionSlug: d.regionSlug,
    limit: d.limit ?? 20,
  }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb
      .from("regions")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (!region) return [];
    const { data: rows, error } = await sb
      .from("articles")
      .select(
        "id, slug, title, subtitle, summary, cover_image_url, published_at, region:regions(slug, name)",
      )
      .eq("status", "published")
      .eq("region_id", (region as { id: string }).id)
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ArticleListItem[];
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { regionSlug: string; slug: string }) => d)
  .handler(async ({ data }): Promise<ArticleFull> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data: region } = await sb
      .from("regions")
      .select("id")
      .eq("slug", data.regionSlug)
      .maybeSingle();
    if (!region) throw notFound();
    const { data: row, error } = await sb
      .from("articles")
      .select(
        "id, slug, title, subtitle, summary, body_md, cover_image_url, published_at, seo_title, seo_description, og_image_url, region:regions(slug, name)",
      )
      .eq("region_id", (region as { id: string }).id)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw notFound();
    return row as unknown as ArticleFull;
  });