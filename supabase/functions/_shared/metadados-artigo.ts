// Metadados de SEO/GEO/AEO de uma matéria já escrita: a IA só lê o texto e
// devolve seo_title, seo_description, resumo, tl;dr, 5W1H, FAQ e cidades —
// nunca reescreve o corpo. Usado por publish-article e imprensa-publicar.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const MODEL_METADADOS = "google/gemini-2.5-flash";
const MODEL = MODEL_METADADOS;

const SYSTEM = `Você é o editor de SEO/GEO do portal regional paranaense "Vozes Paranaenses".
Você recebe uma matéria JÁ ESCRITA e FECHADA por um jornalista humano.

REGRA ABSOLUTA: você NÃO reescreve, NÃO resume dentro do corpo, NÃO corrige e
NÃO altera o texto da matéria. Seu trabalho é apenas EXTRAIR e MONTAR os
metadados de indexação a partir do que está escrito.

Nunca invente fatos, nomes, números ou datas que não estejam no texto.
Se uma informação não existir no texto, retorne null (ou array vazio).

Retorne APENAS JSON válido, sem markdown, exatamente neste schema:
{
  "seo_title": "até 60 caracteres, com a palavra-chave principal",
  "seo_description": "até 155 caracteres, descritivo, sem clickbait",
  "resumo": "2-3 frases autocontidas para redes sociais",
  "tldr": "2-3 frases curtas respondendo direto 'o que aconteceu?' (answer-first para AI Overviews)",
  "fatos_5w1h": { "quem": null, "o_que": null, "quando": null, "onde": null, "por_que": null, "como": null },
  "faq": [{ "pergunta": "...", "resposta": "1-3 frases baseadas SOMENTE no texto" }],
  "cidade_principal": "cidade paranaense central da notícia ou null",
  "cidades_mencionadas": ["outras cidades citadas"]
}`;

export type Meta = {
  seo_title?: string | null;
  seo_description?: string | null;
  resumo?: string | null;
  tldr?: string | null;
  fatos_5w1h?: Record<string, unknown> | null;
  faq?: Array<{ pergunta: string; resposta: string }>;
  cidade_principal?: string | null;
  cidades_mencionadas?: string[];
};

export async function gerarMetadados(
  titulo: string,
  texto: string,
  aiKey: string,
): Promise<Meta | { error: string; detail?: string; status?: number; httpStatus?: number }> {
  const userPrompt = `TÍTULO: ${titulo}\n\nTEXTO FINAL DA MATÉRIA (não altere, apenas leia):\n"""\n${texto.slice(0, 24000)}\n"""`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (e) {
      if (attempt === 2) return { error: "ai_network_error", detail: String(e), httpStatus: 502 };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) return { error: "rate_limited", httpStatus: 429 };
    if (res.status === 402) return { error: "ai_credits_exhausted", httpStatus: 402 };
    if (!res.ok) {
      const t = await res.text();
      if (attempt === 2) return { error: "ai_gateway_error", status: res.status, detail: t.slice(0, 400), httpStatus: 502 };
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(String(content).replace(/^```json\s*|```$/g, "").trim()) as Meta;
    } catch {
      if (attempt === 2) return { error: "ai_invalid_json", detail: String(content).slice(0, 300), httpStatus: 502 };
    }
  }
  return { error: "ai_failed", httpStatus: 502 };
}
