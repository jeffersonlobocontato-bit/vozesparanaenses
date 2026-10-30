// Relatórios do GA4 que cada aba do painel /admin/analytics pede.
// Lista fechada (o navegador só escolhe a aba e o período), montada aqui e
// executada no servidor por ga4.functions.ts.

export type Aba =
  | "visao"
  | "aquisicao"
  | "publico"
  | "conteudo"
  | "editorias"
  | "regioes"
  | "engajamento"
  | "conversoes"
  | "busca"
  | "tempo-real"
  | "qualidade"
  | "base-propria";

export const ABAS: Array<{ id: Aba; rotulo: string; descricao: string }> = [
  { id: "visao", rotulo: "Visão geral", descricao: "Leitores, sessões, leituras e conversões do período" },
  { id: "tempo-real", rotulo: "Tempo real", descricao: "Quem está no site nos últimos 30 minutos" },
  { id: "aquisicao", rotulo: "Fontes e canais", descricao: "De onde vem o leitor: busca, redes, WhatsApp, direto, campanhas" },
  { id: "publico", rotulo: "Perfil do leitor", descricao: "Novos × recorrentes, dispositivo, cidade, horário" },
  { id: "conteudo", rotulo: "Conteúdo", descricao: "Matérias, autoria (IA × redação × imprensa), frescor" },
  { id: "editorias", rotulo: "Editorias", descricao: "Audiência, leitura completa e produção por editoria" },
  { id: "regioes", rotulo: "Regiões e cidades", descricao: "Audiência e produção por região e cidade da matéria" },
  { id: "engajamento", rotulo: "Engajamento", descricao: "Leitura completa, compartilhamento, cliques em relacionadas" },
  { id: "conversoes", rotulo: "Conversões", descricao: "Leads, cliques de WhatsApp e comentários" },
  { id: "busca", rotulo: "Busca do site", descricao: "O que o leitor procura e não acha na home" },
  { id: "qualidade", rotulo: "Qualidade dos dados", descricao: "Aceite de cookies, amostra, campos vazios, tráfego interno" },
  { id: "base-propria", rotulo: "Base própria", descricao: "Acessos registrados no nosso banco (com aceite)" },
];

export type Relatorio = {
  nome: string;
  dimensoes: string[];
  metricas: string[];
  /** Pede o período anterior também (linhas ganham dateRange = "atual" | "anterior"). */
  comparar?: boolean;
  eventos?: string[];
  limite?: number;
  ordem?: { metrica?: string; dimensao?: string; desc?: boolean };
  tempoReal?: boolean;
};

const ED = "customEvent:editoria";
const RG = "customEvent:regiao";

export const EVENTOS_CONVERSAO = ["generate_lead", "clique_whatsapp", "comentario_enviado"];

