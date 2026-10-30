// Vozes Paranaenses — equipe-criar-usuario
// Cadastra uma pessoa da equipe no painel (/admin/usuarios): cria a conta de
// login no banco EXTERNO (onde o painel autentica) com senha temporária e
// dá o papel escolhido. Se o e-mail já tem conta, só dá o papel.
//
// Só ADMIN pode chamar (editor não cadastra ninguém): cria conta de outra
// pessoa com a service role.
//
// Body: { email, nome, papel: "admin" | "editor" | "viewer" }
// Resposta: { ok, user_id, nova_conta, senha_temporaria? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "content-type": "application/json" } });
}

function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => alfabeto[b % alfabeto.length]).join("");
}

const PAPEIS = ["admin", "editor", "viewer"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing_external_supabase_env" }, 500);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "unauthorized", detail: "Faça login no painel." }, 401);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: quem, error: quemErr } = await sb.auth.getUser(jwt);
  if (quemErr || !quem?.user) return json({ error: "unauthorized", detail: "Faça login no painel." }, 401);
  const { data: ehAdmin } = await sb.from("user_roles").select("role").eq("user_id", quem.user.id).eq("role", "admin").maybeSingle();
  if (!ehAdmin) return json({ error: "forbidden", detail: "Só administradores cadastram usuários." }, 403);

  let body: { email?: string; nome?: string; papel?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  const email = (body.email ?? "").trim().toLowerCase();
  const nome = (body.nome ?? "").trim().slice(0, 120);
  const papel = (body.papel ?? "") as (typeof PAPEIS)[number];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email_invalido", detail: "Informe um e-mail válido." }, 400);
  if (!nome) return json({ error: "nome_obrigatorio", detail: "Informe o nome." }, 400);
  if (!PAPEIS.includes(papel)) return json({ error: "papel_invalido", detail: "Papel deve ser admin, editor ou viewer." }, 400);

  // Já tem conta? Só dá o papel.
  const { data: existente } = await sb.rpc("equipe_id_por_email", { p_email: email });
  let userId = (existente as string | null) ?? null;
  let senha: string | null = null;

  if (!userId) {
    senha = gerarSenhaTemporaria();
    const { data: novo, error: createErr } = await sb.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, tipo: "equipe" },
    });
    if (createErr || !novo?.user) return json({ error: "create_user_failed", detail: createErr?.message ?? "erro desconhecido" }, 400);
    userId = novo.user.id;
  } else if (userId === quem.user.id) {
    return json({ error: "proprio_usuario", detail: "Você não pode alterar o próprio papel." }, 400);
  }

  await sb.from("user_roles").delete().eq("user_id", userId).in("role", ["admin", "editor", "reviewer", "viewer"]);
  const { error: roleErr } = await sb.from("user_roles").insert({ user_id: userId, role: papel });
  if (roleErr) {
    if (senha) await sb.auth.admin.deleteUser(userId);
    return json({ error: "papel_falhou", detail: roleErr.message }, 500);
  }

  return json({
    ok: true,
    user_id: userId,
    nova_conta: !!senha,
    senha_temporaria: senha,
    link_acesso: "/admin/login",
    aviso: senha
      ? "Repasse a senha temporária por um canal seguro — ela aparece só agora. No primeiro acesso, a pessoa troca em Senha."
      : "A pessoa já tinha conta: o papel foi atualizado e ela entra com a senha que já usa.",
  });
});
