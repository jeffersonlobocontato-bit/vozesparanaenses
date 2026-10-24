// Ciclo de conteúdo do pipeline: traduz os jobs do pg_cron (horários em UTC)
// para as "frentes" que o painel mostra, em horário de Brasília.
//
// A fonte da verdade é o próprio cron, lido pela RPC pipeline_agenda()
// (077). Enquanto ela não existir no banco, o painel usa AGENDA_076 — a grade
// da migration 076 — e avisa que está mostrando a grade de referência.

export type JobCron = {
  jobname: string;
  schedule: string;
  active: boolean;
  alvo: string | null;
  corpo: string | null;
  ultima_execucao: string | null;
  ultimo_status: string | null;
  ultima_mensagem: string | null;
  execucoes_24h: number;
  falhas_24h: number;
};

export type FrenteId =
  | "nacional"
  | "portais"
  | "prefeituras"
  | "tecnologia"
  | "esportes"
  | "processamento"
  | "imagem";

export type AcaoManual = { funcao: string; body: Record<string, unknown> }[];

export type Frente = {
  id: FrenteId;
  nome: string;
  descricao: string;
  cor: string; // classe Tailwind de fundo do bloco na grade
  // Jobs do cron que pertencem à frente. O primeiro é o "principal".
  jobs: string[];
  // Disparo manual no servidor (modo background das funções). Sem `sync`:
  // o navegador não fica preso esperando — o processamento automático
  // escreve o que for coletado.
  acao?: { rotulo: string; passos: AcaoManual };
};

export const FRENTES: Frente[] = [
  {
    id: "nacional",
    nome: "Nacional e internacional",
    descricao: "Curadoria de veículos nacionais",
    cor: "bg-violet-500",
    jobs: ["vozes-curadoria-geral"],
    acao: { rotulo: "Coletar agora", passos: [{ funcao: "scrape-source", body: { force: true, curadoria_editorias: ["geral"] } }] },
  },
  {
    id: "portais",
    nome: "Portais do Paraná",
    descricao: "Jornais e sites regionais",
    cor: "bg-sky-500",
    jobs: ["vozes-scrape-source"],
    acao: { rotulo: "Coletar agora", passos: [{ funcao: "scrape-source", body: { force: true } }] },
  },
  {
    id: "prefeituras",
    nome: "Prefeituras",
    descricao: "Assessorias oficiais das cidades",
    cor: "bg-emerald-500",
    jobs: ["vozes-scrape-prefeitura"],
    acao: { rotulo: "Coletar agora", passos: [{ funcao: "scrape-prefeitura", body: { force: true } }] },
  },
  {
    id: "tecnologia",
    nome: "Tecnologia",
    descricao: "Curadoria + 1 publicação por dia",
    cor: "bg-amber-500",
    jobs: ["vozes-tecnologia-scrape", "vozes-tecnologia-cluster", "vozes-tecnologia-periodico"],
    acao: { rotulo: "Coletar agora", passos: [{ funcao: "scrape-source", body: { force: true, curadoria_editorias: ["tecnologia"] } }] },
  },
  {
    id: "esportes",
    nome: "Esportes",
    descricao: "Curadoria esportiva",
    cor: "bg-rose-500",
    jobs: ["vozes-curadoria-esportes"],
    acao: { rotulo: "Coletar agora", passos: [{ funcao: "scrape-source", body: { force: true, curadoria_editorias: ["esportes"] } }] },
  },
  {
    id: "processamento",
    nome: "Processamento",
    descricao: "Agrupar → crivo → escrever → criticidade",
    cor: "bg-slate-400",
    jobs: ["vozes-process-pending", "vozes-cluster-articles", "vozes-classify-and-quota"],
    acao: {
      rotulo: "Processar agora",
      passos: [
        { funcao: "cluster-articles", body: {} },
        { funcao: "classify-and-quota", body: { limit: 40 } },
        { funcao: "process-pending-clusters", body: { limit: 8 } },
      ],
    },
  },
  {
    id: "imagem",
    nome: "Analista de imagem",
    descricao: "Risco das fotos da primeira dobra",
    cor: "bg-teal-500",
    jobs: ["vozes-analista-imagem"],
  },
];