export function relatoriosDaAba(aba: Aba): Relatorio[] {
  switch (aba) {
    case "visao":
      return [
        { nome: "totais", dimensoes: [], metricas: ["activeUsers", "newUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration", "keyEvents"], comparar: true },
        { nome: "serie", dimensoes: ["date"], metricas: ["activeUsers", "sessions", "screenPageViews"], ordem: { dimensao: "date" }, limite: 400 },
        { nome: "canais", dimensoes: ["sessionDefaultChannelGroup"], metricas: ["sessions", "engagementRate"], limite: 10 },
        { nome: "paginas", dimensoes: ["pagePath", "pageTitle"], metricas: ["screenPageViews"], limite: 8 },
        { nome: "eventos", dimensoes: ["eventName"], metricas: ["eventCount"], comparar: true, eventos: ["page_view", "leitura_completa", "share", "clique_relacionada", ...EVENTOS_CONVERSAO] },
      ];
    case "aquisicao":
      return [
        { nome: "canais", dimensoes: ["sessionDefaultChannelGroup"], metricas: ["sessions", "activeUsers", "engagementRate", "averageSessionDuration", "screenPageViewsPerSession", "keyEvents"], comparar: true },
        { nome: "fontes", dimensoes: ["sessionSourceMedium"], metricas: ["sessions", "activeUsers", "engagementRate", "averageSessionDuration", "keyEvents"], limite: 40 },
        { nome: "campanhas", dimensoes: ["sessionCampaignName", "sessionSourceMedium"], metricas: ["sessions", "engagementRate", "keyEvents"], limite: 25 },
        { nome: "entrada", dimensoes: ["landingPage"], metricas: ["sessions", "engagementRate", "keyEvents"], limite: 20 },
        { nome: "serieCanal", dimensoes: ["date", "sessionDefaultChannelGroup"], metricas: ["sessions"], ordem: { dimensao: "date" }, limite: 2000 },
      ];
    case "publico":
      return [
        { nome: "tipo", dimensoes: ["newVsReturning"], metricas: ["activeUsers", "sessions", "engagementRate", "screenPageViewsPerSession"], comparar: true },
        { nome: "dispositivo", dimensoes: ["deviceCategory"], metricas: ["activeUsers", "sessions", "engagementRate", "averageSessionDuration"] },
        { nome: "cidade", dimensoes: ["city", "region"], metricas: ["activeUsers", "sessions", "engagementRate"], limite: 40 },
        { nome: "estado", dimensoes: ["region"], metricas: ["activeUsers"], limite: 15 },
        { nome: "hora", dimensoes: ["hour"], metricas: ["activeUsers", "screenPageViews"], ordem: { dimensao: "hour" }, limite: 24 },
        { nome: "diaSemana", dimensoes: ["dayOfWeek"], metricas: ["activeUsers", "screenPageViews"], ordem: { dimensao: "dayOfWeek" }, limite: 7 },
        { nome: "sistema", dimensoes: ["operatingSystem"], metricas: ["activeUsers"], limite: 8 },
        { nome: "navegador", dimensoes: ["browser"], metricas: ["activeUsers"], limite: 8 },
      ];
    case "conteudo":
      return [
        { nome: "paginas", dimensoes: ["pagePath", "pageTitle"], metricas: ["screenPageViews", "activeUsers", "userEngagementDuration"], limite: 50 },
        { nome: "conclusao", dimensoes: ["pagePath", "eventName"], metricas: ["eventCount"], eventos: ["page_view", "leitura_completa", "share"], limite: 1000 },
        { nome: "autoria", dimensoes: ["customEvent:autoria", "eventName"], metricas: ["eventCount", "totalUsers"], eventos: ["page_view", "leitura_completa", "share"] },
        { nome: "tipo", dimensoes: ["customEvent:tipo_conteudo"], metricas: ["screenPageViews", "activeUsers", "userEngagementDuration"] },
        { nome: "frescor", dimensoes: ["customEvent:data_publicacao"], metricas: ["screenPageViews"], limite: 120 },
      ];
    case "editorias":
      return [
        { nome: "audiencia", dimensoes: [ED], metricas: ["screenPageViews", "activeUsers", "userEngagementDuration"], comparar: true, limite: 40 },
        { nome: "eventos", dimensoes: [ED, "eventName"], metricas: ["eventCount"], eventos: ["page_view", "leitura_completa", "share", "clique_relacionada", ...EVENTOS_CONVERSAO], limite: 400 },
        { nome: "canais", dimensoes: [ED, "sessionDefaultChannelGroup"], metricas: ["screenPageViews"], limite: 400 },
      ];
    case "regioes":
      return [
        { nome: "audiencia", dimensoes: [RG], metricas: ["screenPageViews", "activeUsers", "userEngagementDuration"], comparar: true, limite: 40 },
        { nome: "eventos", dimensoes: [RG, "eventName"], metricas: ["eventCount"], eventos: ["page_view", "leitura_completa", "share", "clique_relacionada", ...EVENTOS_CONVERSAO], limite: 400 },
        { nome: "cidades", dimensoes: ["customEvent:cidade"], metricas: ["screenPageViews", "activeUsers"], limite: 60 },
        { nome: "leitores", dimensoes: ["city"], metricas: ["activeUsers"], limite: 60 },
      ];
    case "engajamento":
      return [
        { nome: "metricas", dimensoes: [], metricas: ["engagementRate", "averageSessionDuration", "screenPageViewsPerSession", "userEngagementDuration", "activeUsers", "sessions"], comparar: true },
        { nome: "eventos", dimensoes: ["eventName"], metricas: ["eventCount", "totalUsers"], comparar: true, limite: 40 },
        { nome: "blocos", dimensoes: ["customEvent:bloco"], metricas: ["eventCount"], eventos: ["clique_relacionada"] },
        { nome: "compartilhadas", dimensoes: ["pageTitle"], metricas: ["eventCount"], eventos: ["share"], limite: 10 },
      ];
    case "conversoes":
      return [
        { nome: "totais", dimensoes: ["eventName"], metricas: ["eventCount", "totalUsers"], comparar: true, eventos: EVENTOS_CONVERSAO },
        { nome: "sessoes", dimensoes: [], metricas: ["sessions"], comparar: true },
        { nome: "leadTipo", dimensoes: ["customEvent:lead_tipo"], metricas: ["eventCount"], eventos: ["generate_lead"] },
        { nome: "whatsapp", dimensoes: ["customEvent:destino"], metricas: ["eventCount"], eventos: ["clique_whatsapp"] },
        { nome: "fonte", dimensoes: ["sessionSourceMedium", "eventName"], metricas: ["eventCount"], eventos: EVENTOS_CONVERSAO, limite: 40 },
        { nome: "pagina", dimensoes: ["pagePath", "eventName"], metricas: ["eventCount"], eventos: EVENTOS_CONVERSAO, limite: 40 },
      ];
    case "busca":
      return [
        { nome: "termos", dimensoes: ["searchTerm"], metricas: ["eventCount", "totalUsers"], eventos: ["view_search_results"], limite: 60 },
        { nome: "serie", dimensoes: ["date"], metricas: ["eventCount"], eventos: ["view_search_results"], ordem: { dimensao: "date" }, limite: 400 },
      ];
    case "tempo-real":
      return [
        { nome: "total", dimensoes: [], metricas: ["activeUsers", "screenPageViews"], tempoReal: true },
        { nome: "paginas", dimensoes: ["unifiedScreenName"], metricas: ["activeUsers", "screenPageViews"], tempoReal: true, limite: 15 },
        { nome: "cidades", dimensoes: ["city"], metricas: ["activeUsers"], tempoReal: true, limite: 12 },
        { nome: "dispositivo", dimensoes: ["deviceCategory"], metricas: ["activeUsers"], tempoReal: true },
        { nome: "minutos", dimensoes: ["minutesAgo"], metricas: ["activeUsers"], tempoReal: true, limite: 30 },
        { nome: "eventos", dimensoes: ["eventName"], metricas: ["eventCount"], tempoReal: true, limite: 20 },
      ];
    case "qualidade":
      return [
        { nome: "pageviews", dimensoes: [], metricas: ["screenPageViews", "activeUsers", "sessions"] },
        { nome: "editoriaVazia", dimensoes: [ED], metricas: ["screenPageViews"], limite: 60 },
        { nome: "regiaoVazia", dimensoes: [RG], metricas: ["screenPageViews"], limite: 60 },
        { nome: "canalVazio", dimensoes: ["sessionDefaultChannelGroup"], metricas: ["sessions"] },
        { nome: "interno", dimensoes: ["testDataFilterName"], metricas: ["eventCount"] },
      ];
    case "base-propria":
      return [];
  }
}

