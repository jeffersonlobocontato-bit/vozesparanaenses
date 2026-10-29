// Vozes Paranaenses — analista de risco de imagem (nacional e internacional)
//
// Nacional e internacional saem só com texto (fotos de G1, CNN, AFP, Reuters
// têm dono). Para essas editorias também aparecerem na PRIMEIRA DOBRA da
// home, a analista escolhe ao menos 1 matéria nacional e 1 internacional
// (temas gerais e política — fora esportes e tecnologia) e procura para ela
// uma imagem de risco BAIXO:
//
//   1. foto do Wikimedia Commons com licença livre (CC0, domínio público,
//      CC BY, CC BY-SA) do LUGAR ou da INSTITUIÇÃO do assunto — Congresso,
//      Planalto, STF, a capital ou um prédio oficial do país, a sede do
//      órgão. A analista (IA) propõe as buscas e depois OLHA cada foto e dá
//      a nota de risco;
//   2. se nenhuma foto for de risco baixo e o tema não for sensível:
//      ilustração editorial por IA (gerada só do tema, identificada).
//
// Critérios de risco (o que a analista avalia em cada foto):
//   - licença livre e autor identificado (filtrado antes, deterministicamente);
//   - sem crianças; sem vítimas, feridos, mortos, violência ou armas;
//   - sem pessoa identificável que não seja figura pública no papel
//     público dela, e nunca pessoa ligada a acusação/crime/escândalo;
//   - a foto não pode parecer registro do fato (não engana o leitor): é
//     ilustrativa — prédio, lugar, símbolo institucional;
//   - coerência com o tema (não ilustra guerra com cartão-postal).
// Tema sensível (morte, guerra, crime, tragédia, vítimas) → sem foto real e
// sem ilustração: a matéria fica só com texto (não vai para a dobra).

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type Risco = "baixo" | "medio" | "alto";

export type PlanoImagem = {
  tema_sensivel: boolean;
  buscas: string[]; // até 2 buscas para o Commons (lugar/instituição)
  motivo: string;
};

export type AvaliacaoFoto = { indice: number; risco: Risco; motivos: string[] };

const PLANO_PROMPT = `Você é a analista de imagens de um portal de notícias. Para a matéria abaixo, planeje uma imagem ILUSTRATIVA de baixo risco jurídico.
- "tema_sensivel": true se a matéria trata de morte, guerra, ataque, crime, acidente, tragédia com vítimas, abuso ou doença grave de pessoa identificada.
- "buscas": até 2 termos de busca para o Wikimedia Commons (prefira inglês, que tem mais resultado), escolhendo o tipo certo:
  • matéria sobre governo, órgão ou instituição → o LUGAR ou a SEDE (ex.: "Palácio do Planalto", "Congresso Nacional Brasília", "Supremo Tribunal Federal building", "United Nations headquarters New York");
  • matéria de TEMA geral (clima, chuva, enchente, seca, frio, agricultura, safra, energia, trânsito, rodovia, saúde pública, educação, economia) → uma CENA GENÉRICA do tema, sem pessoas em destaque (ex.: "heavy rain street Brazil", "flooded street", "storm clouds sky", "soybean field Paraná", "highway traffic Brazil", "hospital corridor", "classroom empty", "hydroelectric dam").
  NÃO busque pessoas, rostos, crianças, multidões nem o registro do próprio fato da matéria.
- "motivo": até 15 palavras.
Retorne APENAS JSON: {"tema_sensivel": true|false, "buscas": ["..."], "motivo": "..."}`;

const AVALIACAO_PROMPT = `Você é a analista de risco de imagens de um portal de notícias. Avalie cada foto candidata (todas com licença livre do Wikimedia Commons) para ilustrar a matéria indicada. Dê "risco":
- "alto" se houver: criança; vítima, ferido, morto, violência ou arma; pessoa identificável que não seja figura pública no papel público dela; pessoa associada a acusação, crime ou escândalo; marca comercial em destaque; texto/placa que identifique outro lugar ou data como se fosse o fato da matéria; ou se a foto não tiver relação com o tema.
- "medio" se houver pessoas reconhecíveis ao fundo, multidão, baixa qualidade (escura, borrada, pequena) ou relação fraca com o tema.
- "baixo" se for um lugar, prédio, monumento ou símbolo institucional ligado ao assunto, OU uma cena genérica do tema (chuva, rua alagada, céu de tempestade, lavoura, rodovia, sala de aula, hospital), de boa qualidade, sem pessoas em destaque.
Retorne APENAS JSON: {"avaliacoes": [{"indice": 0, "risco": "baixo"|"medio"|"alto", "motivos": ["..."]}]}`;

