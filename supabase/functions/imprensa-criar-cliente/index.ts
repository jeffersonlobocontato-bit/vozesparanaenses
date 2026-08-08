// Vozes Paranaenses — imprensa-criar-cliente
// Cria o acesso de um novo cliente do "Portal da Imprensa": um usuário de
// autenticação de verdade (login com senha, diferente do link por token
// do Publieditorial/Vitrine Pessoal) + o registro em clientes_imprensa
// com o slug exclusivo.
//
// Só quem tem papel admin/editor pode chamar — cria conta de autenticação
// de outra pessoa, então exige a mesma checagem de segurança que
// qualquer função administrativa sensível do projeto.
//
// Body: { nome_empresa, nome_contato, email, slug, categoria_padrao_id? }
// Resposta: { ok: true, cliente: {...}, senha_temporaria }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => alfabeto[b % alfabeto.length]).join("");
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing_external_supabase_env" }, 500);

  // Correção de segurança: sem checar isso, qualquer pessoa com a URL da
  // função (a chave anon é pública por natureza) poderia criar contas de
  // autenticação arbitrárias, já que a função usa a service role pra
  // criar usuário. Exige token de um usuário autenticado com papel
  // admin/editor antes de fazer qualquer coisa com privilégio elevado.
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const sbAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: temPapel } = await sbAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", ["admin", "editor"])
    .maybeSingle();
  if (!temPapel) return json({ error: "forbidden", detail: "Exige papel admin ou editor." }, 403);

  let body: { nome_empresa?: string; nome_contato?: string; email?: string; slug?: string; categoria_padrao_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  if (!body.nome_empresa?.trim() || !body.nome_contato?.trim() || !body.email?.trim()) {
    return json({ error: "campos_obrigatorios_faltando", detail: "nome_empresa, nome_contato e email são obrigatórios." }, 400);
  }

  const slugFinal = slugify(body.slug?.trim() || body.nome_empresa);
  if (!slugFinal) return json({ error: "slug_invalido" }, 400);

  const { data: slugExistente } = await sbAdmin
    .from("clientes_imprensa")
    .select("id")
    .eq("slug", slugFinal)
    .maybeSingle();
  if (slugExistente) return json({ error: "slug_ja_existe", detail: `O slug "${slugFinal}" já está em uso.` }, 409);

  const senhaTemporaria = gerarSenhaTemporaria();

  const { data: novoUsuario, error: createErr } = await sbAdmin.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { tipo: "cliente_imprensa", nome_empresa: body.nome_empresa.trim() },
  });
  if (createErr || !novoUsuario?.user) {
    return json({ error: "create_user_failed", detail: createErr?.message ?? "erro desconhecido" }, 400);
  }

  const { data: cliente, error: insertErr } = await sbAdmin
    .from("clientes_imprensa")
    .insert({
      user_id: novoUsuario.user.id,
      nome_empresa: body.nome_empresa.trim(),
      nome_contato: body.nome_contato.trim(),
      email: body.email.trim().toLowerCase(),
      slug: slugFinal,
      categoria_padrao_id: body.categoria_padrao_id ?? null,
      criado_por: userData.user.id,
    })
    .select("id, nome_empresa, nome_contato, email, slug, criado_em")
    .single();

  if (insertErr) {
    // Se o registro do cliente falhar, desfaz a criação do usuário de auth
    // pra não deixar login órfão sem acesso a nada.
    await sbAdmin.auth.admin.deleteUser(novoUsuario.user.id);
    return json({ error: "insert_cliente_failed", detail: insertErr.message }, 500);
  }

  return json({
    ok: true,
    cliente,
    senha_temporaria: senhaTemporaria,
    link_acesso: `/imprensa/entrar`,
    aviso: "Repasse a senha temporária ao cliente por um canal seguro — ela não fica salva em lugar nenhum, essa é a única vez que aparece.",
  });
});
