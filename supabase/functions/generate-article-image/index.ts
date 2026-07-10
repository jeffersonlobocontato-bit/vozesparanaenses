// Vozes Paranaenses — generate-article-image
// Modos:
//   { article_id, mode: "ai" }              → busca imagem original das raws do
//     cluster e pede ao Nano Banana pra recriar com leve variação de ângulo/detalhe
//     (evita cópia literal / risco autoral).
//   { article_id, mode: "ai", source_url }  → força usar essa URL como base.
//   { article_id, mode: "upload", base64, mime } → upload manual do editor.
// Salva em storage `article-covers` e atualiza imagem_capa_url + og_image_url + imagem_credito.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMG_MODEL = "google/gemini-2.5-flash-image";
const EDIT_PROMPT =
  "Recrie esta cena fotojornalística com pequenas variações: leve mudança de ângulo de câmera, " +
  "reenquadramento sutil e ajuste de iluminação natural. Mantenha o contexto, o cenário e a " +
  "atmosfera reconhecíveis, mas produza uma composição distinta da original (evitar cópia). " +
  "Estilo: fotografia editorial realista, cores naturais, sem texto, sem marca d'água.";
const GEN_PROMPT_FALLBACK =
  "Fotografia editorial realista, estilo fotojornalismo brasileiro, cores naturais, sem texto, sem marca d'água, para a seguinte matéria:\n";
const SAFE_PROMPT =
  "Ilustração editorial neutra e segura para jornal, sem pessoas identificáveis, sem violência, " +
  "sem sangue, sem armas, sem crianças. Foco no cenário/ambiente genérico relacionado ao tema. " +
  "Estilo: fotografia editorial realista, cores naturais, sem texto, sem marca d'água. Tema:\n";

type Body = {
  article_id: string;
  mode: "ai" | "upload";
  source_url?: string;
  base64?: string;
  mime?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.article_id || !body.mode) return json({ error: "missing_article_id_or_mode" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: article, error: aErr } = await sb
    .from("generated_articles")
    .select("id, cluster_id, titulo, resumo")
    .eq("id", body.article_id)
    .maybeSingle();
  if (aErr || !article) return json({ error: "article_not_found", detail: aErr?.message }, 404);

  let imgBytes: Uint8Array;
  let mime = "image/png";
  let credito = "";

  if (body.mode === "upload") {
    if (!body.base64) return json({ error: "missing_base64" }, 400);
    imgBytes = base64ToBytes(body.base64);
    mime = body.mime && /^image\//.test(body.mime) ? body.mime : "image/jpeg";
    credito = "Imagem: enviada pela redação";
  } else {
    if (!aiKey) return json({ error: "missing_lovable_api_key" }, 500);

    // Descobre imagem-fonte
    let sourceUrl = body.source_url ?? null;
    if (!sourceUrl && article.cluster_id) {
      const { data: ca } = await sb.from("cluster_articles").select("raw_article_id").eq("cluster_id", article.cluster_id);
      const rawIds = (ca ?? []).map((r) => r.raw_article_id);
      if (rawIds.length) {
        const { data: raws } = await sb
          .from("raw_articles")
          .select("imagem_original_url")
          .in("id", rawIds)
          .not("imagem_original_url", "is", null)
          .limit(1);
        sourceUrl = raws?.[0]?.imagem_original_url ?? null;
      }
    }

    // Monta mensagem para Nano Banana
    const content: Array<Record<string, unknown>> = [];
    if (sourceUrl) {
      content.push({ type: "text", text: EDIT_PROMPT });
      content.push({ type: "image_url", image_url: { url: sourceUrl } });
      credito = "Imagem: gerada por IA (Vozes Paranaenses) — inspirada na cena original";
    } else {
      content.push({
        type: "text",
        text: GEN_PROMPT_FALLBACK + `Título: ${article.titulo}\n${article.resumo ?? ""}`,
      });
      credito = "Imagem: gerada por IA (Vozes Paranaenses)";
    }

    const callAI = async (msgContent: Array<Record<string, unknown>>) => {
      const r = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: IMG_MODEL,
          messages: [{ role: "user", content: msgContent }],
          modalities: ["image", "text"],
        }),
      });
      return r;
    };

    const extractImg = (j: any): { url?: string; finish?: string } => {
      const choice = j?.choices?.[0];
      const msg = choice?.message;
      const url =
        msg?.images?.[0]?.image_url?.url ??
        (typeof msg?.content === "string" && msg.content.startsWith("data:image") ? msg.content : undefined);
      return { url, finish: choice?.native_finish_reason ?? choice?.finish_reason };
    };

    let aiRes = await callAI(content);
    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (aiRes.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return json({ error: "ai_gateway_error", status: aiRes.status, detail: t.slice(0, 500) }, 502);
    }
    let aiJson = await aiRes.json();
    let { url: imgUrl, finish } = extractImg(aiJson);

    // Retry com prompt neutro se filtro de segurança bloqueou (comum quando a imagem-fonte tem pessoas/violência)
    if ((!imgUrl || finish === "IMAGE_SAFETY" || finish === "content_filter")) {
      const safeContent = [{
        type: "text",
        text: SAFE_PROMPT + `${article.titulo}\n${article.resumo ?? ""}`,
      }];
      aiRes = await callAI(safeContent);
      if (aiRes.ok) {
        aiJson = await aiRes.json();
        ({ url: imgUrl, finish } = extractImg(aiJson));
        credito = "Imagem: gerada por IA (Vozes Paranaenses)";
      }
    }

    if (!imgUrl || !imgUrl.startsWith("data:image")) {
      const reason = finish === "IMAGE_SAFETY" || finish === "content_filter" ? "ai_image_safety_blocked" : "ai_no_image";
      return json({ error: reason, detail: "O modelo bloqueou a geração por segurança. Tente fazer upload manual." }, 502);
    }
    const commaIdx = imgUrl.indexOf(",");
    mime = imgUrl.slice(5, imgUrl.indexOf(";")) || "image/png";
    imgBytes = base64ToBytes(imgUrl.slice(commaIdx + 1));
  }

  // Upload no bucket
  const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
  const path = `${body.article_id}/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from("article-covers").upload(path, imgBytes, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return json({ error: "upload_failed", detail: upErr.message }, 500);

  const { data: pub } = sb.storage.from("article-covers").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updErr } = await sb
    .from("generated_articles")
    .update({ imagem_capa_url: publicUrl, og_image_url: publicUrl, imagem_credito: credito })
    .eq("id", body.article_id);
  if (updErr) return json({ error: "article_update_failed", detail: updErr.message }, 500);

  return json({ ok: true, url: publicUrl, credito, mode: body.mode });
});

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}