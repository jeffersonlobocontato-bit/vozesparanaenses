// Vozes Paranaenses — sales-chat
// Chatbot de vendas: conversa com o visitante usando SOMENTE o catálogo de
// preços real do banco (nunca inventa valor). Pagamento é MANUAL por
// enquanto (Pix) — quando o Mercado Pago for configurado, o mesmo pedido
// passa a ser confirmado por webhook em vez de clique do admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

// TODO: trocar pela chave Pix real da conta que vai receber.
const PIX_CHAVE = "financeiro@vozesparanaenses.com.br";
const PIX_TITULAR = "Vozes Paranaenses (titular a confirmar)";

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
(não uma empresa/marca), NÃO tente vender os pacotes comerciais abaixo — diga que existe esse
produto específico e mais barato pra esse caso, e direcione pro formulário:
"https://vozesparanaenses.com.br/vitrine-pessoal/novo". Não crie "pedido" pra esse produto.

CATÁLOGO REAL DE PREÇOS — use SOMENTE estes valores, nunca invente ou calcule fora daqui:
${catalogoTexto}

ESTRATÉGIA DE VENDA (escada A/B/C):
- Plano A (abra sempre com isso primeiro): combo misto "Presença Completa".
- Plano B (se hesitar): "Combo Básico" (só anúncio) ou "Publieditorial avulso" (só conteúdo).
- Plano C (nunca deixe a conversa terminar sem oferecer): 1 espaço avulso, periodicidade quinzenal.
- Nunca desconte o preço de um plano — troque de produto ou periodicidade, nunca o valor unitário.

PAGAMENTO — hoje é manual, via Pix:
- Chave Pix: ${PIX_CHAVE} (titular: ${PIX_TITULAR})
- Depois de criar o pedido, sempre informe essa chave e explique: "assim que recebermos a confirmação
  do pagamento, seu anúncio entra no ar em até 12 horas".

REGRAS DE CONVERSA:
1. Seja consultivo, não insistente.
2. Se o visitante mencionar que é agência ou quer contratar "pela agência" — defina
   "mostrar_whatsapp": true, não tente fechar você mesmo.
3. Se quiser fechar diretamente, colete nome e contato ANTES de criar o pedido. Só preencha "pedido"
   quando já tiver produto, valor exato do catálogo, nome e contato.
4. Respostas curtas e diretas, em português do Brasil.

Responda SEMPRE em JSON válido, neste schema exato:
{
  "resposta": "texto da sua resposta pro visitante",
  "mostrar_whatsapp": boolean,
  "pedido": null ou {
    "tipo_produto": "espaco_individual" | "combo_anuncio" | "publieditorial" | "combo_misto",
    "descricao_produto": "nome do produto escolhido, como está no catálogo",
    "regiao_slug": "slug da região (se souber) ou null",
    "abrangencia": "cidade" | "regiao" | "estado" | null,
    "periodicidade": "semanal" | "quinzenal" | "mensal" | "semestral" | "anual" | null,
    "valor_total": número exato calculado a partir do catálogo,
    "nome_cliente": "nome informado",
    "contato": "telefone ou e-mail informado"
  }
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

  let parsed: {
    resposta: string; mostrar_whatsapp?: boolean;
    pedido?: {
      tipo_produto: string; descricao_produto: string; regiao_slug?: string | null;
      abrangencia?: string | null; periodicidade?: string | null;
      valor_total: number; nome_cliente: string; contato: string;
    } | null;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "ai_invalid_json", raw: content.slice(0, 500) }, 502);
  }

  let pedidoCriado: { id: string } | null = null;
  if (parsed.pedido && parsed.pedido.nome_cliente && parsed.pedido.contato && parsed.pedido.valor_total > 0) {
    const { data: inserted, error: insErr } = await sb
      .from("pedidos_chatbot")
      .insert({
        sessao_id: body.sessao_id,
        tipo_produto: parsed.pedido.tipo_produto,
        descricao_produto: parsed.pedido.descricao_produto,
        regiao_slug: parsed.pedido.regiao_slug ?? null,
        abrangencia: parsed.pedido.abrangencia ?? null,
        periodicidade: parsed.pedido.periodicidade ?? null,
        valor_total: parsed.pedido.valor_total,
        nome_cliente: parsed.pedido.nome_cliente,
        contato: parsed.pedido.contato,
        origem: "direto",
        metodo_pagamento: "pix_manual",
      })
      .select("id")
      .single();
    if (!insErr) pedidoCriado = inserted;
  }

  return json({
    resposta: parsed.resposta,
    mostrar_whatsapp: parsed.mostrar_whatsapp ?? false,
    pedido_criado: pedidoCriado,
    pix: pedidoCriado ? { chave: PIX_CHAVE, titular: PIX_TITULAR } : null,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
