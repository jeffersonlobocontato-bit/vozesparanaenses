// Vozes Paranaenses — robô do Instagram (@vozesparanaenses): o que entra,
// com que peso e em que horário.
//
// CLASSES (cada matéria cai em uma):
//   alerta        — utilidade pública urgente (Defesa Civil, temporal,
//                   interdição, falta d'água, vacinação…): passa à frente.
//   tragedia      — calamidade, acidente grave, mortes: prioridade, card SEM
//                   foto (tipográfico), nunca imagem de vítima.
//   seguranca     — polícia e fiscalização.
//   nacional / internacional — curadoria de impacto (sem esporte).
//   destaque      — matéria regional com FOTO REAL (não ilustração): vai
//                   sozinha para o feed. Os portais de maior audiência
//                   publicam foto em tela cheia; card sem foto não para o dedo.
//   regional      — as 10 regiões do PR sem foto: vão para o carrossel
//                   "Giro pelo Paraná" (até 10 regiões, a mais forte de cada).
//   fora          — política/eleição (nunca no automático), criticidade
//                   alta/crítica, propaganda de governo, esporte, tecnologia.
//
// PESO = crivo (prioridade e tema) + urgência + audiência (cresce com o
// tráfego do site) + frescor + imagem utilizável + 20 maiores cidades.
//
// HORÁRIO: um post por vez, com intervalo mínimo entre eles (alerta só
// precisa do intervalo curto), dentro da janela do dia e até o teto diário.

export type Classe = "alerta" | "tragedia" | "seguranca" | "nacional" | "internacional" | "destaque" | "regional" | "fora";

export type MateriaIG = {
  id: string;
  titulo: string;
  subtitulo?: string | null;
  regiao_slug: string | null;
  categoria_slug: string | null;
  cidade_principal?: string | null;
  imagem_capa_url?: string | null;
  foto_origem?: string | null;
  imagem_credito?: string | null;
  publicado_em: string;
  prioridade_crivo?: string | null;
  tema_crivo?: string | null;
  criticidade_nivel?: string | null;
  destaque_home?: boolean | null;
  visitas?: number; // visitas da página da matéria (analytics_events)
};

export type ConfigIG = {
  intervalo_min: number; // entre dois posts quaisquer
  intervalo_alerta_min: number; // antes de um alerta
  teto_dia: number; // posts de feed por dia
  janela_inicio: number; // hora (Brasília)
  janela_fim: number;
  cotas: Partial<Record<"alerta" | "tragedia" | "seguranca" | "nacional" | "internacional" | "destaque", number>>;
  politica_auto: boolean;
};

export const CONFIG_PADRAO: ConfigIG = {
  intervalo_min: 75,
  intervalo_alerta_min: 30,
  teto_dia: 8,
  janela_inicio: 7,
  janela_fim: 22,
  cotas: { alerta: 3, tragedia: 2, seguranca: 2, nacional: 2, internacional: 1, destaque: 4 },
  politica_auto: false,
};

const REGIOES_PR = new Set([
  "metropolitana", "litoral", "campos-gerais", "norte-pioneiro", "norte-central",
  "noroeste", "centro-ocidental", "oeste", "sudoeste", "centro-sul",
]);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const RE_ALERTA = /\b(alertas?|defesa civil|tempora(?:l|is)|tempestades?|granizo|vendava(?:l|is)|ciclones?|interdi\w*|bloquei\w*|evacua\w*|falta d.?agua|desabastec\w*|racionamento|vacina\w*|risco de|avisos? meteorolog\w*|alagamentos?|enchentes?|deslizamentos?|queda de barreiras?)\b/;
const RE_TRAGEDIA = /\b(morre\w*|morte|mortos?|obito|vitimas? fata\w*|desaba\w*|soterr\w*|tragedia|calamidade|afoga\w*|incendio)\b/;
// Segurança vai sozinha para o feed só com fato de interesse público (operação,
// apreensão, prisão, crime grave). Briga, ameaça e furto miúdo ficam para o Giro.
const RE_SEGURANCA_IMPACTO = /\b(operac\w*|apreen\w*|apreend\w*|pres[oa]s?|prisao|prisoes|quadrilha|faccao|trafico|contrabando\w*|descaminho|homicidio|latrocinio|policia federal|receita federal|gaeco|mandados?)\b/;
// Alerta só vale enquanto é atual: depois disso o "alerta" já é notícia velha.
export const ALERTA_VALIDADE_H = 6;
// Matéria marcada como "nacional" que na verdade é do Paraná (ex.: Cataratas).
const RE_PARANA = /\b(parana|paranaense\w*|curitiba|foz do iguacu|cataratas do iguacu|londrina|maringa|cascavel|ponta grossa)\b/;

