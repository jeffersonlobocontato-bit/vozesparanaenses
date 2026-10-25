// Vozes Paranaenses — agente da coluna Vozes Políticas.
//
// O editor cola numa caixa única as pautas da edição, NA ORDEM das notas:
// links de notícia e/ou textos curtos com o tema. Cada pauta vira uma nota.
// O agente da coluna decide o resto: título da edição, linha fina,
// título-gatilho e corpo de cada nota, fechamento opcional e pergunta ao
// leitor. A edição volta como prévia para o editor revisar e pôr fotos.
//
// As instruções do agente ficam em colunas.agente_instrucoes (editáveis no
// painel, aba Identidade); sem nada lá, vale AGENTE_PADRAO. As duas últimas
// edições publicadas entram como referência de ESTILO (nunca de fatos).

export type Pauta = { ordem: number; texto: string; urls: string[] };

export type NotaGerada = { titulo_gatilho: string; corpo: string; pauta: number | null; fechamento: boolean };

export type ColunaGerada = {
  titulo: string;
  subtitulo: string;
  pergunta_engajamento: string | null;
  notas: NotaGerada[];
};

/**
 * Separa as pautas na ordem em que foram escritas. Blocos separados por
 * linha em branco são pautas; se não houver linha em branco, cada linha é
 * uma pauta. Numeração ("1.", "2)", "-") é ignorada.
 */
