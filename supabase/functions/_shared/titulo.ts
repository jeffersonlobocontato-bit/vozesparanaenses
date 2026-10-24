// Vozes Paranaenses — regra de título (out/2026)
//
//   1. NUNCA "Prefeitura" (nem "Município de", "Administração municipal",
//      "Poder Executivo") no título. Quem fez entra no texto.
//   2. Matéria/nota COM cidade identificada: a cidade já aparece como TAG
//      (página da matéria, cards da home, coluna regional). O título fica
//      só com o fato — cidade e prefeitura vão para o lide.
//      Exceção: quando a cidade é indispensável para entender o fato (ex.:
//      a notícia envolve duas cidades, ou a cidade é o próprio assunto,
//      como o aniversário do município).
//   3. SEM cidade identificada (sem tag): o nome da cidade pode entrar no
//      título quando necessário — "Prefeitura" continua proibido.
//   4. Conteúdo de prefeitura abre pelo BENEFÍCIO/fato concreto para a
//      população (REGRA_TITULO_BENEFICIO), não por quem fez.
//
// A regra vai no prompt; depois de escrito, verificarTitulo() confere e,
// se o título violou, reescreverTitulo() pede só um título novo (chamada
// curta e barata). O SEO title pode citar a cidade — ele não aparece na
// página, só na busca.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_TITULO = "google/gemini-2.5-flash-lite";

const TERMOS_PROIBIDOS = /\b(prefeitura|prefeituras|munic[ií]pio de|administra[cç][aã]o municipal|poder executivo municipal|executivo municipal)\b/i;

export function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Conteúdo de prefeitura (release do pipeline ou matéria do Portal da
 * Imprensa): o título abre pelo BENEFÍCIO/fato concreto para a população,
 * não por quem fez. Vai dentro de regraTituloPrompt (pipeline, nota da
 * coluna, reescrita) e direto no prompt do imprensa-gerar-rascunho.
 */
export const REGRA_TITULO_BENEFICIO = `- Em conteúdo de prefeitura (release ou assessoria), o sujeito do título é o BENEFÍCIO ou o fato concreto para a população — a obra, o serviço, o valor, o prazo, quem é atendido —, não o órgão que fez. Sempre que possível, nada de "Prefeitura" / "Prefeitura de X" como sujeito ou centro do título.
- Traga o dado concreto que o texto tiver (quantidade, valor, local, data, público). Ex.: "Prefeitura de Cascavel abre licitações para pavimentar estradas rurais" → "Estradas rurais de Diamante e São Salvador terão 10 km de asfalto com R$ 13,8 milhões".
- Continue neutro: nada de adjetivo promocional ("histórico", "grande conquista", "mais uma vez"), nada de elogio à gestão, e nenhum número, local ou benefício que não esteja no material.`;

/** Texto da regra para o prompt de redação. */
export function regraTituloPrompt(cidadeTag: string | null): string {
  const base = `REGRA DO TÍTULO (obrigatória):
- Nunca use a palavra "Prefeitura" (nem "Município de", "Administração municipal" ou "Executivo municipal") no título. Quem realizou a ação entra no texto.
${REGRA_TITULO_BENEFICIO}`;
  if (cidadeTag) {
    return `${base}
- A cidade desta notícia é ${cidadeTag} e ela já aparece como etiqueta (tag) ao lado do título. Por isso o título NÃO menciona ${cidadeTag} nem a prefeitura: traga só o fato. O nome da cidade e de quem fez entram no lide.
- Exceção: mantenha a cidade no título apenas se ela for indispensável para entender o fato (ex.: a notícia envolve duas cidades, ou o assunto é a própria cidade, como o aniversário do município).
- O "seo_title" pode citar ${cidadeTag} (ele não aparece na página, só na busca).
Exemplos: "Prefeitura de ${cidadeTag} abre inscrições para curso de informática" → "Inscrições abertas para curso gratuito de informática". "${cidadeTag} realiza mutirão de vacinação no sábado" → "Mutirão de vacinação acontece no sábado".`;
  }
  return `${base}
- Se precisar situar o leitor, use só o nome da cidade. Ex.: "Prefeitura de Cambará abre PSS na saúde" → "Cambará abre processo seletivo na saúde".`;
}

/** Motivos pelos quais o título viola a regra (vazio = ok). */
export function verificarTitulo(titulo: string, cidadeTag: string | null): string[] {
  const motivos: string[] = [];
  if (TERMOS_PROIBIDOS.test(titulo)) motivos.push("usa \"Prefeitura\" (ou equivalente) no título");
  if (cidadeTag) {
    const t = ` ${normalizarTexto(titulo).replace(/[^a-z0-9]+/g, " ")} `;
    const c = ` ${normalizarTexto(cidadeTag).replace(/[^a-z0-9]+/g, " ").trim()} `;
    if (c.trim() && t.includes(c)) motivos.push(`cita ${cidadeTag}, que já é a tag da notícia`);
  }
  return motivos;
}

/**
 * Pede só um título novo, sem a violação. Se a chamada falhar, devolve o
 * título original sem "Prefeitura de"/"Prefeitura" no começo (melhor que
 * nada) — a notícia nunca deixa de sair por causa disso.
 */
export async function reescreverTitulo(p: {
  titulo: string;
  cidadeTag: string | null;
  contexto: string;
  motivos: string[];
  aiKey: string;
  maxChars?: number;
}): Promise<string> {
  const max = p.maxChars ?? 90;
  const sistema = `Você reescreve títulos de notícia do portal "Vozes Paranaenses". Mantenha o fato central, tom informativo, sem clickbait, até ${max} caracteres.
${regraTituloPrompt(p.cidadeTag)}
Retorne APENAS JSON: {"titulo": "..."}`;
  const usuario = `Título atual: ${p.titulo}
Problema: ${p.motivos.join("; ")}
Contexto da notícia: ${p.contexto.slice(0, 1200)}`;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.aiKey}` },
      body: JSON.stringify({
        model: MODEL_TITULO,
        temperature: 0.1,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      }),
    });
    if (res.ok) {
      const j = await res.json();
      const content = String(j?.choices?.[0]?.message?.content ?? "");
      const m = content.match(/\{[\s\S]*\}/);
      const novo = (JSON.parse(m ? m[0] : content) as { titulo?: string }).titulo?.trim();
      if (novo && novo.length <= max + 20 && !TERMOS_PROIBIDOS.test(novo)) return novo.slice(0, max + 20);
    }
  } catch (_) {
    // cai no ajuste mecânico
  }
  return limparPrefeituraMecanico(p.titulo);
}

/** Último recurso, sem IA: "Prefeitura de X abre..." → "X abre...". */
export function limparPrefeituraMecanico(titulo: string): string {
  const limpo = titulo
    .replace(/^\s*(a\s+)?prefeitura\s+(municipal\s+)?(de|da|do)\s+/i, "")
    .replace(/\s*,?\s*(diz|informa|anuncia)\s+a\s+prefeitura\b/i, "")
    .trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : titulo;
}

/** Aplica a regra: verifica e, se preciso, reescreve. Devolve o título final. */
export async function garantirRegraTitulo(p: {
  titulo: string;
  cidadeTag: string | null;
  contexto: string;
  aiKey: string;
  maxChars?: number;
}): Promise<{ titulo: string; ajustado: boolean; motivos: string[] }> {
  const motivos = verificarTitulo(p.titulo, p.cidadeTag);
  if (!motivos.length) return { titulo: p.titulo, ajustado: false, motivos };
  const novo = await reescreverTitulo({ ...p, motivos });
  return { titulo: novo, ajustado: novo !== p.titulo, motivos };
}
