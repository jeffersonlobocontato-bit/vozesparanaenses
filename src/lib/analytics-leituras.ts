// Leituras do painel /admin/analytics: para cada aba, transforma os números
// do GA4 (e do nosso banco) em LEITURAS CRÍTICAS, ALERTAS e INSIGHTS de
// melhoria. Regras determinísticas (sem IA): cada leitura diz o número que a
// disparou, para o editor conferir.

import type { Aba } from "./ga4-relatorios";

export type Linha = Record<string, string | number>;
export type Relatorios = Record<string, Linha[]>;
export type Nivel = "critico" | "alerta" | "insight";
export type Leitura = { nivel: Nivel; titulo: string; texto: string };

/** Contexto que não vem do GA4 (banco do Vozes). */
export type Extras = {
  dias: number;
  /** Matérias publicadas no período por editoria (slug) e por região (slug). */
  producaoEditoria?: Record<string, number>;
  producaoRegiao?: Record<string, number>;
  /** Banner de cookies no período. */
  consentimento?: { exibido: number; aceito: number; recusado: number };
  /** Pageviews na nossa base (só com aceite). */
  pageviewsBase?: number;
};

// ---------------------------------------------------------------- utilidades
export const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

export function soma(linhas: Linha[] | undefined, metrica: string, filtro?: (l: Linha) => boolean): number {
  return (linhas ?? []).filter((l) => !filtro || filtro(l)).reduce((s, l) => s + num(l[metrica]), 0);
}

/** Separa linhas de relatório comparado em período atual × anterior. */
export function periodo(linhas: Linha[] | undefined, qual: "atual" | "anterior"): Linha[] {
  return (linhas ?? []).filter((l) => (l.dateRange ?? "atual") === qual || (l.dateRange === "date_range_0" && qual === "atual") || (l.dateRange === "date_range_1" && qual === "anterior"));
}

export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}