const RE_VITIMA = /\b(morre\w*|morte|mortos?|obito|vitima\w*|ferid\w*|corpo|afoga\w*|soterr\w*)\b/;

/** Em que classe a matéria cai, e por quê (o motivo aparece no painel). */
export function classificar(m: MateriaIG, cfg: ConfigIG = CONFIG_PADRAO, agora?: Date): { classe: Classe; motivo: string } {
  const cat = m.categoria_slug ?? "";
  const texto = norm(`${m.titulo} ${m.subtitulo ?? ""}`);
  const crit = m.criticidade_nivel ?? "";
  if ((cat === "politica" || cat.startsWith("eleicoes")) && !cfg.politica_auto) return { classe: "fora", motivo: "política/eleição não vai no automático" };
  if (crit === "alto" || crit === "critico") return { classe: "fora", motivo: `criticidade ${crit}` };
  if (m.tema_crivo === "propaganda_governo") return { classe: "fora", motivo: "propaganda de governo" };
  if (cat === "esportes" || cat === "tecnologia") return { classe: "fora", motivo: `editoria ${cat} fora do feed` };

  if (RE_TRAGEDIA.test(texto) && m.prioridade_crivo === "alta") return { classe: "tragedia", motivo: "calamidade/tragédia" };
  const horas = agora ? (agora.getTime() - new Date(m.publicado_em).getTime()) / 3_600_000 : 0;
  if (RE_ALERTA.test(texto) && (m.tema_crivo === "utilidade_publica" || m.prioridade_crivo === "alta") && horas <= ALERTA_VALIDADE_H) return { classe: "alerta", motivo: "alerta de utilidade pública" };
  if (m.regiao_slug === "internacional" || cat === "internacional") return { classe: "internacional", motivo: "internacional" };
  if (m.regiao_slug === "nacional") return { classe: "nacional", motivo: "nacional" };
  if ((m.tema_crivo === "seguranca" || cat === "seguranca") && RE_SEGURANCA_IMPACTO.test(texto)) return { classe: "seguranca", motivo: "segurança" };
  if (m.regiao_slug && REGIOES_PR.has(m.regiao_slug)) {
    if (fotoReal(m) && m.prioridade_crivo !== "baixa" && !RE_VITIMA.test(texto)) return { classe: "destaque", motivo: "regional com foto" };
    return { classe: "regional", motivo: "regional" };
  }
  return { classe: "fora", motivo: "sem região" };
}

/** Foto de verdade (prefeitura, agência, Commons), não ilustração de IA. */
export function fotoReal(m: MateriaIG): boolean {
  return !!m.imagem_capa_url && m.foto_origem !== "ilustracao_ia" && !/ilustracao-ia/.test(m.imagem_capa_url);
}

/** A foto da matéria pode ir para o card? (tragédia nunca leva foto; alerta leva, se não for de vítima) */
export function temFotoUtilizavel(m: MateriaIG, classe: Classe): boolean {
  if (!m.imagem_capa_url) return false;
  if (classe === "tragedia") return false;
  if (RE_VITIMA.test(norm(`${m.titulo} ${m.subtitulo ?? ""}`))) return false;
  return true;
}

/**
 * Peso da matéria. `trafegoDia` = visitas no site nas últimas 24h: com
 * pouco tráfego a audiência quase não pesa (o número de visitas de uma
 * matéria é ruído); o peso cresce até 25 pontos com o volume.
 */
