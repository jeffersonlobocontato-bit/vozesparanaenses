// Vozes Paranaenses — vitrine-pessoal-chat
// Agente IA que entrevista o profissional liberal pelo chat público
// /vitrine-pessoal/novo. Faz uma pergunta por vez, aprofunda quando a
// resposta é rasa, e, quando tem material suficiente, finaliza o pedido
// e dispara a geração — mesmo caminho que o formulário antigo usava.
//
// Diferente do Publieditorial (que já nasce com uma campanha vinculada
// pelo admin), aqui o PRÓPRIO CHAT cria o pedido, já na primeira
// mensagem — não existe "casca" criada antes.
//
// Body:
//   { token?: string, mensagem?: string, init?: true }
//   (sem token na primeiríssima chamada — a função cria e devolve um)
// Resposta:
//   { mensagem: string, finalizado: boolean, token: string, aviso?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Msg = { role: "user" | "assistant" | "system"; content: string };

type Campos = {
  nome_cliente: string;
  contato: string;
  profissao: string;
  regiao_nome: string;
  briefing_texto: string;
};

const SYSTEM_PROMPT = `Você é um redator do jornal Vozes Paranaenses conduzindo uma ENTREVISTA por chat com um profissional liberal (pessoa física — advogado, personal trainer, arquiteta, consultor, etc.) que quer uma matéria sobre sua trajetória e trabalho, publicada no portal (produto "Vitrine Pessoal"). Fale sempre em português do Brasil, tom cordial, caloroso e pessoal — como alguém genuinamente interessado na história da pessoa, não um vendedor.

REGRAS DE CONDUÇÃO
1. Faça UMA pergunta por vez. Nada de listas de perguntas.
2. Se a resposta vier muito curta ou vaga, peça exemplo concreto, caso real, tempo de atuação — antes de passar pro próximo assunto.
3. Nunca invente dado. Se a pessoa não tiver algo pra contar, siga em frente sem inventar.
4. Se ficar claro que é sobre uma EMPRESA (não uma pessoa falando de si mesma), avise gentilmente que a Vitrine Pessoal é só pra profissional liberal, e sugira que ela fale com o comercial pelo chat de anúncios pra ver pacotes de empresa — e encerre a conversa (finalizado: true, sem campos).
5. Não prometa data de publicação nem valor — isso não é com você (é R$ 199, mas quem trata pagamento é a própria plataforma depois).

CHECKLIST QUE VOCÊ PRECISA COBRIR (nesta ordem lógica, mas se a pessoa antecipar algo já use):
A. nome_cliente — nome da pessoa
B. contato — telefone ou e-mail pra contato
C. profissao — profissão/área de atuação
D. regiao_nome — em qual região do Paraná ela atua (aceite o nome como a pessoa disser; ex.: "Curitiba", "Cascavel", "Oeste")
E. briefing_texto — a trajetória: o que faz, há quanto tempo, diferenciais, algo marcante que queira destacar (esse é o campo mais rico — vale aprofundar bastante aqui, com 2-3 perguntas de acompanhamento se a resposta inicial for curta)

FORMATO DE RESPOSTA (obrigatório, JSON puro, sem markdown, sem comentário):
{
  "mensagem": "sua próxima fala pra pessoa (uma pergunta OU a mensagem final de encerramento)",
  "finalizado": false,
  "campos": null
}

Quando (e SÓ quando) você já tem material suficiente — todos os itens A-E cobertos com resposta útil — responda com:
{
  "mensagem": "mensagem curta e calorosa agradecendo e avisando que o rascunho já entrou em produção",
  "finalizado": true,
  "campos": {
    "nome_cliente": "…",
    "contato": "…",
    "profissao": "…",
    "regiao_nome": "…",
    "briefing_texto": "…"
  }
}

No campo briefing_texto, escreva em PROSA (não bullets), preservando os fatos que a pessoa deu, sem enfeitar nem inventar — esse texto vira a base pro redator escrever a matéria.

Se ainda é a primeira mensagem da conversa (sem histórico do usuário), se apresente em 1-2 frases e faça a primeira pergunta (item A).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { token?: string; mensagem?: string; init?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Sem token: primeira chamada de verdade — cria o pedido já em modo
  // "entrevistando" e devolve o token novo pro front guardar.
  let pedidoId: string;
  let token: string;
  if (!body.token) {
    const { data: novo, error: cErr } = await sb
      .from("vitrine_pessoal_pedidos")
      .insert({ status: "entrevistando", sobre_pessoa_ou_empresa: "pessoa" })
      .select("id, token")
      .single();
    if (cErr || !novo) return json({ error: "pedido_create_failed", detail: cErr?.message }, 500);
    pedidoId = novo.id;
    token = novo.token;
  } else {
    const { data: pedido, error: bErr } = await sb
      .from("vitrine_pessoal_pedidos")
      .select("id, status, token")
      .eq("token", body.token)
      .maybeSingle();
    if (bErr || !pedido) return json({ error: "token_invalido" }, 404);
    if (pedido.status !== "entrevistando") {
      return json({ error: "entrevista_ja_concluida", status_atual: pedido.status }, 409);
    }
    pedidoId = pedido.id;
    token = pedido.token;
  }

  // Carrega histórico
  const { data: histRows } = await sb
    .from("vitrine_pessoal_chat_messages")
    .select("role, content")
    .eq("pedido_id", pedidoId)
    .order("criado_em", { ascending: true });
  const historico: Msg[] = (histRows ?? []).filter((m) => m.role === "user" || m.role === "assistant") as Msg[];

  const userMsg = (body.mensagem ?? "").trim();
  if (userMsg) {
    await sb.from("vitrine_pessoal_chat_messages").insert({ pedido_id: pedidoId, role: "user", content: userMsg });
    historico.push({ role: "user", content: userMsg });
  } else if (!body.init) {
    return json({ error: "missing_mensagem" }, 400);
  }

  // Se é init e já tem histórico, devolve o último assistant sem chamar LLM
  if (body.init && historico.length > 0) {
    const ultimoAssistant = [...historico].reverse().find((m) => m.role === "assistant");
    if (ultimoAssistant) return json({ mensagem: ultimoAssistant.content, finalizado: false, token });
  }

  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico,
  ];

  const aiRes = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });

  if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
  if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
  if (!aiRes.ok) {
    const t = await aiRes.text();
    return json({ error: "ai_gateway_error", status: aiRes.status, detail: t.slice(0, 500) }, 502);
  }

  const aiJson = await aiRes.json();
  const content = aiJson?.choices?.[0]?.message?.content;
  if (!content) return json({ error: "ai_empty_response" }, 502);

  let parsed: { mensagem?: string; finalizado?: boolean; campos?: Campos | null };
  try { parsed = JSON.parse(content); } catch { return json({ error: "ai_invalid_json", raw: String(content).slice(0, 500) }, 502); }

  const respostaAgente = (parsed.mensagem ?? "").trim();
  if (!respostaAgente) return json({ error: "ai_missing_mensagem" }, 502);

  await sb.from("vitrine_pessoal_chat_messages").insert({ pedido_id: pedidoId, role: "assistant", content: respostaAgente });

  let aviso: string | undefined;
  const finalizado = parsed.finalizado === true && parsed.campos && parsed.campos.nome_cliente && parsed.campos.briefing_texto;
  if (finalizado && parsed.campos) {
    const c = parsed.campos;

    // Resolve o nome da região dita em texto livre pra um regiao_id real
    const { data: regioes } = await sb.from("regioes").select("id, nome, slug").eq("ativa", true);
    const alvo = (c.regiao_nome ?? "").toLowerCase();
    const regiaoEncontrada = (regioes ?? []).find(
      (r) => alvo.includes(r.nome.toLowerCase()) || alvo.includes(r.slug.toLowerCase()) || r.nome.toLowerCase().includes(alvo),
    );

    if (!regiaoEncontrada) {
      // Não travou a conversa por falta de região — devolve a mensagem,
      // mas não finaliza de verdade (evita gerar sem região válida).
      return json({ mensagem: respostaAgente + "\n\n(Só preciso confirmar: qual das nossas 10 regiões do Paraná é essa?)", finalizado: false, token });
    }

    const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
    const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;
    try {
      const genRes = await fetch(`${selfUrl}/functions/v1/vitrine-pessoal-criar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
        body: JSON.stringify({
          pedido_id: pedidoId,
          nome_cliente: c.nome_cliente,
          contato: c.contato,
          profissao: c.profissao,
          sobre_pessoa_ou_empresa: "pessoa",
          regiao_id: regiaoEncontrada.id,
          briefing_texto: c.briefing_texto,
        }),
      });
      if (!genRes.ok) {
        const t = await genRes.text();
        await sb.from("vitrine_pessoal_pedidos").update({ status: "erro" }).eq("id", pedidoId);
        aviso = "Respostas salvas, mas a geração automática falhou — nossa equipe vai gerar manualmente.";
        console.error("vitrine-pessoal-criar falhou", t);
      }
    } catch (e) {
      aviso = "Respostas salvas, mas a geração automática falhou — nossa equipe vai gerar manualmente.";
      console.error("erro ao chamar vitrine-pessoal-criar", (e as Error).message);
    }
  }

  return json({ mensagem: respostaAgente, finalizado: Boolean(finalizado), token, aviso });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