export function separarPautas(texto: string): Pauta[] {
  const limpo = (texto ?? "").replace(/\r/g, "").trim();
  if (!limpo) return [];
  let blocos = limpo.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocos.length === 1) blocos = blocos[0].split("\n").map((l) => l.trim()).filter(Boolean);
  return blocos.map((b, i) => {
    const t = b.replace(/^\s*(?:\d{1,2}\s*[.)\-–:]|[-–•*])\s+/, "").trim();
    const urls = [...new Set(t.match(/https?:\/\/[^\s<>"')]+/gi) ?? [])].map((u) => u.replace(/[.,;]+$/, ""));
    return { ordem: i + 1, texto: t, urls };
  });
}

export const AGENTE_PADRAO = `Você é o colunista da Vozes Políticas, a coluna de bastidores da política paranaense do portal Vozes Paranaenses.

VOZ
- Bastidor com ironia fina e frase curta. Ritmo de conversa de quem acompanha o poder de perto.
- Parágrafos de uma ou duas frases, muitas vezes uma frase só. Quebra de linha entre eles.
- Imagens e expressões do jogo político ("tabuleiro", "virar a casaca", "o silêncio é o barulho mais alto") usadas com parcimônia — no máximo uma por nota.
- A ironia vale para todos os lados. Nenhum personagem é poupado nem perseguido.

ESTRUTURA DA EDIÇÃO
- Título da edição: uma frase com gancho que amarra os temas da semana (até 90 caracteres).
- Linha fina: uma ou duas frases que situam o leitor no momento político.
- Uma nota por pauta, na ordem em que as pautas vieram.
- Título-gatilho de cada nota: curto (2 a 7 palavras), com jogo de palavras ou contraste ("No ar, sob investigação", "Porta fechada").
- Corpo de cada nota: 60 a 160 palavras. Abre pelo fato, fecha com a leitura política.
- Pode terminar com uma nota de fechamento curta que amarra a edição ("O tabuleiro", "O que vem por aí") — só se as pautas pedirem.
- Pergunta ao leitor: opcional, uma pergunta aberta que provoque comentário sem induzir voto.

CUIDADOS (período eleitoral e responsabilidade jurídica)
- Só use fatos que estão nas pautas e nos textos das fontes. Não invente número, data, cargo, citação ou bastidor.
- Citação entre aspas só se ela estiver literalmente na fonte. Bastidor sem fonte vira "dizem os bem informados" apenas quando a própria pauta trouxer a informação como bastidor.
- Denúncia é denúncia: "é investigado", "a apuração dirá" — nunca trate acusação como fato provado.
- Atribua decisões e informações ("segundo decisão do TRE-PR", "segundo o Tribunal de Contas", "segundo a imprensa").
- Nada de pedido de voto, de pesquisa não registrada ou de ofensa pessoal. Crítica é ao ato, não à pessoa.`;

export function textoDaPagina(html: string): { titulo: string; descricao: string; texto: string } {
  const meta = (nome: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nome}["']`, "i"))?.[1] ?? "";
  const titulo = meta("og:title") || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const descricao = meta("og:description") || meta("description");
  // Corpo: prefere <article>; senão, os parágrafos da página.
  const artigo = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const paragrafos = [...artigo.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decod(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
  return { titulo: decod(titulo).trim(), descricao: decod(descricao).trim(), texto: paragrafos.join("\n").slice(0, 6000) };
}

function decod(s: string): string {
  const ent: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ccedil: "ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", hellip: "…" };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ent[n] ?? m);
}

/** Endereço público (não deixa a função buscar rede interna). */
export function urlPermitida(u: string): boolean {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Valida a resposta da IA: uma nota por pauta, na ordem; fechamento opcional no fim. */
export function normalizarColuna(raw: unknown, totalPautas: number): ColunaGerada | null {
  const r = raw as Partial<{ titulo: string; subtitulo: string; pergunta_engajamento: string | null; notas: Array<Partial<NotaGerada>> }>;
  if (!r || typeof r.titulo !== "string" || !Array.isArray(r.notas)) return null;
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const notas: NotaGerada[] = r.notas
    .map((n) => ({
      titulo_gatilho: str(n?.titulo_gatilho),
      corpo: str(n?.corpo).replace(/\n{3,}/g, "\n\n"),
      pauta: Number.isInteger(n?.pauta) ? (n!.pauta as number) : null,
      fechamento: n?.fechamento === true,
    }))
    .filter((n) => n.titulo_gatilho && n.corpo);
  const dasPautas = notas.filter((n) => !n.fechamento);
  const fechamento = notas.filter((n) => n.fechamento).slice(0, 1);
  // Ordem das pautas manda: ordena pelo número da pauta quando ele veio.
  dasPautas.sort((a, b) => (a.pauta ?? 99) - (b.pauta ?? 99));
  if (dasPautas.length < Math.min(totalPautas, 1)) return null;
  return {
    titulo: str(r.titulo).slice(0, 140),
    subtitulo: str(r.subtitulo).slice(0, 400),
    pergunta_engajamento: str(r.pergunta_engajamento) || null,
    notas: [...dasPautas.slice(0, Math.max(totalPautas, 1)), ...fechamento],
  };
}

export type ExemploEdicao = { titulo: string; subtitulo: string | null; notas: Array<{ titulo_gatilho: string; corpo: string }> };

export function montarPrompt(p: {
  agente: string;
  exemplos: ExemploEdicao[];
  pautas: Array<Pauta & { fontes: Array<{ url: string; titulo: string; descricao: string; texto: string; erro?: string }> }>;
}): { system: string; user: string } {
  const exemplos = p.exemplos.length
    ? p.exemplos
        .map((e, i) => `EDIÇÃO DE REFERÊNCIA ${i + 1} (só estilo — NÃO reaproveite fatos daqui)\nTítulo: ${e.titulo}\nLinha fina: ${e.subtitulo ?? ""}\n${e.notas.map((n) => `## ${n.titulo_gatilho}\n${n.corpo}`).join("\n\n")}`)
        .join("\n\n-----\n\n")
    : "(sem edições anteriores)";
  const pautas = p.pautas
    .map((pa) => {
      const fontes = pa.fontes.length
        ? pa.fontes
            .map((f) => (f.erro ? `Fonte ${f.url}: não foi possível ler (${f.erro}). Use só o texto da pauta.` : `Fonte ${f.url}\nTítulo: ${f.titulo}\nResumo: ${f.descricao}\nTexto:\n${f.texto}`))
            .join("\n\n")
        : "(sem link — use o texto da pauta)";
      return `PAUTA ${pa.ordem}\nO editor escreveu: ${pa.texto}\n${fontes}`;
    })
    .join("\n\n=====\n\n");

  const system = `${p.agente}

FORMATO DA RESPOSTA
Responda APENAS com JSON:
{"titulo":"...","subtitulo":"...","pergunta_engajamento":"... ou null","notas":[{"pauta":1,"titulo_gatilho":"...","corpo":"parágrafos separados por \\n","fechamento":false}]}
- Exatamente uma nota por pauta, com "pauta" igual ao número dela, na mesma ordem.
- Se fizer nota de fechamento, ela vem por último com "pauta": null e "fechamento": true.
- O que o editor escreveu na pauta (ângulo, opinião, ironia pedida) orienta a nota; os fatos vêm das fontes.`;

  const user = `${exemplos}\n\n#####\n\nPAUTAS DESTA EDIÇÃO, NA ORDEM DAS NOTAS (${p.pautas.length}):\n\n${pautas}`;
  return { system, user };
}
