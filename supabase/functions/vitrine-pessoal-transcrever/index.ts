// Vozes Paranaenses — vitrine-pessoal-transcrever
// Recebe um arquivo de áudio (multipart) e devolve { text } transcrito via Lovable AI.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STT_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MODEL = "openai/gpt-4o-mini-transcribe";

function extFromMime(mime: string): string {
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m === "audio/webm") return "webm";
  if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/m4a") return "mp4";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav") return "wav";
  if (m === "audio/ogg") return "ogg";
  return "webm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Arquivo de áudio ausente");
    if (file.size < 1024) throw new Error("Áudio muito curto. Grave novamente.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Áudio muito longo (máx. 20 MB).");

    const ext = extFromMime(file.type || "audio/webm");
    const upstream = new FormData();
    upstream.append("model", MODEL);
    upstream.append("language", "pt");
    upstream.append("file", file, `resposta.${ext}`);

    const resp = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Falha na transcrição (${resp.status}): ${body}` }),
        { status: resp.status, headers: { ...cors, "content-type": "application/json" } },
      );
    }
    const data = await resp.json() as { text?: string };
    return new Response(
      JSON.stringify({ text: (data.text ?? "").trim() }),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});