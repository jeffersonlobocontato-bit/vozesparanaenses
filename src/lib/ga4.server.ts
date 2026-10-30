// Conector da API de Dados do GA4 (somente leitura), usado pelo painel
// /admin/analytics. Só roda no servidor.
//
// Credencial: conta de serviço do Google Cloud com acesso de LEITOR na
// propriedade do GA4. O JSON da chave fica no secret GA4_SERVICE_ACCOUNT_JSON
// (o arquivo inteiro, ou em base64). O token de acesso é gerado aqui
// (JWT RS256 assinado com WebCrypto — funciona em Node e em Workers) e
// guardado em memória até perto de expirar.

export const GA4_PROPRIEDADE = process.env.GA4_PROPERTY_ID || "545150980";

type ContaServico = { client_email: string; private_key: string };

let tokenCache: { token: string; ate: number } | null = null;

function lerConta(): ContaServico | null {
  const bruto = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!bruto) return null;
  try {
    const texto = bruto.trim().startsWith("{") ? bruto : atob(bruto.trim());
    const j = JSON.parse(texto) as Partial<ContaServico>;
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    return null;
  }
}

export function ga4Configurado(): boolean {
  return lerConta() !== null;
}

function b64url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string"
    ? unescape(encodeURIComponent(bytes))
    : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function chavePrivada(pem: string): Promise<CryptoKey> {
  const corpo = pem.replace(/-----[^-]+-----/g, "").replace(/\\n/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function tokenGoogle(): Promise<string> {
  if (tokenCache && tokenCache.ate > Date.now() + 60_000) return tokenCache.token;
  const conta = lerConta();
  if (!conta) throw new Error("GA4_SERVICE_ACCOUNT_JSON não configurado");
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  }));
  const chave = await chavePrivada(conta.private_key);
  const assinatura = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(`${cabecalho}.${corpo}`)),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecalho}.${corpo}.${b64url(assinatura)}`,
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google recusou a credencial: ${j.error_description ?? j.error ?? res.status}`);
  tokenCache = { token: j.access_token, ate: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

/** Uma linha de relatório: chave = nome da dimensão/métrica pedida. */
export type LinhaGA = Record<string, string | number>;

type RespostaGA = {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }>;
  error?: { message?: string };
};

function linhas(r: RespostaGA): LinhaGA[] {
  const dims = (r.dimensionHeaders ?? []).map((d) => d.name);
  const mets = (r.metricHeaders ?? []).map((m) => m.name);
  return (r.rows ?? []).map((row) => {
    const l: LinhaGA = {};
    dims.forEach((d, i) => { l[d] = row.dimensionValues?.[i]?.value ?? ""; });
    mets.forEach((m, i) => { l[m] = Number(row.metricValues?.[i]?.value ?? 0); });
    return l;
  });
}

async function chamar(metodo: "runReport" | "runRealtimeReport", corpo: unknown): Promise<LinhaGA[]> {
  const token = await tokenGoogle();
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPRIEDADE}:${metodo}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = (await res.json()) as RespostaGA;
  if (!res.ok) throw new Error(j.error?.message ?? `GA4 respondeu ${res.status}`);
  return linhas(j);
}

export const ga4Relatorio = (corpo: unknown) => chamar("runReport", corpo);
export const ga4TempoReal = (corpo: unknown) => chamar("runRealtimeReport", corpo);
