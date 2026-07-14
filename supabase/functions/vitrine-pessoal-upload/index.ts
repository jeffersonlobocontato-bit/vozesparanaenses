// Vozes Paranaenses — vitrine-pessoal-upload
// Recebe fotos em base64 do cliente e faz upload no bucket
// `vitrine-pessoal-fotos` via service role. Grava a lista atualizada em
// vitrine_pessoal_pedidos.imagens. Só aceita enquanto o pedido está editável.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "vitrine-pessoal-fotos";
const EDITAVEL = ["aguardando_edicao", "enviado_para_aprovacao"];
const MAX_FOTOS = 6;
const MAX_BYTES = 6 * 1024 * 1024; // 6MB por foto

type FotoIn = { name: string; contentType: string; base64: string };
type FotoOut = { url: string; name: string; path: string };

type Payload = {
  token: string;
  add?: FotoIn[];      // fotos a adicionar
  remove?: string[];   // paths a remover
};

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeExt(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: Payload;
  try { body = await req.json(); } catch { return json({ error: "invalid_json_body" }, 400); }
  if (!body.token) return json({ error: "missing_token" }, 400);

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: pedido, error: pErr } = await sb
    .from("vitrine_pessoal_pedidos")
    .select("id, status, imagens")
    .eq("token", body.token)
    .maybeSingle();
  if (pErr || !pedido) return json({ error: "token_invalido" }, 404);
  if (!EDITAVEL.includes(pedido.status)) {
    return json({ error: "edicao_bloqueada", status_atual: pedido.status }, 409);
  }

  let atual: FotoOut[] = Array.isArray(pedido.imagens) ? pedido.imagens as FotoOut[] : [];

  // Remover
  if (body.remove?.length) {
    await sb.storage.from(BUCKET).remove(body.remove);
    atual = atual.filter((f) => !body.remove!.includes(f.path));
  }

  // Adicionar
  if (body.add?.length) {
    if (atual.length + body.add.length > MAX_FOTOS) {
      return json({ error: "limite_de_fotos", max: MAX_FOTOS }, 400);
    }
    for (const foto of body.add) {
      const bytes = b64ToBytes(foto.base64);
      if (bytes.byteLength > MAX_BYTES) {
        return json({ error: "foto_muito_grande", nome: foto.name, max_bytes: MAX_BYTES }, 400);
      }
      const ext = safeExt(foto.contentType || "");
      const path = `${pedido.id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from(BUCKET).upload(path, bytes, {
        contentType: foto.contentType || "image/jpeg",
        upsert: false,
      });
      if (up.error) return json({ error: "upload_falhou", detail: up.error.message }, 500);
      const pub = sb.storage.from(BUCKET).getPublicUrl(path);
      atual.push({ url: pub.data.publicUrl, name: foto.name || `foto-${atual.length + 1}`, path });
    }
  }

  const { error: uErr } = await sb
    .from("vitrine_pessoal_pedidos")
    .update({ imagens: atual })
    .eq("id", pedido.id);
  if (uErr) return json({ error: "update_failed", detail: uErr.message }, 500);

  return json({ ok: true, imagens: atual });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });
}