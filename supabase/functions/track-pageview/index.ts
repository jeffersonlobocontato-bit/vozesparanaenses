// Vozes Paranaenses — track-pageview
// Recebe um evento de pageview do cliente (regiao_id, categoria, cidade da
// matéria, origem do tráfego) e ACRESCENTA a cidade aproximada do LEITOR,
// resolvida aqui no servidor a partir do IP da requisição — o IP em si
// NUNCA é gravado, só o nome da cidade que a consulta de geolocalização
// devolve. O navegador do leitor nunca tem acesso a IP nenhum (nunca teria
// mesmo) e o nosso banco também não guarda IP nenhum.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  regiao_id?: string | null;
  categoria?: string | null;
  cidade?: string | null;
  pagina?: string | null;
  origem_trafego?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  // 1. Resolve a cidade do leitor a partir do IP da requisição — tudo dentro
  //    desta função, numa variável local que nunca é persistida.
  const { cidadeLeitor, ufLeitor } = await resolverCidadeLeitor(req);

  // 2. Grava só o resultado (cidade/UF) — o IP já saiu de escopo aqui.
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.from("analytics_events").insert({
    regiao_id: body.regiao_id ?? null,
    categoria: body.categoria ?? null,
    cidade: body.cidade ?? null,
    cidade_leitor: cidadeLeitor,
    uf_leitor: ufLeitor,
    tipo_evento: "pageview",
    pagina: body.pagina ?? null,
    origem_trafego: body.origem_trafego ?? null,
  });

  if (error) return json({ error: "insert_failed", detail: error.message }, 500);
  return json({ ok: true });
});

async function resolverCidadeLeitor(req: Request): Promise<{ cidadeLeitor: string | null; ufLeitor: string | null }> {
  // O IP só existe dentro desta função, e só nesta variável — nunca é
  // passado adiante nem incluído em nenhum insert.
  const ip = extrairIp(req);
  if (!ip || ehIpPrivadoOuLocal(ip)) return { cidadeLeitor: null, ufLeitor: null };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,region,countryCode`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { cidadeLeitor: null, ufLeitor: null };
    const data = await res.json();
    if (data.status !== "success" || data.countryCode !== "BR") {
      return { cidadeLeitor: null, ufLeitor: null };
    }
    return { cidadeLeitor: data.city ?? null, ufLeitor: data.region ?? null };
  } catch {
    // Falha na consulta de geolocalização nunca deve impedir o registro do
    // pageview — só fica sem a cidade do leitor.
    return { cidadeLeitor: null, ufLeitor: null };
  }
}

function extrairIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

function ehIpPrivadoOuLocal(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
