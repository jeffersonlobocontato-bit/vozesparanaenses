// Vozes Paranaenses — imprensa-gerar-rascunho
// Recebe o conteúdo bruto (release colado ou respostas do cliente),
// detecta sozinho a editoria mais provável, e gera o rascunho usando o
// DNA do agente redator daquela editoria — o mesmo motor que já usamos
// pro pipeline automático e pro Publieditorial.
//
// Exige login de cliente válido (JWT), não token público — diferente do
// Publieditorial/Vitrine Pessoal.
//
// Body: { texto_bruto: string, submissao_id?: string }
// Resposta: { ok, submissao_id, categoria_detectada, titulo, subtitulo, corpo }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !serviceKey) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: cliente } = await sb
    .from("clientes_imprensa")
    .select("id, ativo, nome_empresa")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!cliente || !cliente.ativo) return json({ error: "cliente_sem_acesso" }, 403);

  let body: { texto_bruto?: string; submissao_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.texto_bruto?.trim() || body.texto_bruto.trim().length < 40) {
    return json({ error: "texto_insuficiente", detail: "Cole o release ou responda com mais detalhe antes de gerar o rascunho." }, 400);
  }

  // 1. Lista as 13 editorias pra IA escolher.
  const { data: categorias } = await sb.from("editorial_categories").select("id, slug, nome");
  if (!categorias?.length) return json({ error: "sem_categorias_cadastradas" }, 500);

  const listaCategorias = categorias.map((c) => `${c.slug} — ${c.nome}`).join("\n");
  const classResp = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Classifique o conteúdo abaixo em UMA das editorias desta lista (responda só o slug, em JSON):\n${listaCategorias}\n\nResponda: {"slug": "..."}` },
        { role: "user", content: body.texto_bruto },
      ],
    }),
  });
  if (!classResp.ok) return json({ error: "classificacao_falhou", detail: await classResp.text() }, 502);
  const classData = await classResp.json();
  let categoriaSlug: string;
  try {
    categoriaSlug = JSON.parse(classData.choices[0].message.content).slug;
  } catch {
    return json({ error: "classificacao_invalida" }, 502);
  }
  const categoria = categorias.find((c) => c.slug === categoriaSlug) ?? categorias[0];

  // 2. Carrega o DNA do agente redator dessa editoria.
  const { data: agente } = await sb
    .from("agentes_redatores")
    .select("nome, instrucoes_base, dna_sintatico, dna_semantico, dna_lexical, matriz_editorial")
    .eq("categoria_id", categoria.id)
    .maybeSingle();

  const dnaTexto = agente
    ? `DNA sintático: ${JSON.stringify(agente.dna_sintatico)}\nDNA semântico: ${JSON.stringify(agente.dna_semantico)}\nDNA lexical: ${JSON.stringify(agente.dna_lexical)}\nMatriz editorial: ${JSON.stringify(agente.matriz_editorial)}\nInstruções: ${agente.instrucoes_base ?? ""}`
    : "";

  // 3. Gera o rascunho seguindo o DNA da editoria.
  const draftResp = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é o redator de conteúdo institucional/publieditorial do Vozes Paranaenses, editoria "${categoria.nome}". Reescreva o conteúdo enviado pelo cliente (${cliente.nome_empresa}) seguindo o padrão editorial abaixo — sem inventar fato que não esteja no material original, sem elogio vazio, mantendo tom jornalístico mesmo sendo conteúdo institucional.\n\n${dnaTexto}\n\nResponda em JSON: {"titulo": "...", "subtitulo": "...", "corpo": "..."} — corpo em parágrafos separados por \\n\\n.`,
        },
        { role: "user", content: body.texto_bruto },
      ],
    }),
  });
  if (!draftResp.ok) return json({ error: "geracao_falhou", detail: await draftResp.text() }, 502);
  const draftData = await draftResp.json();
  let draft: { titulo: string; subtitulo: string; corpo: string };
  try {
    draft = JSON.parse(draftData.choices[0].message.content);
  } catch {
    return json({ error: "geracao_invalida" }, 502);
  }

  // 4. Salva/atualiza a submissão.
  const payload = {
    cliente_id: cliente.id,
    conteudo_bruto: body.texto_bruto,
    categoria_detectada_id: categoria.id,
    titulo_gerado: draft.titulo,
    subtitulo_gerado: draft.subtitulo,
    corpo_gerado: draft.corpo,
    atualizado_em: new Date().toISOString(),
  };

  let submissaoId = body.submissao_id;
  if (submissaoId) {
    await sb.from("imprensa_submissoes").update(payload).eq("id", submissaoId).eq("cliente_id", cliente.id);
  } else {
    const { data: nova } = await sb.from("imprensa_submissoes").insert(payload).select("id").single();
    submissaoId = nova?.id;
  }

  return json({
    ok: true,
    submissao_id: submissaoId,
    categoria_detectada: { slug: categoria.slug, nome: categoria.nome },
    titulo: draft.titulo,
    subtitulo: draft.subtitulo,
    corpo: draft.corpo,
  });
});
