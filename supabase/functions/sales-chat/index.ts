// Vozes Paranaenses — sales-chat
// Chatbot de vendas: conversa com o visitante usando SOMENTE o catálogo de
// preços real do banco (nunca inventa valor). Pode discutir valores e
// pacotes livremente, mas NUNCA fecha a venda sozinho — toda negociação de
// empresa/agência é sempre encaminhada pro WhatsApp do time comercial.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

const WHATSAPP_COMERCIAL_DISPLAY = "(45) 99986-4213";

type Msg = { role: "user" | "assistant"; content: string };
type Payload = { sessao_id: string; mensagens: Msg[]; contexto?: { regiao_slug?: string; pagina?: string } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.sessao_id || !Array.isArray(body.mensagens) || !body.mensagens.length) {
    return json({ error: "missing_sessao_id_or_mensagens" }, 400);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const [espacos, abrangencia, periodicidade, combosAnuncio, publieditorial, combosMistos] = await Promise.all([
    sb.from("catalogo_espacos").select("slot, nome, preco_mensal_base").eq("ativo", true),
    sb.from("catalogo_abrangencia").select("abrangencia, multiplicador, descricao"),
    sb.from("catalogo_periodicidade").select("periodicidade, meses_equivalentes, ajuste, descricao"),
    sb.from("catalogo_combos_anuncio").select("nome, espacos_incluidos, preco_mensal").eq("ativo", true),
    sb.from("catalogo_publieditorial").select("nome, descricao, preco").eq("ativo", true),
    sb.from("catalogo_combos_mistos").select("nome, descricao, preco_mensal").eq("ativo", true),
  ]);

  const catalogoTexto = `
ESPAÇOS INDIVIDUAIS (preço mensal base, 1 região):
${(espacos.data ?? []).map((e) => `- ${e.nome}: R$ ${e.preco_mensal_base}/mês`).join("\n")}

MULTIPLICADOR POR ABRANGÊNCIA:
${(abrangencia.data ?? []).map((a) => `- ${a.abrangencia}: ${a.multiplicador}x — ${a.descricao ?? ""}`).join("\n")}

MULTIPLICADOR POR PERIODICIDADE:
${(periodicidade.data ?? []).map((p) => `- ${p.periodicidade}: ${p.meses_equivalentes} meses × ${p.ajuste} — ${p.descricao ?? ""}`).join("\n")}

COMBOS DE ANÚNCIO (preço fechado mensal, por região):
${(combosAnuncio.data ?? []).map((c) => `- ${c.nome} (${c.espacos_incluidos}): R$ ${c.preco_mensal}/mês`).join("\n")}

PUBLIEDITORIAL (ciclo de 30 dias):
${(publieditorial.data ?? []).map((p) => `- ${p.nome} (${p.descricao}): R$ ${p.preco}`).join("\n")}

COMBOS MISTOS (anúncio + publieditorial, mensal):
${(combosMistos.data ?? []).map((c) => `- ${c.nome} (${c.descricao}): R$ ${c.preco_mensal}/mês`).join("\n")}
`.trim();

  const systemPrompt = `Você é o assistente de vendas do Vozes Paranaenses, um portal de notícias regional do Paraná.

PRODUTO À PARTE — Vitrine Pessoal (R$ 199, avulso): matéria sobre a trajetória de UM profissional
liberal (não empresa). Se o visitante for claramente um profissional liberal falando de si mesmo
(não uma empresa/marca), direcione pro chat próprio desse produto:
"https://vozesparanaenses.com.br/vitrine-pessoal/novo" — lá ele mesmo fecha e gera a matéria, sem
precisar do time comercial.

CATÁLOGO REAL DE PREÇOS — use SOMENTE estes valores, nunca invente ou calcule fora daqui:
${catalogoTexto}

ESTRATÉGIA DE VENDA (escada A/B/C) — use isso pra CONVERSAR sobre valor, nunca pra fechar sozinho:
- Plano A (apresente sempre primeiro): combo misto "Presença Completa".
- Plano B (se o cliente hesitar): "Combo Básico" (só anúncio) ou "Publieditorial avulso" (só conteúdo).
- Plano C (sempre tenha isso como alternativa de entrada): 1 espaço avulso, periodicidade quinzenal.
- Nunca desconte o preço de um plano — troque de produto ou periodicidade, nunca o valor unitário.

REGRA MAIS IMPORTANTE — LEIA COM ATENÇÃO:
Sempre que o visitante for uma AGÊNCIA ou um EMPRESÁRIO/EMPRESA querendo divulgar um negócio (ou
seja, qualquer cliente que não seja o profissional liberal da Vitrine Pessoal), você PODE e DEVE
conversar sobre valores, planos e pacotes com liberdade, usando a escada A/B/C — mas NUNCA finalize
a venda você mesmo, nunca colete pagamento, nunca crie pedido nenhum. Assim que o cliente demonstrar
interesse real em fechar (perguntar "como eu contrato", "vamos fechar", "pode confirmar" ou
similar), encerre a conversa dessa forma:
1. Resuma em 1 frase o que foi combinado (produto e valor discutidos).
2. Diga que o time comercial finaliza tudo por lá.
3. Sempre informe o WhatsApp: ${WHATSAPP_COMERCIAL_DISPLAY}.
Nessas respostas de fechamento, defina "mostrar_whatsapp": true.

REGRAS DE CONVERSA:
1. Seja consultivo, não insistente — explore o que o negócio do cliente precisa antes de recomendar.
2. Respostas curtas e diretas, em português do Brasil.
3. Nunca prometa prazo, desconto ou condição que não esteja no catálogo acima.

Responda SEMPRE em JSON válido, neste schema exato:
{
  "resposta": "texto da sua resposta pro visitante",
  "mostrar_whatsapp": boolean
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...body.mensagens.map((m) => ({ role: m.role, content: m.content })),
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

  let parsed: { resposta: string; mostrar_whatsapp?: boolean };
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  return json({
    resposta: parsed.resposta,
    mostrar_whatsapp: parsed.mostrar_whatsapp ?? false,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
