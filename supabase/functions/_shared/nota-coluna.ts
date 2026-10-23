// Vozes Paranaenses — nota na coluna "Vozes {Cidade}"
//
// Pauta que não vira matéria (prioridade média/baixa sem foto liberada, ou
// cota estourada) sai como NOTA curta na coluna da cidade. A coluna é um
// blog: cada nota é publicada sozinha, com data/hora, e empurra as
// anteriores para baixo. A coluna é criada na primeira nota da cidade.

import type { ResultadoCriticidade } from "./criticidade.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const NOTA_PROMPT = `Você escreve NOTAS curtas para a coluna "Vozes {CIDADE}" do portal regional
"Vozes Paranaenses". Uma nota é um registro rápido e factual, não uma reportagem.

REGRAS:
1. Use SOMENTE os fatos fornecidos — nunca invente nome, número, data, cargo ou citação.
2. Título: até 80 caracteres, direto, com o fato central (sem "Prefeitura informa", sem clickbait).
3. Corpo: 2 a 4 frases (até 90 palavras). A primeira frase responde o quê, quem, quando e onde.
   Se houver serviço ao leitor (data, local, horário, como participar), inclua.
4. Tom informativo, sem adjetivos, sem opinião, sem tom de propaganda: "A prefeitura
   realizou X" em vez de "A prefeitura, em mais uma ação de sucesso...".
5. Não cite o nome do portal nem diga "segundo apurou".

Retorne APENAS JSON: {"titulo": "...", "corpo": "..."}`;

type Fatos = {
  quem: string | null;
  o_que: string | null;
  quando: string | null;
  onde: string | null;
  por_que: string | null;
  dados?: Record<string, unknown> | null;
  citacoes?: unknown;
};

export async function escreverNota(
  fatos: Fatos,
  cidadeNome: string,
  aiKey: string,
): Promise<{ titulo: string; corpo: string } | { error: string; detail?: string }> {
  const sistema = NOTA_PROMPT.replace("{CIDADE}", cidadeNome);
  const usuario = `Cidade: ${cidadeNome}\nFatos apurados:\n${JSON.stringify(fatos).slice(0, 5000)}`;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.1,
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
        }),
      });
      if (res.status === 429) return { error: "rate_limited" };
      if (res.status === 402) return { error: "ai_credits_exhausted" };
      if (!res.ok) continue;
      const j = await res.json();
      const content = String(j?.choices?.[0]?.message?.content ?? "");
      const m = content.match(/\{[\s\S]*\}/);
      const nota = JSON.parse(m ? m[0] : content) as { titulo?: string; corpo?: string };
      if (nota.titulo?.trim() && nota.corpo?.trim()) {
        return { titulo: nota.titulo.trim().slice(0, 120), corpo: nota.corpo.trim() };
      }
    } catch (_) {
      // tenta de novo
    }
  }
  return { error: "nota_generation_failed" };
}

export async function publicarNotaNaColuna(
  // deno-lint-ignore no-explicit-any
  sb: any,
  p: {
    cidadeSlug: string;
    regiaoId: string | null;
    clusterId: string;
    titulo: string;
    corpo: string;
    fonteNome: string | null;
    fonteUrl: string | null;
    tema: string | null;
    dataOriginal: string | null;
    criticidade: ResultadoCriticidade;
  },
): Promise<{ id: string; status: string; coluna_id: string } | { error: string; detail?: string }> {
  const { data: colunaId, error: colErr } = await sb.rpc("garantir_coluna_cidade", { p_cidade_slug: p.cidadeSlug });
  if (colErr || !colunaId) return { error: "coluna_cidade_failed", detail: colErr?.message };

  const publica = !p.criticidade.revisao;
  const { data, error } = await sb
    .from("coluna_cidade_notas")
    .insert({
      coluna_id: colunaId,
      cidade_slug: p.cidadeSlug,
      regiao_id: p.regiaoId,
      cluster_id: p.clusterId,
      titulo: p.titulo,
      corpo: p.corpo,
      fonte_nome: p.fonteNome,
      fonte_url: p.fonteUrl,
      tema_crivo: p.tema,
      data_publicacao_original: p.dataOriginal,
      status: publica ? "publicado" : "revisao",
      criticidade_nivel: p.criticidade.nivel,
      criticidade_motivos: p.criticidade.motivos,
      publicado_em: publica ? new Date().toISOString() : null,
    })
    .select("id, status")
    .single();
  if (error) {
    // cluster_id é único: chamada repetida para a mesma pauta não duplica.
    if (error.code === "23505") {
      const { data: existente } = await sb.from("coluna_cidade_notas").select("id, status").eq("cluster_id", p.clusterId).maybeSingle();
      if (existente) return { ...existente, coluna_id: colunaId };
    }
    return { error: "nota_insert_failed", detail: error.message };
  }
  return { ...data, coluna_id: colunaId };
}
