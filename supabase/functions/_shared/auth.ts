// Quem pode chamar cada função.
//
// As funções rodam no projeto Lovable mas agem com a service role do banco
// EXTERNO — então nenhuma função de escrita pode confiar só na chave pública
// (anon), que vai no navegador de qualquer visitante.
//
//  - exigirEquipe: login de admin/editor do banco externo (painel /admin).
//  - exigirInterno: pipeline — cron (header x-cron-secret = CRON_SECRET),
//    chamada de uma função para outra (service role do projeto Lovable) ou
//    a equipe pelo painel ("Coletar agora").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function negar(status: number, error: string): Response {
  return new Response(JSON.stringify({ error, detail: status === 401 ? "Faça login no painel." : "Sem permissão." }), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Comparação em tempo constante (não vaza o segredo por tempo de resposta). */
function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** O token é de um usuário admin/editor do banco externo? */
async function ehEquipe(jwt: string): Promise<boolean | null> {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !jwt) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", data.user.id);
  return (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "editor");
}

/** Só admin/editor logado. Devolve uma Response de erro, ou null se pode seguir. */
export async function exigirEquipe(req: Request): Promise<Response | null> {
  const jwt = bearer(req);
  if (!jwt) return negar(401, "unauthorized");
  const ok = await ehEquipe(jwt);
  if (ok === null) return negar(401, "unauthorized");
  return ok ? null : negar(403, "forbidden");
}

/** Pipeline: cron com segredo, outra função (service role) ou a equipe. */
export async function exigirInterno(req: Request): Promise<Response | null> {
  const segredo = Deno.env.get("CRON_SECRET") ?? "";
  const enviado = req.headers.get("x-cron-secret") ?? "";
  if (segredo && iguais(enviado, segredo)) return null;

  const jwt = bearer(req);
  const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (jwt && (iguais(jwt, selfKey) || iguais(jwt, extKey))) return null;

  if (jwt && (await ehEquipe(jwt))) return null;

  // Transição: enquanto o CRON_SECRET não estiver configurado (e o cron do
  // banco ainda chamar com a chave pública), não trava o pipeline — só avisa.
  if (!segredo) {
    console.warn("[auth] CRON_SECRET não configurado: chamada sem segredo aceita (configure para fechar o pipeline).");
    return null;
  }
  return negar(401, "unauthorized");
}

/** Só chamada de outra função (service role) ou da equipe — sem transição pela chave pública. */
export async function exigirServicoOuEquipe(req: Request): Promise<Response | null> {
  const jwt = bearer(req);
  const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (jwt && (iguais(jwt, selfKey) || iguais(jwt, extKey))) return null;
  return exigirEquipe(req);
}