// Grade da migration 076 (UTC) — usada só enquanto a 077 não foi aplicada.
export const AGENDA_076: Pick<JobCron, "jobname" | "schedule">[] = [
  { jobname: "vozes-curadoria-geral", schedule: "3-59/10 10-11,17-18 * * *" },
  { jobname: "vozes-scrape-source", schedule: "1-59/3 0-1,13-14,19-20 * * *" },
  { jobname: "vozes-scrape-prefeitura", schedule: "*/3 15-16,21-22 * * *" },
  { jobname: "vozes-tecnologia-scrape", schedule: "6-59/10 17-18 * * *" },
  { jobname: "vozes-tecnologia-cluster", schedule: "25,55 17-18 * * *" },
  { jobname: "vozes-tecnologia-periodico", schedule: "45 17,18 * * *" },
  { jobname: "vozes-curadoria-esportes", schedule: "8-59/10 0-1 * * *" },
  { jobname: "vozes-cluster-articles", schedule: "2-59/5 0-2,10-23 * * *" },
  { jobname: "vozes-classify-and-quota", schedule: "4-59/5 0-2,10-23 * * *" },
  { jobname: "vozes-process-pending", schedule: "*/4 0-2,10-23 * * *" },
  { jobname: "vozes-analista-imagem", schedule: "25,55 0,1,11-23 * * *" },
];

const UTC_PARA_BRT = -3;

/** Expande um campo de cron ("0-1,13-14", "*", "*\/4", "45") em números. */
export function expandirCampo(campo: string, min: number, max: number): number[] {
  const out = new Set<number>();
  for (const parte of campo.split(",")) {
    const [faixa, passoTxt] = parte.split("/");
    const passo = passoTxt ? Number(passoTxt) : 1;
    let ini = min;
    let fim = max;
    if (faixa !== "*") {
      const [a, b] = faixa.split("-");
      ini = Number(a);
      fim = b !== undefined ? Number(b) : passoTxt ? max : ini;
    }
    for (let v = ini; v <= fim; v += passo) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

export type Janela = { inicio: number; fim: number }; // horas BRT, fim exclusivo
export type Marco = { hora: number; minuto: number }; // execução pontual

/** Horas BRT em que o job roda, agrupadas em janelas contínuas. */
export function janelasBrt(schedule: string): { janelas: Janela[]; marcos: Marco[]; cadencia: string } {
  const [minCampo = "*", horaCampo = "*"] = schedule.trim().split(/\s+/);
  const horas = expandirCampo(horaCampo, 0, 23)
    .map((h) => (h + UTC_PARA_BRT + 24) % 24)
    .sort((a, b) => a - b);
  const minutos = expandirCampo(minCampo, 0, 59);

  // Minuto fixo em poucas horas do dia = marcos (ex.: 14h45 e 15h45).
  // Minuto fixo o dia todo (ex.: 2× por hora das 8h às 22h) = janela.
  const pontual = !minCampo.includes("*") && !minCampo.includes("/") && minutos.length <= 2 && horas.length <= 4;
  if (pontual) {
    return {
      janelas: [],
      marcos: horas.flatMap((h) => minutos.map((m) => ({ hora: h, minuto: m }))),
      cadencia: minutos.length === 1 ? "1× por hora" : `${minutos.length}× por hora`,
    };
  }

  const janelas: Janela[] = [];
  for (const h of horas) {
    const ult = janelas[janelas.length - 1];
    if (ult && ult.fim === h) ult.fim = h + 1;
    else janelas.push({ inicio: h, fim: h + 1 });
  }
  const cadencia = minCampo.includes("/")
    ? `a cada ${Number(minCampo.split("/")[1])} min`
    : minutos.length === 1 ? "1× por hora" : `${minutos.length}× por hora`;
  return { janelas, marcos: [], cadencia };
}

export function horaBrtAgora(agora = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(agora);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function fmtHora(h: number): string {
  const hh = h >= 24 ? 24 : Math.floor(h);
  const mm = Math.round((h - Math.floor(h)) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}

/** Texto curto da grade: "10h–12h · 16h–18h". */
export function rotuloJanelas(janelas: Janela[], marcos: Marco[]): string {
  if (janelas.length) return janelas.map((j) => `${fmtHora(j.inicio)}–${fmtHora(j.fim)}`).join(" · ");
  return marcos.map((m) => fmtHora(m.hora + m.minuto / 60)).join(" · ");
}

/** Situação da frente agora: rodando, próxima janela, ou encerrada no dia. */
export function situacao(janelas: Janela[], marcos: Marco[], agora: number): { rodando: boolean; proxima: number | null } {
  if (janelas.some((j) => agora >= j.inicio && agora < j.fim)) return { rodando: true, proxima: null };
  const inicios = [...janelas.map((j) => j.inicio), ...marcos.map((m) => m.hora + m.minuto / 60)].sort((a, b) => a - b);
  const prox = inicios.find((h) => h > agora);
  return { rodando: false, proxima: prox ?? inicios[0] ?? null };
}
