import { createServerFn } from "@tanstack/react-start";
import { cidadeSlug, displayRegionName, type ArticleListItem } from "./content.functions";

/**
 * Feed genérico usado pelos RSS por região / cidade / categoria.
 * Devolve as N últimas matérias publicadas que casam com o filtro.
 */
export const listFeedArticles = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      regionSlug?: string | null;
      citySlug?: string | null;
      categoriaSlug?: string | null;
      limit?: number;
    }) => ({
      regionSlug: d.regionSlug ?? null,
      citySlug: d.citySlug ?? null,
      categoriaSlug: d.categoriaSlug ?? null,
      limit: Math.min(Math.max(d.limit ?? 30, 1), 100),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      articles: ArticleListItem[];
      scopeName: string | null;
    }> => {
      const { getExternalSupabase } = await import("./external-supabase.server");
      const sb = getExternalSupabase();

      let regionId: string | null = null;
      let regionName: string | null = null;
      if (data.regionSlug) {
        const { data: reg } = await sb
          .from("regioes")
          .select("id, nome")
          .eq("slug", data.regionSlug)
          .maybeSingle();
        if (reg) {
          regionId = (reg as { id: string; nome: string }).id;
          regionName = (reg as { id: string; nome: string }).nome;
        }
      }

      let categoriaId: string | null = null;
      let categoriaName: string | null = null;
      if (data.categoriaSlug) {
        const { data: cat } = await sb
          .from("editorial_categories")
          .select("id, nome")
          .eq("slug", data.categoriaSlug)
          .maybeSingle();
        if (cat) {
          categoriaId = (cat as { id: string; nome: string }).id;
          categoriaName = (cat as { id: string; nome: string }).nome;
        }
      }

      // Pool maior quando filtramos por cidade (o filtro é feito em memória
      // via cidadeSlug para pegar cidade_principal + cidades_mencionadas).
      const pool = data.citySlug ? 400 : data.limit;
      let q = sb
        .from("generated_articles")
        .select(
          "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, cidade_principal, cidades_mencionadas, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)",
        )
        .eq("status", "publicado")
        .order("publicado_em", { ascending: false })
        .limit(pool);

      if (regionId) q = q.eq("regiao_id", regionId);
      if (categoriaId) q = q.eq("categoria_id", categoriaId);

      const { data: rows, error } = await q;
      if (error) return { articles: [], scopeName: null };

      type Row = ArticleListItem & {
        cidade_principal: string | null;
        cidades_mencionadas: string[] | null;
      };
      const mapRow = (r: {
        id: string;
        slug: string;
        titulo: string;
        subtitulo: string | null;
        resumo: string | null;
        imagem_capa_url: string | null;
        publicado_em: string | null;
        cidade_principal: string | null;
        cidades_mencionadas: string[] | null;
        regiao: { slug: string; nome: string } | null;
        categoria: { slug: string; nome: string } | null;
      }): Row => ({
        id: r.id,
        slug: r.slug,
        title: r.titulo,
        subtitle: r.subtitulo,
        summary: r.resumo,
        cover_image_url: r.imagem_capa_url,
        published_at: r.publicado_em,
        cidade_principal: r.cidade_principal,
        cidades_mencionadas: r.cidades_mencionadas,
        region: r.regiao
          ? { slug: r.regiao.slug, name: displayRegionName(r.regiao.slug, r.regiao.nome) }
          : null,
        categoria: r.categoria
          ? { slug: r.categoria.slug, name: r.categoria.nome }
          : null,
      });

      let items = ((rows ?? []) as unknown as Parameters<typeof mapRow>[0][]).map(mapRow);

      if (data.citySlug) {
        const target = data.citySlug;
        items = items.filter((r) => {
          if (cidadeSlug(r.cidade_principal) === target) return true;
          const list = r.cidades_mencionadas ?? [];
          return list.some((c) => cidadeSlug(c) === target);
        });
      }

      const scopeName = data.citySlug
        ? null // resolvido no route com cidadeFromSlug se necessário
        : categoriaName ?? regionName;

      return {
        articles: items.slice(0, data.limit),
        scopeName,
      };
    },
  );