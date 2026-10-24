import { getExternalBrowser } from "./external-supabase-browser";

/**
 * Cabeçalho com o login da equipe (sessão do banco externo) para as funções
 * de escrita do painel (publish-article, manual-article, generate-article-image,
 * pipeline). Sem ele, as funções recusam — a chave pública não basta.
 */
export async function headersEquipe(): Promise<Record<string, string>> {
  const sb = await getExternalBrowser();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