export function pontuar(m: MateriaIG, classe: Classe, ctx: { agora: Date; maxVisitas: number; trafegoDia: number }): number {
  let p = 0;
  p += m.prioridade_crivo === "alta" ? 30 : m.prioridade_crivo === "media" ? 15 : m.prioridade_crivo === "baixa" ? 5 : 10;
  p += m.tema_crivo === "utilidade_publica" ? 15 : m.tema_crivo === "seguranca" ? 8 : m.tema_crivo === "servico" ? 6 : 0;
  if (classe === "alerta") p += 60;
  if (classe === "tragedia") p += 45;
  const pesoAudiencia = Math.min(25, ctx.trafegoDia / 40);
  if (ctx.maxVisitas > 0) p += pesoAudiencia * ((m.visitas ?? 0) / ctx.maxVisitas);
  const horas = Math.max(0, (ctx.agora.getTime() - new Date(m.publicado_em).getTime()) / 3_600_000);
  p -= Math.min(30, horas * 1.5);
  if (m.imagem_capa_url) p += fotoReal(m) ? 18 : 3;
  if (m.destaque_home) p += 5;
  return Math.round(p * 10) / 10;
}

export type Escolha = { materia: MateriaIG; classe: Classe; score: number };

/**
 * Escolhe os posts avulsos do ciclo: respeita as cotas do dia (já usadas em
 * `usadosHoje`) e o teto diário. Regionais não entram aqui (vão para o Giro).
 */
export function escolherAvulsos(
  candidatas: MateriaIG[],
  usadosHoje: Partial<Record<Classe, number>> & { total?: number },
  cfg: ConfigIG,
  ctx: { agora: Date; maxVisitas: number; trafegoDia: number },
  reservaGiro = 1,
): Escolha[] {
  const avaliadas = candidatas
    .map((m) => {
      const { classe } = classificar(m, cfg, ctx.agora);
      return { materia: m, classe, score: pontuar(m, classe, ctx) };
    })
    .filter((e) => e.classe !== "fora" && e.classe !== "regional")
    .sort((a, b) => b.score - a.score);

  const usados: Record<string, number> = { ...usadosHoje } as Record<string, number>;
  let total = usadosHoje.total ?? 0;
  const vagas = Math.max(0, cfg.teto_dia - reservaGiro);
  const saida: Escolha[] = [];
  for (const e of avaliadas) {
    if (total >= vagas && e.classe !== "alerta") continue; // alerta fura o teto
    const k = e.classe as keyof ConfigIG["cotas"];
    const cota = cfg.cotas[k] ?? CONFIG_PADRAO.cotas[k] ?? 0;
    if ((usados[e.classe] ?? 0) >= cota) continue;
    usados[e.classe] = (usados[e.classe] ?? 0) + 1;
    total++;
    saida.push(e);
  }
  return saida;
}

/** O Giro: a matéria mais forte de cada região (até `max`), as com foto primeiro no empate. */
export function montarGiro(
  candidatas: MateriaIG[],
  cfg: ConfigIG,
  ctx: { agora: Date; maxVisitas: number; trafegoDia: number },
  max = 10,
  scoreMinimo = 10,
): Escolha[] {
  const porRegiao = new Map<string, Escolha>();
  for (const m of candidatas) {
    const { classe } = classificar(m, cfg, ctx.agora);
    if ((classe !== "regional" && classe !== "destaque") || !m.regiao_slug) continue;
    const e = { materia: m, classe, score: pontuar(m, classe, ctx) };
    if (e.score < scoreMinimo) continue;
    const atual = porRegiao.get(m.regiao_slug);
    if (!atual || e.score > atual.score || (e.score === atual.score && !!m.imagem_capa_url && !atual.materia.imagem_capa_url)) {
      porRegiao.set(m.regiao_slug, e);
    }
  }
  return [...porRegiao.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** Hora (0–23) em Brasília. */
function horaSP(d: Date): number {
  return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d));
}

/**
 * Próximo horário livre: depois do último post (publicado ou agendado) mais
 * o intervalo, nunca antes de agora, dentro da janela. Fora da janela de
 * hoje → null (notícia velha não fica para amanhã).
 */
