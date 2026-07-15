// Vozes Paranaenses — publieditorial-chat
// Agente IA que entrevista o cliente pelo link público /publieditorial/:token.
// Faz uma pergunta por vez, aprofunda quando a resposta é rasa, e, quando tem
// material suficiente pros 6 blocos + CTA, "finaliza" o briefing (preenche as
// colunas de publieditorial_briefings e dispara generate-publieditorial —
// mesmo caminho que o formulário antigo usava).
//
// Body:
//   { token, mensagem?: string, init?: true }
// Resposta:
//   { mensagem: string, finalizado: boolean, aviso?: string }

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
  nome_anunciante: string;
  o_que_faz: string;
  contexto_mercado: string;
  diferenciais: string;
  evidencias: string;
  impacto_leitor: string;
  cta_texto: string;
  link_destino?: string | null;
};

const SYSTEM_PROMPT = `Você é um redator do jornal Vozes Paranaenses conduzindo uma ENTREVISTA por chat com um anunciante que vai virar matéria publieditorial. Fale sempre em português do Brasil, tom cordial e direto, como um jornalista de bairro que quer entender o negócio da pessoa.

REGRAS DE CONDUÇÃO
1. Faça UMA pergunta por vez. Nada de listas de perguntas.
2. Se a resposta vier muito curta ou vaga ("somos os melhores", "atendemos bem"), peça exemplo concreto, número, nome, data, caso real — antes de passar pro próximo assunto.
3. Nunca invente dado. Se o cliente disser que não tem número/prova, siga em frente sem inventar.
4. Não use jargão publicitário. Escreva como quem conversa no WhatsApp.
5. Não prometa data de publicação, valor, nem canal de divulgação — isso não é com você.

CHECKLIST QUE VOCÊ PRECISA COBRIR (nesta ordem lógica, mas se o cliente antecipar algo já use):
A. nome_anunciante — nome da empresa/marca/profissional
B. o_que_faz — o que a empresa faz e há quanto tempo
C. contexto_mercado — cenário do mercado dela e por que divulgar isso agora
D. diferenciais — 2 a 4 diferenciais reais frente à concorrência
E. evidencias — dado concreto (nº de clientes, anos, prêmio, certificação, case)
F. impacto_leitor — principal benefício prático pro leitor que procurar
G. cta_texto — o que ela quer que o leitor faça depois de ler (agendar, visitar, ligar, seguir)
H. link_destino (opcional) — site, WhatsApp, endereço ou telefone pra fechamento

FORMATO DE RESPOSTA (obrigatório, JSON puro, sem markdown, sem comentário):
{
  "mensagem": "sua próxima fala pro cliente (uma pergunta OU a mensagem final de encerramento)",
  "finalizado": false,
  "campos": null
}

Quando (e SÓ quando) você já tem material suficiente pra escrever a matéria — todos os itens A–G cobertos com resposta útil (H é opcional) — responda com:
{
  "mensagem": "mensagem curta agradecendo e avisando que o rascunho já entrou em produção",
  "finalizado": true,
  "campos": {
    "nome_anunciante": "…",
    "o_que_faz": "…",
    "contexto_mercado": "…",
    "diferenciais": "…",
    "evidencias": "…",
    "impacto_leitor": "…",
    "cta_texto": "…",
    "link_destino": "… ou string vazia se não tiver"
  }
}

Nos campos consolidados, escreva em PROSA (não bullets), preservando os fatos que o cliente deu, sem enfeitar nem inventar. Se o cliente não deu link_destino, deixe string vazia.

Se ainda é a primeira mensagem da conversa (sem histórico do usuário), se apresente em 1–2 frases e faça a primeira pergunta (item A).`;

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
  if (!body.token) return json({ error: "missing_token" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: briefing, error: bErr } = await sb
    .from("publieditorial_briefings")
    .select("id, status, nome_anunciante")
    .eq("token", body.token)
    .maybeSingle();
  if (bErr || !briefing) return json({ error: "token_invalido" }, 404);
  if (briefing.status !== "aguardando_preenchimento") {
    return json({ error: "briefing_ja_preenchido", status_atual: briefing.status }, 409);
  }

  // Carrega histórico
  const { data: histRows } = await sb
    .from("publieditorial_chat_messages")
    .select("role, content")
    .eq("briefing_id", briefing.id)
    .order("criado_em", { ascending: true });
  const historico: Msg[] = (histRows ?? []).filter((m) => m.role === "user" || m.role === "assistant") as Msg[];

  // Se veio mensagem do usuário, grava
  const userMsg = (body.mensagem ?? "").trim();
  if (userMsg) {
    await sb.from("publieditorial_chat_messages").insert({ briefing_id: briefing.id, role: "user", content: userMsg });
    historico.push({ role: "user", content: userMsg });
  } else if (!body.init) {
    return json({ error: "missing_mensagem" }, 400);
  }

  // Se é init e já tem histórico, devolve o último assistant sem chamar LLM
  if (body.init && historico.length > 0) {
    const ultimoAssistant = [...historico].reverse().find((m) => m.role === "assistant");
    if (ultimoAssistant) return json({ mensagem: ultimoAssistant.content, finalizado: false });
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

  await sb.from("publieditorial_chat_messages").insert({ briefing_id: briefing.id, role: "assistant", content: respostaAgente });

  // Se finalizou, preenche briefing + dispara geração
  let aviso: string | undefined;
  const finalizado = parsed.finalizado === true && parsed.campos && parsed.campos.o_que_faz && parsed.campos.nome_anunciante;
  if (finalizado && parsed.campos) {
    const c = parsed.campos;
    const { error: uErr } = await sb
      .from("publieditorial_briefings")
      .update({
        nome_anunciante: c.nome_anunciante,
        o_que_faz: c.o_que_faz,
        contexto_mercado: c.contexto_mercado,
        diferenciais: c.diferenciais,
        evidencias: c.evidencias,
        impacto_leitor: c.impacto_leitor,
        cta_texto: c.cta_texto,
        link_destino: c.link_destino && c.link_destino.trim() ? c.link_destino.trim() : null,
        status: "preenchido",
        preenchido_em: new Date().toISOString(),
      })
      .eq("id", briefing.id);
    if (uErr) {
      aviso = "Suas respostas foram salvas, mas houve um erro ao encaminhar pra redação. Nossa equipe vai processar manualmente.";
    } else {
      // Dispara geração — edge functions rodam no Lovable Cloud, não no externo
      const selfUrl = Deno.env.get("SUPABASE_URL") ?? url;
      const selfKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? key;
      try {
        const genRes = await fetch(`${selfUrl}/functions/v1/generate-publieditorial`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${selfKey}` },
          body: JSON.stringify({ briefing_id: briefing.id }),
        });
        if (!genRes.ok) {
          const t = await genRes.text();
          await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: t.slice(0, 500) }).eq("id", briefing.id);
          aviso = "Respostas salvas, mas a geração automática falhou — nossa equipe vai gerar manualmente.";
        }
      } catch (e) {
        await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: (e as Error).message }).eq("id", briefing.id);
        aviso = "Respostas salvas, mas a geração automática falhou — nossa equipe vai gerar manualmente.";
      }
    }
  }

  return json({ mensagem: respostaAgente, finalizado: Boolean(finalizado), aviso });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}