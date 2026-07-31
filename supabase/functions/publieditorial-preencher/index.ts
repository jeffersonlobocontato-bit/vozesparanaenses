// Vozes Paranaenses — publieditorial-preencher
// Recebe as respostas da entrevista estruturada do cliente (via token,
// sem login), salva, e dispara a geração com o generate-publieditorial.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  token: string;
  nome_anunciante: string;
  o_que_faz: string;
  contexto_mercado: string;
  diferenciais: string;
  evidencias: string;
  impacto_leitor: string;
  cta_texto: string;
  link_destino?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.token || !body.nome_anunciante || !body.o_que_faz) {
    return json({ error: "campos_obrigatorios_faltando" }, 400);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Correção de segurança: cada submissão aqui dispara geração de matéria
  // com IA — sem limite, alguém com um token válido (ou testando tokens)
  // podia gerar custo repetido. Limite por IP, generoso o bastante pra não
  // atrapalhar um preenchimento legítimo com tentativa de reenvio.
  {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const data = new TextEncoder().encode(ip + "pubpreench-salt");
    const digest = await crypto.subtle.digest("SHA-256", data);
    const ipHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const desde = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await sb
      .from("form_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("endpoint", "publieditorial-preencher")
      .eq("ip_hash", ipHash)
      .gte("criado_em", desde);
    if ((count ?? 0) >= 5) {
      return json({ error: "rate_limited", detail: "Muitas tentativas — tente novamente mais tarde." }, 429);
    }
    await sb.from("form_rate_limit").insert({ ip_hash: ipHash, endpoint: "publieditorial-preencher" });
  }

  const { data: briefing, error: bErr } = await sb
    .from("publieditorial_briefings")
    .select("id, status")
    .eq("token", body.token)
    .maybeSingle();
  if (bErr || !briefing) return json({ error: "token_invalido" }, 404);
  if (briefing.status !== "aguardando_preenchimento") {
    return json({ error: "briefing_ja_preenchido", status_atual: briefing.status }, 409);
  }

  const { error: uErr } = await sb
    .from("publieditorial_briefings")
    .update({
      nome_anunciante: body.nome_anunciante,
      o_que_faz: body.o_que_faz,
      contexto_mercado: body.contexto_mercado,
      diferenciais: body.diferenciais,
      evidencias: body.evidencias,
      impacto_leitor: body.impacto_leitor,
      cta_texto: body.cta_texto,
      link_destino: body.link_destino ?? null,
      status: "preenchido",
      preenchido_em: new Date().toISOString(),
    })
    .eq("id", briefing.id);
  if (uErr) return json({ error: "update_failed", detail: uErr.message }, 500);

  // Dispara a geração — encadeamento simples, mesmo padrão usado em
  // outras functions do projeto (scrape-source → cluster-articles, etc.)
  try {
    const genRes = await fetch(`${url}/functions/v1/generate-publieditorial`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ briefing_id: briefing.id }),
    });
    if (!genRes.ok) {
      const t = await genRes.text();
      await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: t.slice(0, 500) }).eq("id", briefing.id);
      return json({ ok: true, gerado: false, aviso: "Respostas salvas, mas a geração falhou — nossa equipe vai gerar manualmente." });
    }
  } catch (e) {
    await sb.from("publieditorial_briefings").update({ status: "erro", erro_detalhe: (e as Error).message }).eq("id", briefing.id);
    return json({ ok: true, gerado: false, aviso: "Respostas salvas, mas a geração falhou — nossa equipe vai gerar manualmente." });
  }

  return json({ ok: true, gerado: true });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