export function proximoHorario(
  ultimo: Date | null,
  agora: Date,
  cfg: ConfigIG,
  alerta = false,
): Date | null {
  const gapMin = alerta ? cfg.intervalo_alerta_min : cfg.intervalo_min;
  let t = ultimo ? new Date(Math.max(agora.getTime(), ultimo.getTime() + gapMin * 60_000)) : new Date(agora.getTime());
  const h = horaSP(t);
  if (h < cfg.janela_inicio) {
    // Antes da janela: começa na abertura (Brasília é UTC-3 fixo).
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(t);
    t = new Date(`${dia}T${String(cfg.janela_inicio).padStart(2, "0")}:00:00-03:00`);
  }
  if (horaSP(t) >= cfg.janela_fim) return null;
  return t;
}

/**
 * Encaixa os novos posts na fila: alertas primeiro (só o intervalo curto
 * do anterior), depois por peso. Devolve o horário de cada um (null = não
 * coube hoje).
 */
export function agendar(
  novos: Array<{ chave: string; alerta: boolean; score: number }>,
  ultimoHorario: Date | null,
  agora: Date,
  cfg: ConfigIG,
): Map<string, Date | null> {
  const fila = [...novos].sort((a, b) => Number(b.alerta) - Number(a.alerta) || b.score - a.score);
  const saida = new Map<string, Date | null>();
  let ultimo = ultimoHorario;
  for (const p of fila) {
    const t = proximoHorario(ultimo, agora, cfg, p.alerta);
    saida.set(p.chave, t);
    if (t) ultimo = t;
  }
  return saida;
}

/** Chapéu e escopo do card a partir da matéria. */
export function chapeuDe(m: MateriaIG, nomeEditoria: string | null, nomeRegiao: string | null): { texto: string; escopo: "cidade" | "regiao" | "brasil" | "mundo" | "parana" } {
  if (m.regiao_slug === "internacional" || m.categoria_slug === "internacional") return { texto: ["Mundo", nomeEditoria && nomeEditoria !== "Internacional" ? nomeEditoria : null].filter(Boolean).join(" · "), escopo: "mundo" };
  const doPR = RE_PARANA.test(norm(`${m.titulo} ${m.subtitulo ?? ""}`));
  if (m.regiao_slug === "nacional" && !doPR) return { texto: ["Brasil", nomeEditoria].filter(Boolean).join(" · "), escopo: "brasil" };
  if (m.cidade_principal) return { texto: [m.cidade_principal, nomeEditoria].filter(Boolean).join(" · "), escopo: "cidade" };
  // Sem cidade e falando do estado todo ("no Paraná"): o chapéu é Paraná, não a região do cadastro.
  if (nomeRegiao && REGIOES_PR.has(m.regiao_slug ?? "") && !/\bno parana\b/.test(norm(m.titulo))) return { texto: [nomeRegiao, nomeEditoria].filter(Boolean).join(" · "), escopo: "regiao" };
  return { texto: ["Paraná", nomeEditoria].filter(Boolean).join(" · "), escopo: "parana" };
}

/** Hashtags curtas: marca, cidade, região, Paraná. */
export function hashtags(m: MateriaIG, nomeRegiao: string | null): string[] {
  const tag = (s: string) => "#" + norm(s).replace(/[^a-z0-9]+/g, "").replace(/^./, (c) => c.toUpperCase());
  const t = ["#VozesParanaenses"];
  if (m.cidade_principal) t.push(tag(m.cidade_principal));
  if (nomeRegiao && REGIOES_PR.has(m.regiao_slug ?? "")) t.push(tag(nomeRegiao));
  if (m.regiao_slug !== "nacional" && m.regiao_slug !== "internacional") t.push("#Parana");
  return [...new Set(t)];
}

/** Números citados no card precisam estar no texto da matéria (a IA não inventa dado). */
export function numerosConferem(valor: string, fonte: string): boolean {
  const nums = valor.match(/\d+(?:[.,]\d+)*/g);
  if (!nums) return true;
  const f = fonte.replace(/\s/g, "");
  return nums.every((n) => f.includes(n) || f.includes(n.replace(/\./g, "")) || f.includes(n.replace(/,/g, ".")));
}
