// Web-standard core shared by Deno functions and the app server. Never persists content.
export type EtapaIA = "embedding_coleta" | "agrupamento" | "crivo" | "fatos" | "redacao" | "criticidade" | "seo" | "duplicidade" | "imagem_analise" | "imagem_geracao" | "nota_cidade" | "instagram" | "coluna" | "imprensa" | "chat" | "outro";
export type ContextoIA = { funcao: string; cluster_id?: string | null; artigo_id?: string | null };
export type PrecoIA = { usd_por_milhao_entrada: number; usd_por_milhao_saida: number; usd_por_imagem: number; usd_por_milhao_audio?: number | null; usd_por_milhao_cache?: number | null; entrada_longa?: number | null; saida_longa?: number | null; limite_longo?: number | null };
type Objeto = Record<string, any>;
export function calcularCustoIA(preco: PrecoIA | null, usage: Objeto | null, imagens: number): number | null {
  if (!preco || !usage) return null;
  const entrada = usage.prompt_tokens ?? usage.input_tokens ?? usage.total_tokens;
  const saida = usage.completion_tokens ?? usage.output_tokens ?? (usage.total_tokens != null ? 0 : null);
  if (entrada == null || saida == null) return null;
  const longo = preco.limite_longo != null && entrada > preco.limite_longo;
  const cache = usage.prompt_tokens_details?.cached_tokens ?? usage.input_token_details?.cached_tokens ?? 0;
  const audio = usage.input_token_details?.audio_tokens ?? usage.prompt_tokens_details?.audio_tokens ?? 0;
  const imageTokens = usage.completion_tokens_details?.image_tokens ?? usage.output_token_details?.image_tokens;
  // Native Gemini images are 1,290 output tokens/image; count their fee once, not twice.
  const textoSaida = Math.max(0, saida - (imageTokens ?? (imagens ? imagens * 1290 : 0)));
  return ((entrada - cache - audio) * Number(longo ? preco.entrada_longa : preco.usd_por_milhao_entrada)
    + cache * Number(preco.usd_por_milhao_cache ?? preco.usd_por_milhao_entrada)
    + audio * Number(preco.usd_por_milhao_audio ?? preco.usd_por_milhao_entrada)
    + textoSaida * Number(longo ? preco.saida_longa : preco.usd_por_milhao_saida)) / 1e6
    + imagens * Number(preco.usd_por_imagem);
}

export type RegistroIA = ContextoIA & { etapa: EtapaIA; modelo: string; tokens_entrada: number | null; tokens_saida: number | null; imagens: number; custo_usd: number | null; sucesso: boolean; erro: string | null; duracao_ms: number };
export function criarChamarIA(deps: { contexto: () => ContextoIA; preco: (modelo: string) => Promise<PrecoIA | null>; gravar: (linha: RegistroIA) => Promise<void>; fetch?: typeof fetch }) {
  return async function chamarIA(etapa: EtapaIA, url: string, init: RequestInit): Promise<Response> {
    const contexto = { ...deps.contexto() };
    let modelo = "desconhecido";
    try { modelo = typeof init.body === "string" ? JSON.parse(init.body).model : init.body instanceof FormData ? String(init.body.get("model")) : modelo; } catch { /* preserve original request */ }
    const inicio = Date.now();
    let gravado = false;
    async function registrar(ok: boolean, payload: Objeto | null, erro: string | null) {
      if (gravado) return;
      gravado = true;
      const usage = payload?.usage ?? null;
      const imagens = (payload?.choices ?? []).reduce((n: number, c: Objeto) => n + (c.message?.images?.length ?? (typeof c.message?.content === "string" && c.message.content.startsWith("data:image") ? 1 : 0)), 0);
      const duracao = Date.now() - inicio;
      let preco: PrecoIA | null = null;
      try { preco = await deps.preco(modelo); } catch { /* usage still recorded without a price */ }
      try {
        await deps.gravar({ ...contexto, etapa, modelo, tokens_entrada: usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.total_tokens ?? null, tokens_saida: usage?.completion_tokens ?? usage?.output_tokens ?? (usage?.total_tokens != null ? 0 : null), imagens, custo_usd: calcularCustoIA(preco, usage, imagens), sucesso: ok, erro, duracao_ms: duracao });
      } catch { console.warn("[ia_uso] registro indisponível", contexto.funcao, etapa); }
    }
    let resposta: Response;
    try { resposta = await (deps.fetch ?? fetch)(url, init); }
    catch (e) { await registrar(false, null, e instanceof Error ? e.name : "network_error"); throw e; }
    const jsonOriginal = resposta.json.bind(resposta);
    const textOriginal = resposta.text.bind(resposta);
    // Consume once through the existing caller; never clone large image responses.
    resposta.json = async () => {
      try {
        const payload = await jsonOriginal();
        const choiceError = payload?.error || payload?.choices?.some((c: Objeto) => c.error || c.finish_reason === "content_filter");
        await registrar(resposta.ok && !choiceError, payload, resposta.ok ? choiceError ? "gateway_response_error" : null : `http_${resposta.status}`);
        return payload;
      } catch (e) { await registrar(false, null, "invalid_json"); throw e; }
    };
    resposta.text = async () => {
      try { const text = await textOriginal(); let payload = null; try { payload = JSON.parse(text); } catch { /* unknown usage */ } await registrar(resposta.ok, payload, resposta.ok ? null : `http_${resposta.status}`); return text; }
      catch (e) { await registrar(false, null, "response_read_error"); throw e; }
    };
    if (!resposta.ok) {
      // Some callers return a fallback without reading the error body. Capture usage once
      // even on that path, then restore an equivalent response for the existing handler.
      try {
        const text = await textOriginal();
        let payload = null;
        try { payload = JSON.parse(text); } catch { /* safe error code only */ }
        await registrar(false, payload, `http_${resposta.status}`);
        return new Response(text, { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers });
      } catch { await registrar(false, null, `http_${resposta.status}`); }
    }
    return resposta;
  };
}