/** Intervalos de datas do GA4 para "últimos N dias" (incluindo hoje). */
export function intervalos(dias: number, comparar: boolean) {
  const atual = dias <= 1
    ? { startDate: "today", endDate: "today", name: "atual" }
    : { startDate: `${dias - 1}daysAgo`, endDate: "today", name: "atual" };
  if (!comparar) return [atual];
  const anterior = dias <= 1
    ? { startDate: "yesterday", endDate: "yesterday", name: "anterior" }
    : { startDate: `${dias * 2 - 1}daysAgo`, endDate: `${dias}daysAgo`, name: "anterior" };
  return [atual, anterior];
}

/** Corpo do runReport / runRealtimeReport para um relatório. */
export function corpoDoRelatorio(r: Relatorio, dias: number): Record<string, unknown> {
  const filtros: unknown[] = [];
  if (r.eventos?.length) filtros.push({ filter: { fieldName: "eventName", inListFilter: { values: r.eventos } } });
  // Nunca conta as telas do próprio painel.
  if (!r.tempoReal) {
    filtros.push({ notExpression: { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/admin" } } } });
  }
  const dimensionFilter = filtros.length === 0 ? undefined : filtros.length === 1 ? filtros[0] : { andGroup: { expressions: filtros } };
  const orderBys = r.ordem?.dimensao
    ? [{ dimension: { dimensionName: r.ordem.dimensao }, desc: !!r.ordem.desc }]
    : r.metricas.length
      ? [{ metric: { metricName: r.ordem?.metrica ?? r.metricas[0] }, desc: true }]
      : undefined;
  return {
    ...(r.tempoReal ? {} : { dateRanges: intervalos(dias, !!r.comparar) }),
    dimensions: r.dimensoes.map((name) => ({ name })),
    metrics: r.metricas.map((name) => ({ name })),
    ...(dimensionFilter ? { dimensionFilter } : {}),
    ...(orderBys ? { orderBys } : {}),
    limit: r.limite ?? 25,
  };
}
