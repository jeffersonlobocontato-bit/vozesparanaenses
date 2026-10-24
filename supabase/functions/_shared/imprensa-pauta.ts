// Escopo do Portal da Imprensa para prefeituras: só publica matéria cujo fato
// central é uma AÇÃO DA PREFEITURA. Um agente de IA avalia o texto antes da
// redação (imprensa-gerar-rascunho) e de novo antes de publicar
// (imprensa-publicar), para pegar mudanças feitas na revisão.
// Se a IA falhar, não bloqueia (fail-open) — a supervisão humana segue valendo.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export const CRITERIO_PAUTA = `O Portal da Imprensa do Vozes Paranaenses publica conteúdo enviado pela assessoria de comunicação de prefeituras do Paraná. Ele só aceita matérias cujo FATO CENTRAL é uma ação da prefeitura do município.

CONTA COMO AÇÃO DA PREFEITURA (aceitar):
- obra, serviço, programa, projeto, campanha ou política pública da prefeitura, de uma secretaria municipal ou de autarquia/fundação municipal;
- atendimento, mutirão, vacinação, matrícula, concurso, processo seletivo, licitação, edital, convocação, aviso ou alteração de serviço municipal;
- evento, festa, feira ou ação cultural/esportiva organizada ou promovida pela prefeitura;
- decisão, decreto, investimento, convênio ou parceria em que a prefeitura é parte e o resultado é para o município;
- prestação de contas, resultado ou balanço de ação municipal;
- agenda oficial do prefeito ou de secretários quando o assunto é uma dessas ações.

NÃO CONTA (bloquear):
- propaganda ou divulgação de empresa, comércio, produto ou evento privado sem participação da prefeitura;
- conteúdo eleitoral ou partidário, promoção pessoal de político, pré-candidato ou candidato, ataque a adversário;
- ação da Câmara de Vereadores, do governo do estado, do governo federal ou de outra entidade em que a prefeitura não é protagonista;
- notícia de outro município, policial, judicial, de acidente ou de terceiros que não descreve ação da prefeitura;
- artigo de opinião, homenagem pessoal, nota de pesar, mensagem comemorativa genérica sem ação concreta.

Em caso de dúvida razoável, aceite se a prefeitura (ou secretaria municipal) aparece como responsável pela ação descrita.`;

export type AvaliacaoPauta = { ok: boolean; motivo: string };

export function interpretarAvaliacao(conteudo: string): AvaliacaoPauta | null {
  try {
    const j = JSON.parse(String(conteudo).replace(/^```json\s*|```$/g, "").trim());
    if (typeof j.acao_prefeitura !== "boolean") return null;
    return { ok: j.acao_prefeitura, motivo: String(j.motivo ?? "").trim() };
  } catch {
    return null;
  }
}

export async function avaliarPauta(texto: string, municipio: string | null, aiKey: string): Promise<AvaliacaoPauta> {
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${CRITERIO_PAUTA}\n\nMunicípio da assessoria: ${municipio ?? "não informado"}.\nResponda só JSON: {"acao_prefeitura": true|false, "motivo": "uma frase em português, dirigida ao assessor, dizendo qual é o fato central e por que ele é ou não é uma ação da prefeitura"}`,
          },
          { role: "user", content: texto.slice(0, 12000) },
        ],
      }),
    });
    if (!res.ok) return { ok: true, motivo: "" };
    const data = await res.json();
    return interpretarAvaliacao(data?.choices?.[0]?.message?.content ?? "") ?? { ok: true, motivo: "" };
  } catch {
    return { ok: true, motivo: "" };
  }
}

export function mensagemPautaBloqueada(motivo: string): string {
  return "Esta matéria não pode ser publicada pelo Portal da Imprensa: o canal é exclusivo para ações da prefeitura " +
    "(obras, serviços, programas, eventos, editais e outras iniciativas do município)." +
    (motivo ? ` Motivo: ${motivo}` : "") +
    " Se a pauta é uma ação da prefeitura, deixe isso claro no texto (qual secretaria, o que foi feito e para quem) e envie de novo.";
}

/** O cliente é uma prefeitura? (cadastro com município, ou nome de prefeitura). */
export function clienteEhPrefeitura(c: { cidade_id?: string | null; nome_empresa?: string | null }): boolean {
  return Boolean(c.cidade_id) || /\bprefeitura\b|\bprefa\b|\bmunic[ií]pio\b/i.test(c.nome_empresa ?? "");
}
