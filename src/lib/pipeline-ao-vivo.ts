// Pipeline ao vivo (/admin/pipeline): ciclos do dia, estado de cada etapa,
// horas de trabalho humano poupadas e relatório de fim de ciclo.
//
// Os dados vêm das RPCs pipeline_eventos() e pipeline_painel() (migração 087)
// e a grade de ciclos vem do próprio cron (pipeline_agenda(), 078).

import { FRENTES, janelasBrt, type JobCron } from "@/lib/pipeline-agenda";

export type EtapaId = "coleta" | "crivo" | "apuracao" | "redacao" | "criticidade" | "imagem" | "publicacao" | "redes";

export type Evento = { t: string; etapa: EtapaId; id: string; d: Record<string, unknown> };

export const ETAPAS: { id: EtapaId; nome: string; funcao: string }[] = [
  { id: "coleta", nome: "Coleta", funcao: "scrape-source · scrape-prefeitura" },
  { id: "crivo", nome: "Deduplicação e crivo", funcao: "cluster-articles · classify-and-quota" },
  { id: "apuracao", nome: "Apuração 5W1H", funcao: "extract-facts" },
  { id: "redacao", nome: "Redação", funcao: "generate-article · Método DEL" },
  { id: "criticidade", nome: "Criticidade", funcao: "agente de risco jurídico e eleitoral" },
  { id: "imagem", nome: "Imagem", funcao: "analista de imagem · só com crédito" },
  { id: "publicacao", nome: "Publicação", funcao: "publish-article · home por proximidade" },
  { id: "redes", nome: "Redes sociais", funcao: "robô do Instagram · @vozesparanaenses" },
];

// Minutos que uma pessoa levaria em cada unidade de trabalho (estimativa
// conservadora usada no pitch: ~140 h/dia no volume de outubro/2026).
export const MINUTOS_HUMANOS = { coleta: 2, crivo: 1, apuracao: 5, redacao: 33, publicacao: 3, post: 20 };

export function horasPoupadas(h: { coletadas: number; fatos: number; apuradas: number; redigidas: number; publicadas: number; posts: number }): number {
  const m = MINUTOS_HUMANOS;
  return (h.coletadas * m.coleta + h.fatos * m.crivo + h.apuradas * m.apuracao + h.redigidas * m.redacao + h.publicadas * m.publicacao + h.posts * m.post) / 60;
}

// ---------------------------------------------------------------- ciclos

export type Ciclo = { inicio: number; fim: number; nome: string }; // horas BRT

const FRENTES_COLETA = ["nacional", "politica", "portais", "prefeituras", "tecnologia", "esportes"] as const;
const NOME_CURTO: Record<string, string> = {
  nacional: "Nacional e mundo", politica: "Política", portais: "Portais", prefeituras: "Prefeituras", tecnologia: "Tecnologia", esportes: "Esportes",
};

/** Ciclos de coleta do dia (cada janela de uma frente), juntando os que começam na mesma hora. */
export function ciclosDoDia(jobs: Pick<JobCron, "jobname" | "schedule">[]): Ciclo[] {
  const porInicio = new Map<number, { fim: number; nomes: string[] }>();
  for (const id of FRENTES_COLETA) {
    const frente = FRENTES.find((f) => f.id === id);
    const job = frente && jobs.find((j) => j.jobname === frente.jobs[0]);
    if (!job) continue;
    const { janelas, marcos } = janelasBrt(job.schedule);
    const blocos = [...janelas, ...marcos.map((m) => ({ inicio: m.hora + m.minuto / 60, fim: m.hora + m.minuto / 60 + 0.5 }))];
    for (const b of blocos) {
      const atual = porInicio.get(b.inicio) ?? { fim: b.fim, nomes: [] };
      atual.fim = Math.max(atual.fim, b.fim);
      if (!atual.nomes.includes(NOME_CURTO[id])) atual.nomes.push(NOME_CURTO[id]);
      porInicio.set(b.inicio, atual);
    }
  }
  return [...porInicio.entries()]
    .map(([inicio, v]) => ({ inicio, fim: v.fim, nome: v.nomes.join(" e ") }))
    .sort((a, b) => a.inicio - b.inicio);
}

/** Data (Date) de uma hora BRT de hoje. */
export function horaHoje(h: number, base = new Date()): Date {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(base);
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return new Date(`${dia}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`);
}

export function cicloAtual(ciclos: Ciclo[], agoraH: number): { atual: Ciclo | null; ativo: boolean; ultimoConcluido: Ciclo | null; proximo: Ciclo | null } {
  const comecados = ciclos.filter((c) => c.inicio <= agoraH);
  const atual = comecados[comecados.length - 1] ?? null;
  const ativo = !!atual && agoraH < atual.fim;
  const concluidos = ciclos.filter((c) => c.fim <= agoraH);
  const ultimoConcluido = concluidos[concluidos.length - 1] ?? null;
  const proximo = ciclos.find((c) => c.inicio > agoraH) ?? null;
  return { atual, ativo, ultimoConcluido, proximo };
}

