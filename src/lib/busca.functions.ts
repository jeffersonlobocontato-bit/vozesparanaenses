import { createServerFn } from "@tanstack/react-start";
import { displayRegionName } from "./region-labels";
import type { ArticleListItem } from "./content.functions";

// Busca do site (/busca?q=) e contador anônimo do banner de cookies.
// O parâmetro "q" é o que a medição otimizada do GA4 lê para gerar o evento
// view_search_results — e é o alvo do SearchAction no JSON-LD (__root.tsx).

type Linha = {
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

const COLS =
  "id, slug, titulo, subtitulo, resumo, imagem_capa_url, publicado_em, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)";

function mapear(m: Linha): ArticleListItem {
  return {
    id: m.id,
    slug: m.slug,
    title: m.titulo,
    subtitle: m.subtitulo,
    summary: m.resumo,
    cover_image_url: m.imagem_capa_url,
    published_at: m.publicado_em,
    region: m.regiao ? { slug: m.regiao.slug, name: displayRegionName(m.regiao.slug, m.regiao.nome) } : null,
    categoria: m.categoria ? { slug: m.categoria.slug, name: m.categoria.nome } : null,
  };
}

export const buscarMaterias = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").trim().slice(0, 80) }))
  .handler(async ({ data }): Promise<ArticleListItem[]> => {
    if (data.q.length < 2) return [];
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();

    // 1º a RPC (098: sem acento, todos os termos); sem ela, ilike simples.
    const rpc = await sb.rpc("buscar_materias", { p_q: data.q, p_limite: 40 });
    if (!rpc.error) {
      const ids = ((rpc.data ?? []) as Array<{ id: string }>).map((r) => r.id);
      if (ids.length === 0) return [];
      const { data: linhas } = await sb.from("generated_articles").select(COLS).in("id", ids);
      const porId = new Map(((linhas ?? []) as unknown as Linha[]).map((l) => [l.id, l]));
      return ids.map((id) => porId.get(id)).filter((l): l is Linha => !!l).map(mapear);
    }

    const termo = data.q.replace(/[,()%*\\]/g, " ").trim();
    if (termo.length < 2) return [];
    const { data: linhas } = await sb
      .from("generated_articles")
      .select(COLS)
      .eq("status", "publicado")
      .or(`titulo.ilike.%${termo}%,resumo.ilike.%${termo}%`)
      .order("publicado_em", { ascending: false })
      .limit(40);
    return ((linhas ?? []) as unknown as Linha[]).map(mapear);
  });

/** Conta (sem identificar ninguém) exibição/aceite/recusa do banner. */
export const registrarConsentimento = createServerFn({ method: "POST" })
  .inputValidator((d: { evento: string }) => ({
    evento: ["exibido", "aceito", "recusado"].includes(d.evento) ? d.evento : "",
  }))
  .handler(async ({ data }) => {
    if (!data.evento) return { ok: false };
    try {
      const { getExternalSupabase } = await import("./external-supabase.server");
      await getExternalSupabase().rpc("registrar_consentimento", { p_evento: data.evento });
    } catch {
      // contador nunca quebra a página
    }
    return { ok: true };
  });
