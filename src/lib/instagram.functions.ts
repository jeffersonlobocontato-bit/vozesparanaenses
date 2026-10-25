import { createServerFn } from "@tanstack/react-start";

// Página /instagram (o "link da bio" do @vozesparanaenses): os posts que já
// foram ao ar, do mais novo ao mais velho, cada um com o link da matéria.

export type PostInstagramPublico = {
  id: string;
  tipo: string;
  publicado_em: string;
  imagem: string | null;
  links: Array<{ titulo: string; url: string }>;
};

export const listInstagramPublicados = createServerFn({ method: "GET" }).handler(
  async (): Promise<PostInstagramPublico[]> => {
    const { getExternalSupabase } = await import("./external-supabase.server");
    const sb = getExternalSupabase();
    const { data, error } = await sb
      .from("instagram_posts")
      .select("id, tipo, publicado_em, imagens, links")
      .eq("status", "publicado")
      .gte("publicado_em", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .order("publicado_em", { ascending: false })
      .limit(60);
    if (error) return []; // tabela ainda não criada (086): página vazia, sem erro
    return ((data ?? []) as Array<{ id: string; tipo: string; publicado_em: string; imagens: string[] | null; links: unknown }>).map((p) => ({
      id: p.id,
      tipo: p.tipo,
      publicado_em: p.publicado_em,
      imagem: p.imagens?.[0] ?? null,
      links: Array.isArray(p.links)
        ? (p.links as Array<{ titulo?: string; url?: string }>)
          .filter((l) => typeof l?.url === "string" && l.url.startsWith("https://vozesparanaenses.com.br/"))
          .map((l) => ({ titulo: String(l.titulo ?? ""), url: l.url as string }))
        : [],
    }));
  },
);