export function rotuloHora(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

// ---------------------------------------------------------------- etapas

export type EstadoEtapa = {
  status: "aguardando" | "rodando" | "concluido";
  eventos: Evento[]; // do ciclo, até "agora"
  ultimo: Evento | null;
  progresso: number; // 0..1 (só visual: quanto do ciclo a etapa já cobriu)
};

const RODANDO_MS = 4 * 60_000;

export function estadoDasEtapas(eventos: Evento[], agora: Date, inicioCiclo: Date): Record<EtapaId, EstadoEtapa> {
  const out = {} as Record<EtapaId, EstadoEtapa>;
  const t = agora.getTime();
  const ini = inicioCiclo.getTime();
  for (const e of ETAPAS) {
    const evs = eventos.filter((x) => x.etapa === e.id && new Date(x.t).getTime() <= t && new Date(x.t).getTime() >= ini);
    const ultimo = evs[evs.length - 1] ?? null;
    const idade = ultimo ? t - new Date(ultimo.t).getTime() : Infinity;
    const status = !ultimo ? "aguardando" : idade < RODANDO_MS ? "rodando" : "concluido";
    const progresso = status === "concluido" ? 1 : status === "aguardando" ? 0 : Math.min(0.95, 0.15 + evs.length / 60);
    out[e.id] = { status, eventos: evs, ultimo, progresso };
  }
  return out;
}

// ---------------------------------------------------------------- relatório

export type Relatorio = {
  ciclo: string;
  janela: string;
  etapas: { nome: string; n: number; duracao: string }[];
  publicadas: { titulo: string; cidade: string | null }[];
  automaticas: number;
  editor: number;
  custoBrl: number;
  horas: number;
};

export function relatorioDoCiclo(nomeCiclo: string, eventos: Evento[], params: Record<string, number>): Relatorio {
  const por = (id: EtapaId) => eventos.filter((e) => e.etapa === id);
  const dur = (evs: Evento[]) => {
    if (evs.length < 2) return evs.length ? "instantâneo" : "—";
    const ms = new Date(evs[evs.length - 1].t).getTime() - new Date(evs[0].t).getTime();
    const min = Math.round(ms / 60_000);
    return min < 1 ? "< 1 min" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  };
  const etapas = ETAPAS.map((e) => ({ nome: e.nome, n: por(e.id).length, duracao: dur(por(e.id)) }));
  const pubs = por("publicacao");
  const crit = por("criticidade");
  const posts = por("redes").filter((e) => e.d.acao === "publicado").length;
  const cambio = params.cambio_usd_brl ?? 5.5;
  const usd = por("coleta").length * (params.ia_coleta ?? 0) + por("crivo").length * (params.ia_crivo ?? 0)
    + por("apuracao").length * (params.ia_fatos ?? 0) + por("redacao").length * (params.ia_materia ?? 0)
    + posts * (params.ia_instagram ?? 0);
  const t0 = eventos[0]?.t, t1 = eventos[eventos.length - 1]?.t;
  const hm = (s?: string) => (s ? new Date(s).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "—");
  return {
    ciclo: nomeCiclo,
    janela: `${hm(t0)} → ${hm(t1)}`,
    etapas,
    publicadas: pubs.slice(-6).reverse().map((e) => ({ titulo: String(e.d.titulo ?? ""), cidade: (e.d.cidade as string) ?? null })),
    automaticas: crit.filter((e) => e.d.auto).length,
    editor: crit.filter((e) => !e.d.auto).length,
    custoBrl: usd * cambio,
    horas: horasPoupadas({
      coletadas: por("coleta").length, fatos: por("crivo").length, apuradas: por("apuracao").length,
      redigidas: por("redacao").length, publicadas: pubs.length, posts,
    }),
  };
}

// ---------------------------------------------------------------- mapa

export const PARANA_VIEWBOX = "300 437 108 79";
export const CIDADES_MAPA: { nome: string; x: number; y: number }[] = [
  { nome: "Curitiba", x: 385.5, y: 490.3 }, { nome: "Londrina", x: 356.3, y: 454.2 }, { nome: "Maringá", x: 344.3, y: 456.1 },
  { nome: "Cascavel", x: 320.8, y: 482.3 }, { nome: "Foz do Iguaçu", x: 303.3, y: 492.4 }, { nome: "Ponta Grossa", x: 371.8, y: 484.5 },
  { nome: "Guarapuava", x: 351.7, y: 489.6 }, { nome: "Paranaguá", x: 397.3, y: 491.8 }, { nome: "Pato Branco", x: 333.0, y: 503.9 },
  { nome: "Umuarama", x: 322.8, y: 462.1 }, { nome: "Jacarezinho", x: 374.7, y: 451.7 }, { nome: "Campo Mourão", x: 337.5, y: 466.8 },
  { nome: "Toledo", x: 316.4, y: 478.2 }, { nome: "Francisco Beltrão", x: 326.9, y: 501.4 }, { nome: "Apucarana", x: 351.7, y: 458.3 },
  { nome: "Paranavaí", x: 336.0, y: 450.1 }, { nome: "União da Vitória", x: 357.4, y: 503.9 }, { nome: "Irati", x: 364.2, y: 491.0 },
];
// Regiões → cidade-polo (quando a matéria não traz cidade conhecida do mapa).
export const POLO_DA_REGIAO: Record<string, string> = {
  metropolitana: "Curitiba", "norte-central": "Londrina", oeste: "Cascavel", "campos-gerais": "Ponta Grossa", "centro-sul": "Guarapuava",
  litoral: "Paranaguá", sudoeste: "Pato Branco", noroeste: "Umuarama", "norte-pioneiro": "Jacarezinho", "centro-ocidental": "Campo Mourão",
};

// ---------------------------------------------------------------- som

/** "Plim" curto de duas notas (Web Audio, sem arquivo). */
export function tocarPlim(ctx: AudioContext) {
  const agora = ctx.currentTime;
  for (const [i, f] of [880, 1320].entries()) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = agora + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.4);
  }
}
