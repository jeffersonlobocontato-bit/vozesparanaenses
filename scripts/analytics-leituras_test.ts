// Testes das leituras do painel de Analytics (rode: npx deno run scripts/analytics-leituras_test.ts)
import { leituras, periodo } from "../src/lib/analytics-leituras.ts";
import { corpoDoRelatorio, intervalos, relatoriosDaAba, ABAS } from "../src/lib/ga4-relatorios.ts";

let falhas = 0;
const ok = (nome: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? "✓" : "✗"} ${nome}${cond ? "" : " " + JSON.stringify(extra)}`);
  if (!cond) falhas++;
};
const tem = (ls: { titulo: string; nivel: string }[], t: string, nivel?: string) => ls.some((l) => l.titulo.includes(t) && (!nivel || l.nivel === nivel));

// visão: queda forte e amostra pequena
let ls = leituras("visao", {
  totais: [
    { dateRange: "atual", activeUsers: 60, screenPageViews: 150, engagementRate: 0.4, newUsers: 50, sessions: 80 },
    { dateRange: "anterior", activeUsers: 100, screenPageViews: 300, engagementRate: 0.5, newUsers: 80, sessions: 120 },
  ],
  eventos: [{ dateRange: "atual", eventName: "page_view", eventCount: 300 }, { dateRange: "atual", eventName: "leitura_completa", eventCount: 20 }],
  canais: [{ sessionDefaultChannelGroup: "Direct", sessions: 70 }, { sessionDefaultChannelGroup: "Organic Search", sessions: 5 }],
}, { dias: 28 });
ok("visão: queda de leitores é crítica", tem(ls, "Queda de leitores", "critico"), ls);
ok("visão: amostra pequena", tem(ls, "Amostra pequena"));
ok("visão: engajamento baixo", tem(ls, "Engajamento baixo", "critico"));
ok("visão: sem conversão", tem(ls, "Nenhuma conversão"));
ok("visão: pouca leitura até o fim", tem(ls, "Pouca leitura"));
ok("visão: pouca busca orgânica", tem(ls, "Pouca busca orgânica"));
ok("críticos primeiro", ls[0].nivel === "critico");

// aquisição: dependência e direto
ls = leituras("aquisicao", {
  canais: [
    { dateRange: "atual", sessionDefaultChannelGroup: "Direct", sessions: 700, engagementRate: 0.4 },
    { dateRange: "atual", sessionDefaultChannelGroup: "Organic Social", sessions: 200, engagementRate: 0.7 },
    { dateRange: "atual", sessionDefaultChannelGroup: "Unassigned", sessions: 120, engagementRate: 0.2 },
  ],
  fontes: [{ sessionSourceMedium: "(direct) / (none)" }],
}, { dias: 28 });
ok("aquisição: dependência de canal", tem(ls, "Dependência", "critico"), ls);
ok("aquisição: sem classificação", tem(ls, "sem classificação"));
ok("aquisição: Google orgânico ausente", tem(ls, "Google orgânico ausente"));
ok("aquisição: WhatsApp sem UTM", tem(ls, "WhatsApp sem UTM"));

// editorias: audiência × produção
ls = leituras("editorias", {
  audiencia: [
    { dateRange: "atual", "customEvent:editoria": "seguranca", screenPageViews: 600 },
    { dateRange: "atual", "customEvent:editoria": "politica", screenPageViews: 100 },
    { dateRange: "atual", "customEvent:editoria": "(not set)", screenPageViews: 300 },
  ],
  eventos: [],
}, { dias: 28, producaoEditoria: { seguranca: 10, politica: 40, cultura: 8 } });
ok("editorias: falta pauta na mais lida", tem(ls, "Falta pauta em seguranca"), ls);
ok("editorias: produção sobrando", tem(ls, "Produção sobrando em politica"));
ok("editorias: publicada sem leitor", tem(ls, "sem leitor", "critico"));

// qualidade
ls = leituras("qualidade", { pageviews: [{ screenPageViews: 1000 }], interno: [{ testDataFilterName: "Internal Traffic", eventCount: 40 }] },
  { dias: 28, consentimento: { exibido: 100, aceito: 20, recusado: 10 }, pageviewsBase: 300 });
ok("qualidade: aceite baixo é crítico", tem(ls, "Aceite de cookies baixo", "critico"), ls);
ok("qualidade: banner ignorado", tem(ls, "Banner ignorado"));
ok("qualidade: GA × base", tem(ls, "GA × base"));
ok("qualidade: tráfego interno", tem(ls, "Tráfego da equipe"));

// relatórios
ok("período: 28 dias inclui hoje", JSON.stringify(intervalos(28, true)) === JSON.stringify([{ startDate: "27daysAgo", endDate: "today", name: "atual" }, { startDate: "55daysAgo", endDate: "28daysAgo", name: "anterior" }]));
const corpo = corpoDoRelatorio({ nome: "x", dimensoes: ["eventName"], metricas: ["eventCount"], eventos: ["share"] }, 7) as { dimensionFilter: { andGroup: { expressions: unknown[] } } };
ok("filtro: evento + sem /admin", corpo.dimensionFilter.andGroup.expressions.length === 2);
const rt = corpoDoRelatorio({ nome: "x", dimensoes: [], metricas: ["activeUsers"], tempoReal: true }, 7) as Record<string, unknown>;
ok("tempo real: sem dateRanges", !("dateRanges" in rt));
ok("toda aba (menos base própria) tem relatório", ABAS.filter((a) => a.id !== "base-propria").every((a) => relatoriosDaAba(a.id).length > 0));
ok("periodo aceita date_range_1", periodo([{ dateRange: "date_range_1", x: 1 }], "anterior").length === 1);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
if (falhas) Deno.exit(1);
