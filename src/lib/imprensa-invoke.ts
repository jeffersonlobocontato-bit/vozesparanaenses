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
export async function invokeImprensa<T>(name: string, body: unknown): Promise<T> {
  const sbExterno = await getExternalBrowser();
  const { data: sess } = await sbExterno.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  return data as T;
}
