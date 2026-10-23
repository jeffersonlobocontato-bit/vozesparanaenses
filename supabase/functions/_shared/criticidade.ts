// Vozes Paranaenses — agente de criticidade
//
// Avalia o RISCO do texto final (matéria ou nota) antes de publicar. Risco
// relevante (nível >= limiar, padrão "medio") → fila de revisão humana; o
// resto publica sozinho. É a única porta de saída automática do pipeline.
//
// Duas camadas, e vale a MAIS ALTA:
//  1. Gatilhos determinísticos (regex) — não dependem de IA e não erram
//     para baixo: pessoa + crime, menor de idade, morte, eleição...
//  2. Agente de IA com a rubrica abaixo — pega o que regex não pega
//     (acusação sem fonte oficial, divergência entre fontes, tom opinativo,
//     dado de saúde sem respaldo).
//
// A mesma rubrica está em .claude/skills/criticidade-editorial/SKILL.md
// (para revisão manual com o Claude). Mantenha as duas em sincronia.

export type Nivel = "baixo" | "medio" | "alto" | "critico";
const ORDEM: Nivel[] = ["baixo", "medio", "alto", "critico"];

export function nivelMaior(a: Nivel, b: Nivel): Nivel {
  return ORDEM.indexOf(a) >= ORDEM.indexOf(b) ? a : b;
}
export function atingeLimiar(nivel: Nivel, limiar: Nivel): boolean {
  return ORDEM.indexOf(nivel) >= ORDEM.indexOf(limiar);
}

export const RUBRICA_CRITICIDADE = `Você é o AGENTE DE CRITICIDADE do portal "Vozes Paranaenses". Você não edita
texto: você avalia o RISCO de publicar o texto abaixo SEM revisão humana.

NÍVEIS
- "baixo": serviço, utilidade pública, agenda, informação institucional factual, sem pessoa exposta, sem acusação, sem dado sensível. Publica sozinho.
- "medio": precisa de olho humano antes de sair. Ex.: pessoa identificada em contexto negativo (mesmo sem crime), orientação de saúde com dosagem/tratamento, número relevante sem fonte clara, assunto político-partidário, divergência entre fontes, possível erro factual, tom opinativo/adjetivado, tragédia com vítimas.
- "alto": risco jurídico ou de dano real. Ex.: pessoa nomeada como suspeita/acusada/presa sem condenação; acusação de corrupção/improbidade; menor de idade identificável; suicídio; violência sexual; conteúdo eleitoral (candidato, pesquisa, voto) ou publicidade institucional em período eleitoral; empresa privada acusada de irregularidade.
- "critico": não pode sair de jeito nenhum sem editor. Ex.: nome/foto de vítima de crime sexual ou de menor infrator; informação médica perigosa; acusação grave baseada só em rede social/boato; dado pessoal sensível (CPF, endereço de pessoa física, saúde de pessoa identificada); discurso de ódio.

CHECAGENS OBRIGATÓRIAS
1. Pessoas: há pessoa física identificada? Em que contexto (vítima, suspeito, acusado, autoridade)?
2. Fonte: a afirmação mais forte do texto vem de fonte oficial (prefeitura, polícia, Justiça, órgão público) ou só de terceiros?
3. Presunção de inocência: suspeito/acusado está tratado como "suspeito"/"investigado", nunca como culpado?
4. Menores: há criança ou adolescente identificável (nome, foto, escola, parentes)?
5. Saúde: há orientação que alguém possa seguir e se prejudicar?
6. Eleição/política: cita candidato, partido, pesquisa ou voto? É propaganda de gestão disfarçada?
7. Fidelidade: o texto afirma algo que não está nos fatos apurados (número, cargo, citação)?
8. Tom: há adjetivo, juízo de valor ou sensacionalismo?

Responda APENAS JSON: {"nivel": "baixo|medio|alto|critico", "score": 0-100, "motivos": ["frase curta por risco encontrado"], "pessoas_expostas": true|false}
Sem risco algum: {"nivel": "baixo", "score": 0-15, "motivos": [], "pessoas_expostas": false}.`;