async function chamarIa(apiKey: string, messages: unknown[], maxTokens = 400): Promise<string | null> {
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: maxTokens, response_format: { type: "json_object" }, messages }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return String(j?.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  }
}

function jsonDe<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as T;
  } catch {
    return null;
  }
}

/** Passo 1: tema sensível? que lugar/instituição buscar? */
export async function planejarImagem(apiKey: string, materia: { titulo: string; resumo: string | null; escopo: string }): Promise<PlanoImagem> {
  const raw = await chamarIa(apiKey, [
    { role: "system", content: PLANO_PROMPT },
    { role: "user", content: `Editoria: ${materia.escopo}\nTítulo: ${materia.titulo}\nResumo: ${(materia.resumo ?? "").slice(0, 800)}` },
  ]);
  return normalizarPlano(jsonDe<Partial<PlanoImagem>>(raw));
}

/** Exportado para teste: plano inválido vira "sensível" (na dúvida, sem imagem). */
export function normalizarPlano(p: Partial<PlanoImagem> | null): PlanoImagem {
  if (!p) return { tema_sensivel: true, buscas: [], motivo: "análise indisponível" };
  const buscas = Array.isArray(p.buscas)
    ? p.buscas.filter((b): b is string => typeof b === "string" && b.trim().length > 2).map((b) => b.trim().slice(0, 80)).slice(0, 2)
    : [];
  return { tema_sensivel: p.tema_sensivel !== false, buscas, motivo: typeof p.motivo === "string" ? p.motivo.slice(0, 200) : "" };
}

