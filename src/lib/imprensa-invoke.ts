import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "./external-supabase-browser";

/**
 * As Edge Functions do Portal da Imprensa ficam no projeto Lovable, mas os
 * usuários (admin e clientes) autenticam no Supabase EXTERNO. Por isso não dá
 * pra usar `sbExterno.functions.invoke` (lá as funções não existem → "Failed to
 * send a request to the Edge Function"): chamamos no cliente Lovable e
 * anexamos manualmente o token da sessão externa, que é o que as funções
 * validam com a service role externa.
 */
export async function invokeImprensa<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const sbExterno = await getExternalBrowser();
  const { data: sess } = await sbExterno.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(await mensagemDoErro(error));
  return data as T;
}

// A função responde {error, detail} com status 4xx/5xx; o supabase-js só diz
// "non-2xx status code". Lê o corpo e traduz para uma mensagem útil.
const MENSAGENS: Record<string, string> = {
  slug_ja_existe: "Esse slug já está em uso por outro cliente. Escolha outro.",
  slug_invalido: "Slug inválido: use letras, números e hífens.",
  insert_cliente_failed: "Não foi possível salvar o cliente. Tente de novo.",
};

async function mensagemDoErro(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  let corpo: { error?: string; detail?: string } | null = null;
  try {
    if (ctx && typeof ctx.json === "function") corpo = await ctx.clone().json();
  } catch {
    /* corpo não é JSON */
  }
  const codigo = corpo?.error ?? "";
  const detalhe = corpo?.detail ?? "";
  if (codigo === "create_user_failed") {
    return /already|registered|exists/i.test(detalhe)
      ? "Este e-mail já tem uma conta no sistema (pode ser um login de admin). Use outro e-mail para o cliente."
      : `Não foi possível criar o acesso do cliente: ${detalhe || "erro desconhecido"}.`;
  }
  if (MENSAGENS[codigo]) return MENSAGENS[codigo];
  if (codigo) return detalhe ? `${codigo}: ${detalhe}` : codigo;
  return error instanceof Error ? error.message : "Erro inesperado.";
}

/** Chamada sem login (ex.: autocadastro). Mesmo tratamento de erro. */
export async function invokeImprensaPublico<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await mensagemDoErro(error));
  return data as T;
}
