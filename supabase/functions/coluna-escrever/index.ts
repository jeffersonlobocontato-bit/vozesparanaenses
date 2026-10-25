// Vozes Paranaenses — coluna-escrever
//
// Escreve uma edição da coluna Vozes Políticas a partir das pautas que o
// editor colou numa caixa única (links e/ou textos, na ordem das notas).
// Lê cada link, chama o agente da coluna e devolve a edição ESTRUTURADA
// (título, linha fina, notas, pergunta ao leitor) — não salva nada: o
// editor revisa a prévia, sobe as fotos que quiser e salva pelo painel.
//
// Só equipe (admin/editor). Body: { pautas: string, coluna_slug?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exigirEquipe } from "../_shared/auth.ts";
import {
  AGENTE_PADRAO,
  montarPrompt,
  normalizarColuna,
  separarPautas,
  textoDaPagina,
  urlPermitida,
  type ExemploEdicao,
} from "../_shared/coluna-politica.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Coluna assinada, uma vez por semana: vale o modelo mais caprichado.
const MODEL = "google/gemini-2.5-pro";
const MAX_PAUTAS = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}

async function lerFonte(url: string) {
  if (!urlPermitida(url)) return { url, titulo: "", descricao: "", texto: "", erro: "endereço não permitido" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; VozesParanaensesBot/1.0; +contato@vozesparanaenses.com.br)", accept: "text/html" },
    });
    clearTimeout(t);
    if (!res.ok) return { url, titulo: "", descricao: "", texto: "", erro: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, 1_500_000);
    const p = textoDaPagina(html);
    if (!p.texto && !p.descricao) return { url, ...p, erro: "página sem texto legível (pode depender de JavaScript)" };
    return { url, ...p };
  } catch (e) {
    return { url, titulo: "", descricao: "", texto: "", erro: (e as Error).name === "AbortError" ? "demorou demais" : "falha ao abrir" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirEquipe(req);
    if (negado) return negado;
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { pautas?: string; coluna_slug?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }

  const pautas = separarPautas(body.pautas ?? "");
  if (!pautas.length) return json({ error: "sem_pautas", detail: "Cole ao menos uma pauta (link ou texto)." }, 400);
  if (pautas.length > MAX_PAUTAS) return json({ error: "pautas_demais", detail: `No máximo ${MAX_PAUTAS} pautas por edição.` }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const slug = body.coluna_slug || "vozes-politicas";

  // Agente da coluna (coluna nova da 085; sem ela, o padrão).
  let agente = AGENTE_PADRAO;
  let colunaId: string | null = null;
  {
    const r = await sb.from("colunas").select("id, agente_instrucoes").eq("slug", slug).maybeSingle();
    if (r.error) {
      const r2 = await sb.from("colunas").select("id").eq("slug", slug).maybeSingle();
      colunaId = r2.data?.id ?? null;
    } else {
      colunaId = r.data?.id ?? null;
      const inst = (r.data as { agente_instrucoes?: string | null } | null)?.agente_instrucoes;
      if (inst && inst.trim().length > 50) agente = inst.trim();
    }
  }
  if (!colunaId) return json({ error: "coluna_nao_encontrada" }, 404);

  // Referência de estilo: as duas últimas edições publicadas.
  const exemplos: ExemploEdicao[] = [];
  {
    const { data: eds } = await sb.from("coluna_edicoes")
      .select("id, titulo, subtitulo").eq("coluna_id", colunaId).eq("status", "publicado")
      .order("publicado_em", { ascending: false }).limit(2);
    for (const e of (eds ?? []) as Array<{ id: string; titulo: string; subtitulo: string | null }>) {
      const { data: ns } = await sb.from("coluna_notas").select("titulo_gatilho, corpo").eq("edicao_id", e.id).order("ordem");
      exemplos.push({ titulo: e.titulo, subtitulo: e.subtitulo, notas: (ns ?? []) as ExemploEdicao["notas"] });
    }
  }

  // Lê os links de todas as pautas em paralelo.
  const comFontes = await Promise.all(
    pautas.map(async (p) => ({ ...p, fontes: await Promise.all(p.urls.slice(0, 3).map(lerFonte)) })),
  );

  const { system, user } = montarPrompt({ agente, exemplos, pautas: comFontes });
  let raw: unknown = null;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (res.status === 429) return json({ error: "ia_ocupada", detail: "A IA está com muitas chamadas agora. Tente de novo em um minuto." }, 429);
    if (res.status === 402) return json({ error: "ia_sem_credito", detail: "Os créditos de IA acabaram." }, 402);
    if (!res.ok) return json({ error: "ia_falhou", detail: (await res.text()).slice(0, 300) }, 502);
    const j = await res.json();
    const txt = String(j?.choices?.[0]?.message?.content ?? "");
    raw = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? txt);
  } catch (e) {
    return json({ error: "ia_resposta_invalida", detail: (e as Error).message }, 502);
  }

  const coluna = normalizarColuna(raw, pautas.length);
  if (!coluna) return json({ error: "ia_resposta_invalida", detail: "A IA não devolveu a coluna no formato esperado. Tente de novo." }, 502);

  // Conta a escrita para o painel de custos (085). Tolerante se a tabela não existir.
  await sb.from("coluna_escritas_ia").insert({ coluna_id: colunaId, pautas: pautas.length }).then(() => null, () => null);

  return json({
    ok: true,
    coluna,
    pautas: comFontes.map((p) => ({
      ordem: p.ordem,
      texto: p.texto,
      fontes: p.fontes.map((f) => ({ url: f.url, titulo: f.titulo, erro: f.erro ?? null })),
    })),
  });
});