export function pctTexto(v: number | null, casas = 0): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(casas)}%`;
}

export const pct = (v: number, casas = 0) => `${(v * 100).toFixed(casas).replace(".", ",")}%`;
export const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");

export function duracao(seg: number): string {
  if (!seg || !Number.isFinite(seg)) return "0s";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return m ? `${m}min ${s}s` : `${s}s`;
}

/** Agrupa somando uma métrica por valor de dimensão. */
export function agrupar(linhas: Linha[] | undefined, dim: string, metrica: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas ?? []) {
    const k = String(l[dim] ?? "");
    out[k] = (out[k] ?? 0) + num(l[metrica]);
  }
  return out;
}

/** Tabela {chave → {evento → contagem}} a partir de linhas [dim, eventName, eventCount]. */
export function eventosPor(linhas: Linha[] | undefined, dim: string): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const l of linhas ?? []) {
    const k = String(l[dim] ?? "");
    const ev = String(l.eventName ?? "");
    out[k] ??= {};
    out[k][ev] = (out[k][ev] ?? 0) + num(l.eventCount);
  }
  return out;
}

export const VAZIO = (v: unknown) => {
  const s = String(v ?? "").trim();
  return !s || s === "(not set)" || s === "(other)";
};

export const CANAL_PT: Record<string, string> = {
  "Organic Search": "Busca orgânica",
  Direct: "Direto",
  "Organic Social": "Redes sociais",
  Referral: "Sites que linkam",
  Unassigned: "Sem classificação",
  "Paid Search": "Busca paga",
  "Paid Social": "Redes pagas",
  Email: "E-mail",
  "Organic Video": "Vídeo",
  "Cross-network": "Multirrede",
  Display: "Display",
  "Organic Shopping": "Shopping",
  "SMS": "SMS",
  "Mobile Push Notifications": "Push",
};
export const canalPt = (c: string) => CANAL_PT[c] ?? c;

const DISPOSITIVO_PT: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet", "smart tv": "TV" };
export const dispositivoPt = (d: string) => DISPOSITIVO_PT[d] ?? d;

/** Amostra pequena: abaixo disso, variações percentuais são ruído. */
export const AMOSTRA_MINIMA = 100;

// ------------------------------------------------------------------ leituras
export function leituras(aba: Aba, r: Relatorios, x: Extras): Leitura[] {
  const out: Leitura[] = [];
  const add = (nivel: Nivel, titulo: string, texto: string) => out.push({ nivel, titulo, texto });

  switch (aba) {
    case "visao": {
      const at = periodo(r.totais, "atual")[0] ?? {};
      const an = periodo(r.totais, "anterior")[0] ?? {};
      const usuarios = num(at.activeUsers);
      const vUsu = variacao(usuarios, num(an.activeUsers));
      const vPv = variacao(num(at.screenPageViews), num(an.screenPageViews));
      if (usuarios < AMOSTRA_MINIMA) {
        add("alerta", "Amostra pequena", `${inteiro(usuarios)} leitores medidos no período. Com o Consent Mode, o GA só conta quem aceita os cookies: leia as variações como tendência, não como número exato (aba Qualidade dos dados).`);
      }
      if (vUsu !== null && vUsu <= -0.2 && usuarios >= 30) add("critico", "Queda de leitores", `Leitores ${pctTexto(vUsu)} contra o período anterior (${inteiro(num(an.activeUsers))} → ${inteiro(usuarios)}). Confira se o pipeline publicou normalmente (painel Pipeline ao vivo) e a aba Fontes e canais.`);
      else if (vUsu !== null && vUsu >= 0.2 && usuarios >= 30) add("insight", "Crescimento de leitores", `Leitores ${pctTexto(vUsu)} contra o período anterior. Veja em Fontes e canais qual canal puxou a alta e reforce.`);
      if (vPv !== null && vUsu !== null && vPv < vUsu - 0.15) add("alerta", "Menos páginas por leitor", `Visualizações (${pctTexto(vPv)}) cresceram menos que leitores (${pctTexto(vUsu)}): quem chega lê uma matéria e sai. Reforce relacionadas e links internos.`);
      const eng = num(at.engagementRate);
      if (usuarios >= 30 && eng > 0 && eng < 0.45) add("critico", "Engajamento baixo", `Só ${pct(eng)} das sessões foram engajadas (mais de 10 s, 2 páginas ou conversão). Referência para portal de notícias: 55% ou mais.`);
      const ev = agrupar(periodo(r.eventos, "atual"), "eventName", "eventCount");
      const pv = ev.page_view ?? 0;
      const conv = (ev.generate_lead ?? 0) + (ev.clique_whatsapp ?? 0) + (ev.comentario_enviado ?? 0);
      if (pv >= 200 && conv === 0) add("alerta", "Nenhuma conversão no período", "Nenhum lead, clique de WhatsApp ou comentário registrado. Confira se os CTAs de WhatsApp e newsletter estão visíveis nas matérias.");
      if (pv > 0) {
        const lc = (ev.leitura_completa ?? 0) / pv;
        if (pv >= 100 && lc < 0.15) add("alerta", "Pouca leitura até o fim", `Só ${pct(lc)} das visualizações chegam a 75% da matéria. Textos longos demais ou anúncios no meio do texto podem estar derrubando a leitura.`);
        else if (pv >= 100 && lc >= 0.35) add("insight", "Boa leitura até o fim", `${pct(lc)} das visualizações chegam a 75% da matéria — o formato está funcionando.`);
      }
      const canais = agrupar(r.canais, "sessionDefaultChannelGroup", "sessions");
      const totalS = Object.values(canais).reduce((a, b) => a + b, 0);
      const busca = canais["Organic Search"] ?? 0;
      if (totalS >= 50 && busca / totalS < 0.15) add("insight", "Pouca busca orgânica", `Busca orgânica traz ${pct(busca / totalS)} das sessões. Para portal regional, o alvo é 30% ou mais: títulos com cidade + fato, sitemap de notícias e páginas de cidade.`);
      break;
    }

    case "aquisicao": {
      const at = periodo(r.canais, "atual");
      const an = periodo(r.canais, "anterior");
      const total = soma(at, "sessions");
      if (!total) break;
      const porCanal = at.map((l) => ({ canal: String(l.sessionDefaultChannelGroup), s: num(l.sessions), eng: num(l.engagementRate), conv: num(l.keyEvents) }))
        .sort((a, b) => b.s - a.s);
      const lider = porCanal[0];
      if (lider && lider.s / total > 0.6) add("critico", "Dependência de um canal", `${canalPt(lider.canal)} traz ${pct(lider.s / total)} das sessões. Se esse canal oscilar (algoritmo, grupo de WhatsApp parado), o portal perde a maior parte da audiência.`);
      const semClass = porCanal.find((c) => c.canal === "Unassigned");
      if (semClass && semClass.s / total > 0.1) add("alerta", "Tráfego sem classificação", `${pct(semClass.s / total)} das sessões chegam sem canal identificado. Quase sempre é link sem UTM: use os links do Resumo regional e do Instagram, que já saem com UTM.`);
      const direto = porCanal.find((c) => c.canal === "Direct");
      if (direto && direto.s / total > 0.4) add("alerta", "Muito tráfego direto", `${pct(direto.s / total)} das sessões aparecem como "Direto". Parte disso é WhatsApp sem UTM (o app não envia de onde veio): todo link enviado em grupo deve sair com utm_source=whatsapp.`);
      const comVolume = porCanal.filter((c) => c.s >= Math.max(10, total * 0.05));
      const melhor = [...comVolume].sort((a, b) => b.eng - a.eng)[0];
      const pior = [...comVolume].sort((a, b) => a.eng - b.eng)[0];
      if (melhor && pior && melhor !== pior && melhor.eng - pior.eng > 0.15) {
        add("insight", "Qualidade por canal", `${canalPt(melhor.canal)} engaja ${pct(melhor.eng)} contra ${pct(pior.eng)} de ${canalPt(pior.canal)}. Vale mais investir em trazer leitor por ${canalPt(melhor.canal)}.`);
      }
      for (const c of porCanal.slice(0, 5)) {
        const ant = num(an.find((l) => l.sessionDefaultChannelGroup === c.canal)?.sessions);
        const v = variacao(c.s, ant);
        if (v !== null && ant >= 20 && v <= -0.3) add("alerta", `${canalPt(c.canal)} em queda`, `${pctTexto(v)} de sessões (${inteiro(ant)} → ${inteiro(c.s)}).`);
        if (v !== null && ant >= 20 && v >= 0.5) add("insight", `${canalPt(c.canal)} em alta`, `${pctTexto(v)} de sessões (${inteiro(ant)} → ${inteiro(c.s)}). Descubra o que mudou e repita.`);
      }
      const fontes = (r.fontes ?? []).map((l) => String(l.sessionSourceMedium));
      if (!fontes.some((f) => /google \/ organic/.test(f))) add("alerta", "Google orgânico ausente", "Nenhuma sessão de google / organic no período. Confira a indexação no Search Console.");
      if (!fontes.some((f) => /^whatsapp \//.test(f))) add("insight", "WhatsApp sem UTM", "Nenhuma sessão marcada como whatsapp. Os grupos e canais regionais devem usar os links do Resumo por região (já vão com utm_source=whatsapp).");
      const news = fontes.find((f) => /news\.google|discover/.test(f));
      if (news) add("insight", "Google Notícias / Discover", `Há tráfego de ${news}: mantenha títulos claros e foto grande nas matérias do PR.`);
      break;
    }

    case "publico": {
      const tipo = periodo(r.tipo, "atual");
      const novos = num(tipo.find((l) => l.newVsReturning === "new")?.activeUsers);
      const volta = num(tipo.find((l) => l.newVsReturning === "returning")?.activeUsers);
      const tot = novos + volta;
      if (tot >= 30) {
        const taxa = volta / tot;
        if (taxa < 0.2) add("critico", "Pouca fidelização", `Só ${pct(taxa)} dos leitores voltaram no período. Portal regional vive de hábito: newsletter de WhatsApp por região, alerta de notícia da cidade e o Resumo do dia no Instagram.`);
        else if (taxa >= 0.35) add("insight", "Leitor fiel", `${pct(taxa)} dos leitores são recorrentes — base boa para vender publieditorial e anúncio por região.`);
      }
      const disp = r.dispositivo ?? [];
      const totD = soma(disp, "activeUsers");
      const mob = num(disp.find((l) => l.deviceCategory === "mobile")?.activeUsers);
      if (totD >= 30 && mob / totD >= 0.75) add("insight", "Leitura no celular", `${pct(mob / totD)} dos leitores estão no celular: priorize foto leve, título curto e anúncio que não empurre o texto.`);
      const engMob = num(disp.find((l) => l.deviceCategory === "mobile")?.engagementRate);
      const engDesk = num(disp.find((l) => l.deviceCategory === "desktop")?.engagementRate);
      if (engMob && engDesk && engDesk - engMob > 0.15) add("alerta", "Celular engaja menos", `Engajamento no celular ${pct(engMob)} contra ${pct(engDesk)} no computador. Teste a velocidade da página de matéria no celular.`);
      const estados = r.estado ?? [];
      const totE = soma(estados, "activeUsers");
      const pr = soma(estados.filter((l) => /paran[aá]/i.test(String(l.region))), "activeUsers");
      if (totE >= 30 && pr / totE < 0.6) add("alerta", "Muito leitor fora do Paraná", `Só ${pct(pr / totE)} dos leitores estão no Paraná. Leitor de fora não compra anúncio regional: confira se notícias nacionais estão puxando a audiência.`);
      const horas = (r.hora ?? []).map((l) => ({ h: Number(l.hour), u: num(l.activeUsers) })).sort((a, b) => b.u - a.u);
      if (horas.length >= 6 && soma(r.hora, "activeUsers") >= 50) {
        const top = horas.slice(0, 3).map((x) => `${x.h}h`).join(", ");
        add("insight", "Horário de pico", `O leitor chega mais às ${top}. Os ciclos do pipeline (10h, 12h, 16h, 18h, 21h) e os posts do Instagram devem cair antes desses horários.`);
      }
      const cidades = r.cidade ?? [];
      const cidPr = cidades.filter((l) => /parana|paraná/i.test(String(l.region)) && !VAZIO(l.city));
      if (cidPr.length) add("insight", "Cidades que mais leem", `${cidPr.slice(0, 5).map((l) => `${l.city} (${inteiro(num(l.activeUsers))})`).join(", ")}. Compare com a aba Regiões: cidade que lê muito e tem pouca matéria é oportunidade de pauta e de venda.`);
      break;
    }

    case "conteudo": {
      const pags = (r.paginas ?? []).filter((l) => String(l.pagePath).split("/").filter(Boolean).length >= 2);
      const totPv = soma(r.paginas, "screenPageViews");
      const top10 = pags.slice(0, 10).reduce((s, l) => s + num(l.screenPageViews), 0);
      if (totPv >= 100 && top10 / totPv > 0.5) add("alerta", "Audiência concentrada", `As 10 matérias mais lidas somam ${pct(top10 / totPv)} das visualizações. O resto da produção quase não é lido: melhore a distribuição (home por proximidade, relacionadas, WhatsApp).`);
      const ev = eventosPor(r.conclusao, "pagePath");
      const fracas = pags.filter((l) => num(l.screenPageViews) >= 30).map((l) => {
        const e = ev[String(l.pagePath)] ?? {};
        return { titulo: String(l.pageTitle).replace(/ [—|-] Vozes Paranaenses$/, ""), pv: num(l.screenPageViews), taxa: (e.leitura_completa ?? 0) / Math.max(1, e.page_view ?? num(l.screenPageViews)) };
      });
      const baixa = fracas.filter((f) => f.taxa < 0.1).slice(0, 3);
      if (baixa.length) add("alerta", "Lidas, mas abandonadas", `Muito acesso e pouca leitura até o fim: ${baixa.map((b) => `"${b.titulo.slice(0, 60)}" (${pct(b.taxa)})`).join("; ")}. Título pode estar prometendo mais do que o texto entrega.`);
      const autoria = eventosPor(r.autoria, "customEvent:autoria");
      const tx = (k: string) => {
        const e = autoria[k];
        return e && (e.page_view ?? 0) >= 30 ? (e.leitura_completa ?? 0) / (e.page_view ?? 1) : null;
      };
      const ia = tx("ia");
      const red = tx("redacao");
      if (ia !== null && red !== null) {
        if (red - ia > 0.08) add("insight", "Redação humana prende mais", `Leitura completa: redação ${pct(red)} × IA ${pct(ia)}. Vale revisar o tom do agente redator nas editorias mais lidas.`);
        else if (ia - red > 0.08) add("insight", "Texto da IA prende bem", `Leitura completa: IA ${pct(ia)} × redação ${pct(red)}.`);
      }
      const totAut = Object.values(autoria).reduce((s, e) => s + (e.page_view ?? 0), 0);
      const semAut = Object.entries(autoria).filter(([k]) => VAZIO(k)).reduce((s, [, e]) => s + (e.page_view ?? 0), 0);
      if (totAut >= 50 && semAut / totAut > 0.6) add("insight", "Muitas páginas sem autoria", `${pct(semAut / totAut)} das visualizações são de páginas que não são matéria (home, região, editoria). Normal; a leitura por autoria considera só matérias.`);
      // Frescor
      const hoje = new Date();
      let recente = 0, velha = 0;
      for (const l of r.frescor ?? []) {
        const d = new Date(String(l["customEvent:data_publicacao"]));
        if (Number.isNaN(d.getTime())) continue;
        const idade = (hoje.getTime() - d.getTime()) / 86_400_000;
        if (idade <= 2) recente += num(l.screenPageViews);
        else if (idade > 7) velha += num(l.screenPageViews);
      }
      const totF = recente + velha;
      if (totF >= 50 && velha / totF > 0.3) add("insight", "Matéria antiga ainda é lida", `${pct(velha / totF)} das leituras são de matérias com mais de 7 dias — vem da busca. Atualize essas matérias e linke as novas a partir delas.`);
      break;
    }

    case "editorias":
    case "regioes": {
      const dim = aba === "editorias" ? "customEvent:editoria" : "customEvent:regiao";
      const nome = aba === "editorias" ? "editoria" : "região";
      const at = periodo(r.audiencia, "atual").filter((l) => !VAZIO(l[dim]));
      const an = periodo(r.audiencia, "anterior");
      const totPv = soma(at, "screenPageViews");
      const ev = eventosPor(r.eventos, dim);
      const prod = aba === "editorias" ? x.producaoEditoria : x.producaoRegiao;
      const totProd = Object.values(prod ?? {}).reduce((a, b) => a + b, 0);
      if (totPv >= 50 && prod && totProd >= 10) {
        const desequilibrio = at.map((l) => {
          const k = String(l[dim]);
          return { k, aud: num(l.screenPageViews) / totPv, prod: (prod[k] ?? 0) / totProd, pv: num(l.screenPageViews) };
        });
        const sub = desequilibrio.filter((d) => d.aud - d.prod > 0.08).sort((a, b) => (b.aud - b.prod) - (a.aud - a.prod))[0];
        const sobre = desequilibrio.filter((d) => d.prod - d.aud > 0.08).sort((a, b) => (b.prod - b.aud) - (a.prod - a.aud))[0];
        if (sub) add("insight", `Falta pauta em ${sub.k}`, `${sub.k} tem ${pct(sub.aud)} da audiência e só ${pct(sub.prod)} da produção. Aumente a cota/fontes dessa ${nome}.`);
        if (sobre) add("alerta", `Produção sobrando em ${sobre.k}`, `${sobre.k} recebe ${pct(sobre.prod)} da produção e só ${pct(sobre.aud)} da audiência. Reveja a cota ou o tipo de pauta.`);
        const semLeitura = Object.entries(prod).filter(([k, n]) => n >= 5 && !at.some((l) => String(l[dim]) === k)).map(([k]) => k);
        if (semLeitura.length) add("critico", `${nome[0].toUpperCase()}${nome.slice(1)} sem leitor`, `Publicamos em ${semLeitura.slice(0, 5).join(", ")} e não houve leitura medida no período. Confira se essas matérias aparecem na home e nas páginas de região.`);
      }
      const taxas = at.map((l) => {
        const k = String(l[dim]);
        const e = ev[k] ?? {};
        const pv = e.page_view ?? num(l.screenPageViews);
        return { k, pv, lc: (e.leitura_completa ?? 0) / Math.max(1, pv), sh: (e.share ?? 0) / Math.max(1, pv) };
      }).filter((t) => t.pv >= 30);
      if (taxas.length >= 2) {
        const melhor = [...taxas].sort((a, b) => b.lc - a.lc)[0];
        const pior = [...taxas].sort((a, b) => a.lc - b.lc)[0];
        if (melhor.lc - pior.lc > 0.1) add("insight", "Leitura completa", `${melhor.k} é a ${nome} mais lida até o fim (${pct(melhor.lc)}); ${pior.k} a menos (${pct(pior.lc)}).`);
        const comp = [...taxas].sort((a, b) => b.sh - a.sh)[0];
        if (comp.sh > 0.01) add("insight", "Mais compartilhada", `${comp.k} tem a maior taxa de compartilhamento (${pct(comp.sh, 1)} das visualizações) — boa candidata ao Instagram e ao WhatsApp.`);
      }
      for (const l of at.slice(0, 8)) {
        const k = String(l[dim]);
        const ant = num(an.find((a) => String(a[dim]) === k)?.screenPageViews);
        const v = variacao(num(l.screenPageViews), ant);
        if (v !== null && ant >= 30 && v <= -0.35) add("alerta", `${k} em queda`, `${pctTexto(v)} de visualizações (${inteiro(ant)} → ${inteiro(num(l.screenPageViews))}).`);
      }
      const vazio = soma(periodo(r.audiencia, "atual").filter((l) => VAZIO(l[dim]) ), "screenPageViews");
      const todo = soma(periodo(r.audiencia, "atual"), "screenPageViews");
      if (todo >= 50 && vazio / todo > 0.5) add("insight", `Páginas sem ${nome}`, `${pct(vazio / todo)} das visualizações são de páginas sem ${nome} (home, busca, institucionais). As leituras desta aba consideram só as páginas com ${nome}.`);
      if (aba === "regioes") {
        const cid = (r.cidades ?? []).filter((l) => !VAZIO(l["customEvent:cidade"]));
        if (cid.length) add("insight", "Cidades mais lidas (da matéria)", cid.slice(0, 6).map((l) => `${l["customEvent:cidade"]} (${inteiro(num(l.screenPageViews))})`).join(", ") + ". Use no pitch do Portal da Imprensa para essas prefeituras.");
      }
      break;
    }

    case "engajamento": {
      const at = periodo(r.metricas, "atual")[0] ?? {};
      const an = periodo(r.metricas, "anterior")[0] ?? {};
      const ev = agrupar(periodo(r.eventos, "atual"), "eventName", "eventCount");
      const evAn = agrupar(periodo(r.eventos, "anterior"), "eventName", "eventCount");
      const pv = ev.page_view ?? 0;
      const ppS = num(at.screenPageViewsPerSession);
      if (num(at.sessions) >= 50 && ppS < 1.3) add("critico", "Leitor lê uma página e sai", `${ppS.toFixed(2).replace(".", ",")} páginas por sessão. Relacionadas no meio do texto, "Enquanto isso no resto do Paraná" e links de cidade ajudam a subir para 1,6+.`);
      const vEng = variacao(num(at.engagementRate), num(an.engagementRate));
      if (vEng !== null && vEng <= -0.1 && num(at.sessions) >= 50) add("alerta", "Engajamento caiu", `Taxa de engajamento ${pctTexto(vEng)} (${pct(num(an.engagementRate))} → ${pct(num(at.engagementRate))}).`);
      if (pv >= 100) {
        const rel = (ev.clique_relacionada ?? 0) / pv;
        if (rel < 0.02) add("alerta", "Relacionadas pouco clicadas", `Só ${pct(rel, 1)} das visualizações terminam num clique em matéria relacionada. Teste o bloco no meio do texto e títulos mais locais.`);
        const sh = (ev.share ?? 0) / pv;
        if (sh < 0.005) add("insight", "Pouco compartilhamento", `${pct(sh, 2)} das visualizações viram compartilhamento. Botão de WhatsApp fixo no celular costuma dobrar isso.`);
        const sc = (ev.scroll ?? 0) / pv;
        if (sc > 0) add("insight", "Rolagem", `${pct(sc)} das visualizações rolam até 90% da página (medição automática do GA).`);
      }
      for (const nomeEv of ["leitura_completa", "share", "clique_relacionada"]) {
        const v = variacao(ev[nomeEv] ?? 0, evAn[nomeEv] ?? 0);
        if (v !== null && (evAn[nomeEv] ?? 0) >= 20 && v <= -0.3) add("alerta", `${nomeEv} em queda`, `${pctTexto(v)} contra o período anterior.`);
      }
      const blocos = r.blocos ?? [];
      if (blocos.length >= 2) {
        const b = [...blocos].sort((a, c) => num(c.eventCount) - num(a.eventCount));
        add("insight", "Bloco de relacionadas que mais funciona", `"${b[0]["customEvent:bloco"]}" (${inteiro(num(b[0].eventCount))} cliques); o menos clicado é "${b[b.length - 1]["customEvent:bloco"]}".`);
      }
      break;
    }

    case "conversoes": {
      const at = agrupar(periodo(r.totais, "atual"), "eventName", "eventCount");
      const an = agrupar(periodo(r.totais, "anterior"), "eventName", "eventCount");
      const sess = num(periodo(r.sessoes, "atual")[0]?.sessions);
      const leads = at.generate_lead ?? 0;
      const whats = at.clique_whatsapp ?? 0;
      if (sess >= 100 && leads === 0) add("critico", "Nenhum lead no período", `${inteiro(sess)} sessões e nenhum formulário/cadastro concluído. Confira se os formulários estão no ar e se o evento chega (DebugView do GA).`);
      if (sess > 0 && leads > 0) add("insight", "Taxa de lead", `${(leads / sess * 1000).toFixed(1).replace(".", ",")} leads a cada mil sessões.`);
      const vL = variacao(leads, an.generate_lead ?? 0);
      if (vL !== null && (an.generate_lead ?? 0) >= 5 && vL <= -0.3) add("alerta", "Leads em queda", `${pctTexto(vL)} contra o período anterior.`);
      const tipos = (r.leadTipo ?? []).filter((l) => !VAZIO(l["customEvent:lead_tipo"]));
      if (tipos.length) add("insight", "De onde vêm os leads", tipos.map((l) => `${l["customEvent:lead_tipo"]}: ${inteiro(num(l.eventCount))}`).join(" · "));
      const tiposVistos = new Set(tipos.map((l) => String(l["customEvent:lead_tipo"])));
      const faltam = ["portal_imprensa", "newsletter_whatsapp", "publieditorial", "chat_anuncios"].filter((t) => !tiposVistos.has(t));
      if (leads > 0 && faltam.length) add("alerta", "Produtos sem lead", `Nenhum lead de ${faltam.join(", ")} no período. São as portas de receita: dê destaque a elas na home e nas matérias da cidade.`);
      const dest = agrupar(r.whatsapp, "customEvent:destino", "eventCount");
      if (whats > 0) add("insight", "Cliques de WhatsApp", `Comunidade: ${inteiro(dest.comunidade ?? 0)} · comercial: ${inteiro(dest.comercial ?? 0)}.`);
      if (whats > 0 && (dest.comercial ?? 0) === 0) add("alerta", "Nenhum contato comercial", "Todos os cliques de WhatsApp foram para a comunidade; nenhum para o comercial. O botão \"Anuncie\" precisa aparecer mais.");
      const fontes = agrupar((r.fonte ?? []).filter((l) => l.eventName === "generate_lead"), "sessionSourceMedium", "eventCount");
      const topF = Object.entries(fontes).sort((a, b) => b[1] - a[1])[0];
      if (topF) add("insight", "Fonte que mais converte", `${topF[0]} gerou ${inteiro(topF[1])} leads.`);
      break;
    }

    case "busca": {
      const termos = (r.termos ?? []).filter((l) => !VAZIO(l.searchTerm));
      const total = soma(termos, "eventCount");
      if (!total) {
        add("insight", "Busca recém-ligada", "A busca do site (/busca) entrou no ar agora: os termos aparecem aqui depois das primeiras buscas.");
        break;
      }
      add("insight", "O que o leitor procura", termos.slice(0, 8).map((l) => `"${l.searchTerm}" (${inteiro(num(l.eventCount))})`).join(", ") + ". Termo que aparece muito é pauta ou atalho que falta na home.");
      const cidades = termos.filter((l) => /^[a-zà-ú\s-]{3,}$/i.test(String(l.searchTerm)) && String(l.searchTerm).split(" ").length <= 3).slice(0, 5);
      if (cidades.length) add("insight", "Atalhos", "Termos curtos repetidos (nomes de cidade, bairros, órgãos) podem virar atalho no menu ou página própria.");
      break;
    }

    case "tempo-real": {
      const tot = num(r.total?.[0]?.activeUsers);
      if (tot === 0) add("alerta", "Ninguém no site agora (medido)", "Nenhum leitor com cookies aceitos nos últimos 30 minutos. Pode ser só a amostra pequena do Consent Mode.");
      const top = r.paginas?.[0];
      if (top && num(top.activeUsers) >= 3) add("insight", "Puxando agora", `"${String(top.unifiedScreenName).slice(0, 80)}" com ${inteiro(num(top.activeUsers))} leitores — bom momento para postar no Instagram/WhatsApp.`);
      break;
    }

    case "qualidade": {
      const c = x.consentimento;
      if (c && c.exibido >= 20) {
        const taxa = c.aceito / c.exibido;
        if (taxa < 0.3) add("critico", "Aceite de cookies baixo", `Só ${pct(taxa)} de quem vê o banner aceita (${inteiro(c.aceito)} de ${inteiro(c.exibido)}). O GA e a nossa base enxergam só essa fração: todos os números do painel são amostra.`);
        else add("insight", "Aceite de cookies", `${pct(taxa)} de quem vê o banner aceita. Os números do GA representam essa fração dos leitores.`);
        const sem = Math.max(0, c.exibido - c.aceito - c.recusado);
        if (sem / c.exibido > 0.5) add("alerta", "Banner ignorado", `${pct(sem / c.exibido)} dos leitores não respondem ao banner (fecham a página antes). Sem resposta, não são contados.`);
      } else {
        add("insight", "Contador de aceite começando", "A contagem do banner começa com a publicação do site (migração 098). Volte em alguns dias.");
      }
      const pv = num(r.pageviews?.[0]?.screenPageViews);
      if (x.pageviewsBase !== undefined && pv > 0) {
        const razao = x.pageviewsBase / pv;
        if (razao < 0.7 || razao > 1.3) add("alerta", "GA × base própria", `GA: ${inteiro(pv)} visualizações; nossa base: ${inteiro(x.pageviewsBase)}. Diferença acima de 30% indica falha de um dos dois rastreadores.`);
        else add("insight", "GA e base própria batem", `GA ${inteiro(pv)} × base ${inteiro(x.pageviewsBase)} visualizações no período.`);
      }
      const chk = (rel: string, dim: string, nome: string) => {
        const linhas = r[rel] ?? [];
        const tot = soma(linhas, "screenPageViews");
        const vaz = soma(linhas.filter((l) => VAZIO(l[dim])), "screenPageViews");
        if (tot >= 50 && vaz / tot > 0.7) add("alerta", `${nome} vazia demais`, `${pct(vaz / tot)} das visualizações sem ${nome}. Esperado na home e nas páginas fixas; se as matérias também saem vazias, o contexto da página não está chegando ao GA.`);
      };
      chk("editoriaVazia", "customEvent:editoria", "editoria");
      chk("regiaoVazia", "customEvent:regiao", "região");
      const canais = r.canalVazio ?? [];
      const totS = soma(canais, "sessions");
      const unas = num(canais.find((l) => l.sessionDefaultChannelGroup === "Unassigned")?.sessions);
      if (totS >= 50 && unas / totS > 0.1) add("alerta", "Sessões sem canal", `${pct(unas / totS)} das sessões sem canal (UTM fora do padrão).`);
      const interno = soma((r.interno ?? []).filter((l) => !VAZIO(l.testDataFilterName)), "eventCount");
      if (interno > 0) add("alerta", "Tráfego da equipe entrando nos números", `${inteiro(interno)} eventos marcados como tráfego interno ainda contam nos relatórios: o filtro "Internal Traffic" do GA está em teste. Ative-o em Administrador › Filtros de dados.`);
      break;
    }

    case "base-propria":
      break;
  }
  const ordem: Record<Nivel, number> = { critico: 0, alerta: 1, insight: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