// Gatilhos determinísticos: piso de nível que a IA não consegue baixar.
// Calibrados para NÃO travar pauta de serviço comum: "casos suspeitos de
// dengue", "candidatos do concurso", "vacinação de crianças" e "segunda
// dose" não disparam nada sozinhos.
const POLICIAL = /\b(policia|delegacia|boletim de ocorrencia|flagrante|mandado|operacao|crime|furto|roubo|homicidio|trafico|agressao|acidente)\w*/;
const ELEITORAL = /\b(eleic\w*|eleitora(l|is)|urnas?|tse|tre-pr|pesquisa eleitoral|propaganda eleitoral|horario eleitoral|coligac\w*|partidos?|voto|votacao)\b/;
const CARGO_POLITICO = /\b(prefeit[oa]s?|vice-prefeit[oa]s?|vereador(a|es|as)?|deputad[oa]s?|governador(a|es)?|senador(a|es)?|presidente da republica)\b/;

const GATILHOS: Array<{ nivel: Nivel; motivo: string; teste: (t: string) => boolean }> = [
  {
    nivel: "alto", motivo: "pessoa em contexto policial/judicial",
    teste: (t) => /\b((o|a|os|as|um|uma|dois|duas|tres) suspeit[oa]s?|acusad[oa]s?|denunciad[oa]s?|indiciad[oa]s?|reu|condenad[oa]s?|foragid[oa]s?|pres[oa]s?|detid[oa]s?|autuad[oa]s? em flagrante)\b/.test(t),
  },
  {
    nivel: "alto", motivo: "menor de idade em contexto policial ou trágico",
    teste: (t) => /\b(crianca|adolescente|menor de idade|menor infrator|bebe|recem-nascid[oa])s?\b/.test(t) &&
      (POLICIAL.test(t) || /\b(morre\w*|morte|obito|ferid[oa]|desaparecid[oa]|abus\w*|maus-tratos)\b/.test(t)),
  },
  { nivel: "alto", motivo: "suicídio", teste: (t) => /\bsuicid\w*/.test(t) },
  { nivel: "critico", motivo: "violência sexual", teste: (t) => /\b(estupro|abuso sexual|importunacao sexual|assedio sexual|pedofil\w*)\b/.test(t) },
  {
    nivel: "alto", motivo: "conteúdo eleitoral/político-partidário",
    teste: (t) => ELEITORAL.test(t) || (/\bcandidat\w*/.test(t) && CARGO_POLITICO.test(t)),
  },
  { nivel: "alto", motivo: "acusação de corrupção/improbidade", teste: (t) => /\b(corrupc\w*|improbidade|desvio de (verba|dinheiro|recurso)s?|propina|fraude|superfaturamento|lavagem de dinheiro)\b/.test(t) },
  { nivel: "medio", motivo: "morte/tragédia", teste: (t) => /\b(morre\w*|mort[oa]s?|obitos?|falec\w*|homicidio|assassinat\w*|latrocinio|feminicidio|afogad[oa])\b/.test(t) },
  { nivel: "medio", motivo: "orientação de medicação", teste: (t) => /\b(dosagem|automedicac\w*|tomar (o |a )?(remedio|medicamento)|\d+ ?mg)\b/.test(t) },
  { nivel: "critico", motivo: "dado pessoal sensível", teste: (t) => /\b(cpf|\d{3}\.\d{3}\.\d{3}-\d{2}|portador de hiv|soropositiv\w*)\b/.test(t) },
];

export type ResultadoCriticidade = {
  nivel: Nivel;
  score: number;
  motivos: string[];
  revisao: boolean;
  via: "ia+regras" | "regras";
};

