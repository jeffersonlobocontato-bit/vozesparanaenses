// Duplicidade entre o que o assessor enviou e o que o portal já publicou
// (a varredura automática dos sites das prefeituras costuma chegar antes).
// Compara palavras significativas e números do título/subtítulo enviados com
// o título/resumo das matérias recentes da mesma cidade.

const STOP = new Set([
  "para", "pelo", "pela", "pelos", "pelas", "como", "mais", "sobre", "entre", "apos", "desde",
  "ate", "com", "sem", "dos", "das", "nos", "nas", "que", "uma", "uns", "umas", "seu", "sua",
  "seus", "suas", "este", "esta", "esse", "essa", "isso", "prefeitura", "municipio", "municipal",
  "cidade", "parana", "governo", "secretaria", "anuncia", "realiza", "promove", "abre", "sera",
  "serao", "ser", "tem", "terao", "novo", "nova", "novos", "novas",
  // esporte: o que distingue um jogo do outro são os times, não estas
  "rodada", "serie", "campeonato", "brasileiro", "brasileirao", "jogam", "joga", "jogo", "jogos",
  "partida", "enfrenta", "enfrentam", "duelam", "duela", "recebe", "visita", "vence", "perde",
  "empata", "premier", "league", "ingles", "liga", "copa", "temporada", "clube", "time", "times",
  "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "setima", "oitava", "nona", "decima",
]);

// Títulos raspados às vezes chegam com entidades HTML ("milh&#227;o").
function decodificarEntidades(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
}

/**
 * Termos significativos, reduzidos a um radical de 5 letras para casar
 * flexões ("apreende" / "apreendem"). Números ficam inteiros.
 */
export function termos(texto: string): Set<string> {
  const t = decodificarEntidades(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const palavras = t.replace(/[^a-z0-9,]+/g, " ").split(/\s+/)
    .map((w) => w.replace(/,+$/, ""))
    // números de 1–2 dígitos ("35ª rodada", "10 km") são genéricos; "13,8" e "2026" ficam
    .filter((w) => (/\d/.test(w) ? w.length >= 3 : w.length >= 4) && !STOP.has(w))
    .map((w) => (/\d/.test(w) ? w : w.slice(0, 5)));
  return new Set(palavras);
}

/** Proporção dos termos do envio que aparecem na matéria publicada (0–1). */
export function semelhanca(enviado: string, publicado: string): { indice: number; comuns: number } {
  const a = termos(enviado);
  const b = termos(publicado);
  if (a.size === 0 || b.size === 0) return { indice: 0, comuns: 0 };
  let comuns = 0;
  for (const w of a) if (b.has(w)) comuns++;
  return { indice: comuns / Math.min(a.size, b.size), comuns };
}

export function ehDuplicata(enviado: string, publicado: string): boolean {
  const { indice, comuns } = semelhanca(enviado, publicado);
  return comuns >= 4 && indice >= 0.45;
}

/** Filtro barato de candidatos: termos-chave em comum (antes de perguntar à IA). */
export function candidatoDuplicata(a: string, b: string): boolean {
  return semelhanca(a, b).comuns >= 2;
}

/**
 * Agente juiz: as duas notícias relatam o MESMO fato (mesmo acontecimento,
 * mesmo lugar, mesma data), só escritas por veículos diferentes? Notícias do
 * mesmo tema (dois acidentes, dois jogos da rodada, dois atos de campanha)
 * NÃO são o mesmo fato. Falha da IA = "não" (nunca junta nem descarta à toa).
 */
export async function mesmoFato(a: string, b: string, aiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: 'Você compara duas notícias. Responda só JSON {"mesmo_fato": true|false}. ' +
              "true SOMENTE se as duas relatam o MESMO acontecimento concreto (mesmo evento, mesmo lugar, mesma data/ocasião), " +
              "ainda que com palavras, números arredondados ou fontes diferentes. " +
              "false se forem acontecimentos diferentes do mesmo tema (dois acidentes, dois jogos, duas operações, dois atos de campanha) " +
              "ou desdobramentos diferentes de um assunto.",
          },
          { role: "user", content: `NOTÍCIA A:\n${a.slice(0, 1500)}\n\nNOTÍCIA B:\n${b.slice(0, 1500)}` },
        ],
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const j = JSON.parse(String(data?.choices?.[0]?.message?.content ?? "{}").replace(/^```json\s*|```$/g, "").trim());
    return j.mesmo_fato === true;
  } catch {
    return false;
  }
}
