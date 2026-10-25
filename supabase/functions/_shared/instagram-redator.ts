// Vozes Paranaenses — legenda e campos do card do Instagram.
//
// A IA resume a matéria para o card (título curto, linha-fina) e escreve a
// legenda; no alerta, tira até 3 números-chave e a orientação; no
// tipográfico, um número de destaque. Todo número que a IA põe no card tem
// de estar no texto da matéria (numerosConferem) — senão o campo cai e vale
// o texto original. Sem IA, o card sai com título e subtítulo da matéria.

import { limitar } from "./instagram-cards.ts";
import { numerosConferem, type Classe } from "./instagram-selecao.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type Redacao = {
  titulo: string;
  linhaFina: string | null;
  legenda: string;
  destaque: { valor: string; rotulo: string } | null;
  dados: Array<{ valor: string; unidade?: string; rotulo: string }>;
  quando: string | null;
  orientacao: string | null;
  viaIa: boolean;
};

const PROMPT = `Você edita os posts do Instagram do portal Vozes Paranaenses (@vozesparanaenses).
Regras de texto: só fatos que estão na matéria; frases curtas; verbo no presente; sem adjetivo de valor ("histórico", "polêmico"), sem ponto de exclamação, sem emoji, sem clickbait; nunca comece com "Prefeitura de"; política: atribua cada afirmação a quem fez; tragédia: sóbrio, sem detalhe mórbido, nunca nome de criança ou de vítima.
Responda APENAS JSON:
{"titulo_card":"até 90 caracteres","linha_fina":"até 150 caracteres","legenda":"gancho na 1ª linha + 2 ou 3 frases de resumo, até 450 caracteres, sem hashtags e sem chamada para o link","destaque":{"valor":"número curto que está no texto","rotulo":"até 30 caracteres"} ou null,"dados":[{"valor":"número que está no texto","unidade":"km/h, mm, °C…","rotulo":"até 26 caracteres"}],"quando":"até 24 caracteres (ex.: Sábado e domingo) ou null","orientacao":"orientação ao público que ESTÁ na matéria, até 120 caracteres, ou null"}
- "destaque": só quando um número é o centro da notícia (ex.: 1.000 detidos).
- "dados": só para ALERTA, no máximo 3; senão [].`;

export async function redigir(p: {
  apiKey: string | undefined;
  classe: Classe;
  titulo: string;
  subtitulo: string | null;
  texto: string; // corpo/resumo da matéria (fonte dos números)
}): Promise<Redacao> {
  const fonte = `${p.titulo}\n${p.subtitulo ?? ""}\n${p.texto}`;
  const base: Redacao = {
    titulo: p.titulo,
    linhaFina: p.subtitulo ? limitar(p.subtitulo, 150) : null,
    legenda: [p.titulo, p.subtitulo].filter(Boolean).join("\n\n"),
    destaque: null,
    dados: [],
    quando: null,
    orientacao: null,
    viaIa: false,
  };
  if (!p.apiKey) return base;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: `Tipo do post: ${p.classe.toUpperCase()}\nTítulo: ${p.titulo}\nSubtítulo: ${p.subtitulo ?? ""}\nMatéria:\n${p.texto.slice(0, 5000)}` },
        ],
      }),
    });
    if (!res.ok) return base;
    const j = await res.json();
    const txt = String(j?.choices?.[0]?.message?.content ?? "");
    const r = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? txt);
    return normalizarRedacao(r, base, fonte, p.classe);
  } catch {
    return base;
  }
}

/** Exportado para teste: aplica limites e confere números contra o texto. */
export function normalizarRedacao(r: Record<string, unknown>, base: Redacao, fonte: string, classe: Classe): Redacao {
  const str = (x: unknown) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
  const semEmoji = (s: string) => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/!/g, ".").trim();
  let titulo = semEmoji(str(r.titulo_card));
  if (!titulo || titulo.length > 110 || !numerosConferem(titulo, fonte)) titulo = base.titulo;
  let linhaFina = semEmoji(str(r.linha_fina)) || base.linhaFina || "";
  if (!numerosConferem(linhaFina, fonte)) linhaFina = base.linhaFina ?? "";
  const legendaIa = typeof r.legenda === "string" ? r.legenda.replace(/\r/g, "").replace(/#\S+/g, "").trim() : "";
  const legenda = legendaIa && numerosConferem(legendaIa, fonte) ? semEmoji(legendaIa).slice(0, 600) : base.legenda;

  let destaque: Redacao["destaque"] = null;
  const d = r.destaque as { valor?: unknown; rotulo?: unknown } | null;
  if (d && str(d.valor) && str(d.rotulo) && str(d.valor).length <= 9 && numerosConferem(str(d.valor), fonte)) {
    destaque = { valor: str(d.valor), rotulo: limitar(str(d.rotulo), 30) };
  }
  const dados = classe === "alerta" && Array.isArray(r.dados)
    ? (r.dados as Array<Record<string, unknown>>)
      .map((x) => ({ valor: str(x?.valor), unidade: str(x?.unidade) || undefined, rotulo: limitar(str(x?.rotulo), 26) }))
      .filter((x) => x.valor && x.rotulo && x.valor.length <= 9 && numerosConferem(x.valor, fonte))
      .slice(0, 3)
    : [];
  const orientacao = classe === "alerta" ? limitar(semEmoji(str(r.orientacao)), 140) || null : null;
  const quando = classe === "alerta" ? limitar(str(r.quando), 24) || null : null;
  return { titulo: limitar(titulo, 110), linhaFina: linhaFina ? limitar(linhaFina, 150) : null, legenda, destaque, dados, quando, orientacao, viaIa: true };
}

/**
 * Crédito limpo para o card e a legenda. As capas chegam com sobras da
 * coleta: "Foto: (Foto: Albari Rosa/Arquivo AEN)", "Foto: Divulgação)</p>".
 */
export function limparCredito(c: string | null | undefined): string | null {
  if (!c) return null;
  let t = c.replace(/<[^>]*>?/g, " ").replace(/&lt;[^&]*&gt;/gi, " ").replace(/&[a-z#0-9]+;/gi, " ");
  for (let i = 0; i < 3; i++) t = t.replace(/^\s*[(\[]?\s*(foto|imagem|crédito|credito)\s*:\s*/i, "").trim();
  t = t.replace(/[()\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!t || /gerada por ia|ilustrativa gerada/i.test(t)) return t ? "Ilustração gerada por IA" : null;
  return limitar(t, 60);
}

/** Legenda final: texto + local + crédito + chamada para o link da bio + hashtags. */
export function montarLegenda(p: { texto: string; local?: string | null; credito?: string | null; chamada?: string; hashtags: string[] }): string {
  const credito = limparCredito(p.credito);
  return [
    p.texto.trim(),
    [p.local, credito ? (credito.startsWith("Ilustração") ? credito : `Foto: ${credito}`) : null].filter(Boolean).join("\n"),
    p.chamada ?? "Leia a matéria completa no link da bio.",
    p.hashtags.join(" "),
  ].filter((b) => b && b.trim()).join("\n\n");
}