export type ConfigCriticidade = {
  ativo?: boolean;
  limiar_revisao?: Nivel;
  instrucoes_extra?: string | null;
  termos_bloqueio?: string[] | null;
};

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function avaliarRegras(texto: string, cfg?: ConfigCriticidade): { nivel: Nivel; motivos: string[] } {
  const t = normalizar(texto);
  let nivel: Nivel = "baixo";
  const motivos: string[] = [];
  for (const g of GATILHOS) {
    if (g.teste(t)) {
      nivel = nivelMaior(nivel, g.nivel);
      motivos.push(`[regra] ${g.motivo}`);
    }
  }
  for (const termo of cfg?.termos_bloqueio ?? []) {
    if (termo && t.includes(normalizar(termo))) {
      nivel = nivelMaior(nivel, "alto");
      motivos.push(`[regra] termo de bloqueio: ${termo}`);
    }
  }
  return { nivel, motivos };
}

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

/**
 * Avalia o texto final. `fatos` = JSON dos fatos apurados (para checar
 * fidelidade). Se a IA falhar, a decisão fica só com as regras E sobe para
 * "medio" — sem segunda opinião, não publica sozinho.
 */
export async function avaliarCriticidade(
  p: { titulo: string; corpo: string; fatos?: unknown; formato: "materia" | "nota"; categoria?: string | null },
  aiKey: string,
  cfg?: ConfigCriticidade,
): Promise<ResultadoCriticidade> {
  const limiar: Nivel = cfg?.limiar_revisao ?? "medio";
  const regras = avaliarRegras(`${p.titulo}\n${p.corpo}`, cfg);

  if (cfg?.ativo === false) {
    return { nivel: regras.nivel, score: 0, motivos: regras.motivos, revisao: atingeLimiar(regras.nivel, limiar), via: "regras" };
  }

  let sistema = RUBRICA_CRITICIDADE;
  if (cfg?.instrucoes_extra?.trim()) sistema += `\n\nINSTRUÇÕES ATUAIS DA REDAÇÃO:\n${cfg.instrucoes_extra.trim()}`;
  const usuario = `FORMATO: ${p.formato}${p.categoria ? ` · EDITORIA: ${p.categoria}` : ""}
FATOS APURADOS (referência de fidelidade):
${JSON.stringify(p.fatos ?? {}).slice(0, 4000)}

TEXTO A AVALIAR
Título: ${p.titulo}

${p.corpo.slice(0, 9000)}`;

  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      }),
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const j = await res.json();
    const content = String(j?.choices?.[0]?.message?.content ?? "");
    const m = content.match(/\{[\s\S]*\}/);
    const ia = JSON.parse(m ? m[0] : content) as { nivel?: string; score?: number; motivos?: string[] };
    const nivelIa: Nivel = ORDEM.includes(ia.nivel as Nivel) ? (ia.nivel as Nivel) : "medio";
    const nivel = nivelMaior(nivelIa, regras.nivel);
    const motivos = [...regras.motivos, ...(Array.isArray(ia.motivos) ? ia.motivos.map(String).slice(0, 6) : [])];
    const score = Math.max(0, Math.min(100, Number(ia.score) || 0));
    return { nivel, score, motivos, revisao: atingeLimiar(nivel, limiar), via: "ia+regras" };
  } catch (e) {
    const nivel = nivelMaior(regras.nivel, "medio");
    return {
      nivel,
      score: 50,
      motivos: [...regras.motivos, `agente de criticidade indisponível (${(e as Error).message}) — revisão por precaução`],
      revisao: true,
      via: "regras",
    };
  }
}

// deno-lint-ignore no-explicit-any
export async function carregarConfigCriticidade(sb: any): Promise<ConfigCriticidade | undefined> {
  const { data } = await sb
    .from("agente_criticidade")
    .select("ativo, limiar_revisao, instrucoes_extra, termos_bloqueio")
    .eq("singleton", true)
    .maybeSingle();
  return (data ?? undefined) as ConfigCriticidade | undefined;
}