/** Passo 2: a analista OLHA as fotos candidatas e dá a nota de risco. */
export async function avaliarFotos(
  apiKey: string,
  materia: { titulo: string; resumo: string | null },
  fotos: Array<{ url: string; titulo: string; descricao: string }>,
): Promise<AvaliacaoFoto[]> {
  if (!fotos.length) return [];
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Matéria: ${materia.titulo}\n${(materia.resumo ?? "").slice(0, 600)}\n\nFotos candidatas:` },
  ];
  fotos.forEach((f, i) => {
    content.push({ type: "text", text: `Foto ${i} — arquivo "${f.titulo}". ${f.descricao}` });
    content.push({ type: "image_url", image_url: { url: f.url } });
  });
  const raw = await chamarIa(apiKey, [{ role: "system", content: AVALIACAO_PROMPT }, { role: "user", content }], 600);
  return normalizarAvaliacoes(jsonDe<{ avaliacoes?: Partial<AvaliacaoFoto>[] }>(raw), fotos.length);
}

/** Exportado para teste: o que não veio avaliado conta como risco alto. */
export function normalizarAvaliacoes(r: { avaliacoes?: Partial<AvaliacaoFoto>[] } | null, total: number): AvaliacaoFoto[] {
  const porIndice = new Map<number, AvaliacaoFoto>();
  for (const a of r?.avaliacoes ?? []) {
    const i = Number(a.indice);
    if (!Number.isInteger(i) || i < 0 || i >= total) continue;
    const risco: Risco = a.risco === "baixo" || a.risco === "medio" ? a.risco : "alto";
    porIndice.set(i, { indice: i, risco, motivos: Array.isArray(a.motivos) ? a.motivos.map(String).slice(0, 5) : [] });
  }
  return Array.from({ length: total }, (_, i) => porIndice.get(i) ?? { indice: i, risco: "alto", motivos: ["sem avaliação"] });
}

/** Primeira foto de risco BAIXO (as candidatas já vêm por qualidade). */
export function escolherFotoBaixoRisco(avaliacoes: AvaliacaoFoto[]): number | null {
  return avaliacoes.find((a) => a.risco === "baixo")?.indice ?? null;
}

/**
 * A "foto" é na verdade uma arte de divulgação (cartaz, aviso com texto e
 * logo, card de prefeitura)? Arte não serve de foto no Instagram. Na dúvida
 * ou com a IA fora do ar, trata como foto (false).
 */
export async function ehArteDeDivulgacao(apiKey: string, url: string): Promise<boolean> {
  const raw = await chamarIa(apiKey, [
    { role: "system", content: "Você classifica imagens de notícias. Responda só JSON {\"arte\": true|false}. arte = true quando a imagem é uma peça gráfica de divulgação (cartaz, aviso, banner, card com texto grande, logotipo ou layout montado) e não uma fotografia de pessoas, lugares ou acontecimentos. Foto com uma marca d'água pequena continua sendo foto (false)." },
    { role: "user", content: [{ type: "text", text: "Esta imagem é arte de divulgação?" }, { type: "image_url", image_url: { url } }] },
  ], 60);
  const r = jsonDe<{ arte?: boolean }>(raw);
  return r?.arte === true;
}

/**
 * Compliance da capa: só FOTO LIMPA vira capa. Reprova (false) quando há
 * logomarca, marca d'água, selo, assinatura ou nome de veículo de comunicação,
 * portal, emissora, prefeitura ou empresa em qualquer parte da imagem (mesmo
 * pequeno num canto), texto sobreposto, moldura/arte montada, print de tela ou
 * imagem só de texto. Aprova (true) só fotografia sem nenhuma marca.
 * null = IA fora do ar ou resposta ilegível (quem chama decide).
 */
export async function fotoLimpa(apiKey: string, url: string): Promise<boolean | null> {
  const raw = await chamarIa(apiKey, [
    { role: "system", content: "Você é o compliance de imagens de um portal de notícias. Responda só JSON {\"limpa\": true|false, \"motivo\": \"...\"}. limpa = true SOMENTE se for uma fotografia sem nenhuma marca. limpa = false se houver, em QUALQUER parte da imagem, mesmo pequeno ou num canto: logomarca, marca d'água, selo, assinatura, nome ou endereço de site de jornal, portal, emissora de rádio/TV, prefeitura, órgão ou empresa; texto sobreposto (manchete, legenda dentro da imagem, tarja); moldura ou arte montada; card de rede social; print de tela; ou se a imagem for só logo ou texto. Placas e fachadas que fazem parte da cena fotografada não contam como marca." },
    { role: "user", content: [{ type: "text", text: "Esta imagem é uma foto limpa, sem nenhuma logomarca, marca d'água ou nome de veículo?" }, { type: "image_url", image_url: { url } }] },
  ], 80);
  const r = jsonDe<{ limpa?: boolean }>(raw);
  return typeof r?.limpa === "boolean" ? r.limpa : null;
}

/** Compatibilidade: logomarca/marca/nome na imagem (fail-open). */
export async function ehLogomarca(apiKey: string, url: string): Promise<boolean> {
  return (await fotoLimpa(apiKey, url)) === false;
}

/**
 * Foto de PREFEITURA: onde estão as marcas? A foto publica sempre; a marca é
 * recortada quando der (ver _shared/recorte-marca.ts). "nao_e_foto" = a
 * imagem é só logo/brasão/texto/arte — essa não vira capa.
 * null = IA fora do ar (a foto entra como está).
 */
export async function analisarMarcas(apiKey: string, url: string): Promise<
  { tipo: "foto_limpa" | "foto_com_marca" | "nao_e_foto"; marcas: { x: number; y: number; w: number; h: number }[] } | null
> {
  const raw = await chamarIa(apiKey, [
    { role: "system", content: "Você analisa a imagem de capa de uma notícia de prefeitura. Responda só JSON {\"tipo\": \"foto_limpa\" | \"foto_com_marca\" | \"nao_e_foto\", \"marcas\": [{\"x\":0-1,\"y\":0-1,\"w\":0-1,\"h\":0-1}]}. nao_e_foto = a imagem é principalmente logomarca, brasão, nome da instituição, cartaz, arte montada ou texto sobre fundo. foto_com_marca = fotografia com logomarca, marca d'água, selo, nome/site da prefeitura ou de veículo, ou texto sobreposto em alguma parte; liste em marcas a caixa de CADA uma (x, y = canto superior esquerdo; w, h = largura e altura; tudo em fração da imagem, 0 a 1), com folga. foto_limpa = fotografia sem nenhuma marca (marcas vazio). Placas e fachadas da cena não contam como marca." },
    { role: "user", content: [{ type: "text", text: "Classifique a imagem e localize as marcas." }, { type: "image_url", image_url: { url } }] },
  ], 300);
  const r = jsonDe<{ tipo?: string; marcas?: { x: number; y: number; w: number; h: number }[] }>(raw);
  if (!r || !["foto_limpa", "foto_com_marca", "nao_e_foto"].includes(r.tipo ?? "")) return null;
  const marcas = (r.marcas ?? []).filter((m) =>
    [m.x, m.y, m.w, m.h].every((v) => typeof v === "number" && v >= 0 && v <= 1) && m.w > 0 && m.h > 0
  );
  return { tipo: r.tipo as "foto_limpa" | "foto_com_marca" | "nao_e_foto", marcas };
}
