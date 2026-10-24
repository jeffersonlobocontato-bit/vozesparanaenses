// Vozes Paranaenses — imprensa-cadastro
// Autocadastro do responsável pela comunicação de uma prefeitura no Portal
// da Imprensa. Pública (sem login): cria a conta com a senha escolhida pela
// pessoa e o cadastro como 'pendente' — só publica depois que a equipe
// aprovar em /admin/imprensa-clientes.
//
// Anti-spam: limite por hash de IP em form_rate_limit (nunca IP cru).
//
// Body: { cidade_slug, nome_completo, cpf, funcao, email, senha,
//         lgpd_aceito: true, termo_aceito: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { cpfValido, FUNCOES, NOTA_LGPD, TERMO_CADASTRO } from "../_shared/imprensa-termos.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "content-type": "application/json" } });
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "missing_external_supabase_env" }, 500);
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: {
    cidade_slug?: string; nome_completo?: string; cpf?: string; funcao?: string;
    email?: string; senha?: string; lgpd_aceito?: boolean; termo_aceito?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "imprensa-cadastro-salt"));
    const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const desde = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await sb
      .from("form_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", "imprensa-cadastro")
      .eq("ip_hash", ipHash)
      .gte("criado_em", desde);
    if ((count ?? 0) >= 5) {
      return json({ error: "rate_limited", detail: "Muitas tentativas de cadastro. Tente novamente em uma hora." }, 429);
    }
    await sb.from("form_rate_limit").insert({ ip_hash: ipHash, endpoint: "imprensa-cadastro" });
  }

  const nome = (body.nome_completo ?? "").trim().replace(/\s+/g, " ");
  const cpf = (body.cpf ?? "").replace(/\D/g, "");
  const funcao = (body.funcao ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";

  if (!body.lgpd_aceito || !body.termo_aceito) {
    return json({ error: "termos_nao_aceitos", detail: "É preciso aceitar a nota de privacidade (LGPD) e o termo de responsabilidade." }, 400);
  }
  if (nome.split(" ").length < 2 || nome.length < 5) return json({ error: "nome_invalido", detail: "Informe o nome completo." }, 400);
  if (!cpfValido(cpf)) return json({ error: "cpf_invalido", detail: "CPF inválido. Confira os números." }, 400);
  if (funcao.length < 3 || funcao.length > 80) return json({ error: "funcao_invalida", detail: "Informe a sua função." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_invalido", detail: "E-mail inválido." }, 400);
  if (senha.length < 8) return json({ error: "senha_fraca", detail: "A senha precisa ter pelo menos 8 caracteres." }, 400);

  const { data: cidade } = await sb.from("cidades").select("id, nome, slug").eq("slug", body.cidade_slug ?? "").maybeSingle();
  if (!cidade) return json({ error: "prefeitura_invalida", detail: "Escolha a prefeitura na lista." }, 400);

  const { data: jaExiste } = await sb.from("clientes_imprensa")
    .select("id").eq("cpf", cpf).eq("cidade_id", cidade.id).maybeSingle();
  if (jaExiste) {
    return json({ error: "cadastro_ja_existe", detail: "Já existe um cadastro com este CPF para esta prefeitura. Entre com o seu e-mail e senha." }, 409);
  }

  const { data: novo, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome_contato: nome, origem: "imprensa-autocadastro" },
  });
  if (createErr || !novo?.user) {
    const msg = createErr?.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      return json({ error: "email_ja_cadastrado", detail: "Este e-mail já tem uma conta. Entre com ele ou use outro e-mail." }, 409);
    }
    return json({ error: "create_user_failed", detail: msg || "erro desconhecido" }, 400);
  }

  // Slug interno do cliente (único): prefeitura + sufixo curto.
  const slug = `${slugify(cidade.slug)}-${crypto.randomUUID().slice(0, 6)}`;
  const agora = new Date().toISOString();
  const { error: insErr } = await sb.from("clientes_imprensa").insert({
    user_id: novo.user.id,
    nome_empresa: `Prefeitura de ${cidade.nome}`,
    nome_contato: nome,
    email,
    slug,
    ativo: true,
    status: "pendente",
    origem: "autocadastro",
    cidade_id: cidade.id,
    cpf,
    funcao: FUNCOES.includes(funcao as typeof FUNCOES[number]) ? funcao : `Outra: ${funcao}`,
    lgpd_aceite_em: agora,
    lgpd_aceite_texto: NOTA_LGPD,
    termo_cadastro_aceite_em: agora,
    termo_cadastro_texto: TERMO_CADASTRO,
  });
  if (insErr) {
    // Sem o cadastro, a conta solta não serve para nada: desfaz.
    await sb.auth.admin.deleteUser(novo.user.id);
    return json({ error: "insert_cliente_failed", detail: insErr.message }, 500);
  }

  return json({ ok: true, status: "pendente" });
});
