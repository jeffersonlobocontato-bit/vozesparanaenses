// Vozes Paranaenses — instagram-selecionar
//
// Roda depois dos ciclos (cron da 086, a cada 30 min das 7h às 21h):
//   1. pontua as matérias publicadas nas últimas 12h que ainda não foram ao
//      Instagram e escolhe os posts avulsos do ciclo (alerta, tragédia,
//      segurança, nacional, internacional), dentro das cotas e do teto do dia;
//   2. a partir de `giro_hora`, monta o carrossel "Giro pelo Paraná" com a
//      matéria mais forte de cada região (até 10), uma vez por dia;
//   3. quando sai uma edição nova da Vozes Políticas, monta o card da coluna;
//   4. para cada post: legenda e campos do card pela IA, cards em PNG
//      (assinatura A), upload no bucket `instagram`, e agenda no próximo
//      horário livre (intervalo mínimo entre posts; alerta passa à frente).
// Não publica: quem publica é instagram-publicar, um post por vez.
//
// Body opcional: { forcar_giro?: boolean, simular?: boolean } —
//   simular: escolhe e devolve o plano sem gerar nem gravar nada.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exigirInterno } from "../_shared/auth.ts";
import { COR_REGIAO, ESCOPO, limitar, NOME_REGIAO, type Card } from "../_shared/instagram-cards.ts";
import { imagemComoDataUri, renderizarCard } from "../_shared/instagram-render.ts";
import { limparCredito, montarLegenda, redigir } from "../_shared/instagram-redator.ts";
import { fotoLivrePorTema } from "../_shared/foto-tema.ts";
import {
  agendar,
  chapeuDe,
  CONFIG_PADRAO,
  escolherAvulsos,
  hashtags,
  montarGiro,
  temFotoUtilizavel,
  type Classe,
  type ConfigIG,
  type Escolha,
  type MateriaIG,
} from "../_shared/instagram-selecao.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SITE = "https://vozesparanaenses.com.br";
const ORCAMENTO_MS = 100_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}

const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const horaSP = (d: Date) => Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d));
const inicioDoDiaSP = (d: Date) => new Date(`${diaSP(d)}T00:00:00-03:00`);
const dataPorExtenso = (d: Date) => {
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Linha = {
  id: string; titulo: string; subtitulo: string | null; resumo: string | null; tldr: string | null; slug: string;
  cidade_principal: string | null; imagem_capa_url: string | null; imagem_credito: string | null; foto_origem: string | null;
  publicado_em: string; prioridade_crivo: string | null; tema_crivo: string | null; criticidade_nivel: string | null; destaque_home: boolean | null;
  regiao: { slug: string; nome: string } | null; categoria: { slug: string; nome: string } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirInterno(req);
    if (negado) return negado;
  }
  const inicio = Date.now();
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  let body: { forcar_giro?: boolean; simular?: boolean } = {};
  try { body = await req.json(); } catch { body = {}; }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const agora = new Date();

  const { data: cfgRow } = await sb.from("instagram_config").select("*").eq("id", 1).maybeSingle();
  if (!cfgRow) return json({ error: "sem_config", detail: "Rode a migração 086." }, 500);
  const cfg: ConfigIG = {
    ...CONFIG_PADRAO,
    intervalo_min: cfgRow.intervalo_min,
    intervalo_alerta_min: cfgRow.intervalo_alerta_min,
    teto_dia: cfgRow.teto_dia,
    janela_inicio: cfgRow.janela_inicio,
    janela_fim: cfgRow.janela_fim,
    politica_auto: cfgRow.politica_auto,
  };

  // Posts de hoje (cotas e teto) e o último horário ocupado.
  const { data: postsRecentes } = await sb.from("instagram_posts")
    .select("id, tipo, classe, status, artigos, edicao_id, agendado_para, publicado_em, criado_em")
    .gte("criado_em", new Date(agora.getTime() - 3 * 86_400_000).toISOString());
  const recentes = (postsRecentes ?? []) as Array<{ tipo: string; classe: string | null; status: string; artigos: string[]; edicao_id: string | null; agendado_para: string | null; publicado_em: string | null; criado_em: string }>;
  const jaUsados = new Set(recentes.filter((p) => p.status !== "descartado").flatMap((p) => p.artigos ?? []));
  const hoje = recentes.filter((p) => new Date(p.criado_em) >= inicioDoDiaSP(agora) && !["vetado", "descartado", "erro"].includes(p.status));
  const usadosHoje: Partial<Record<Classe, number>> & { total?: number } = { total: hoje.length };
  for (const p of hoje) if (p.classe) usadosHoje[p.classe as Classe] = (usadosHoje[p.classe as Classe] ?? 0) + 1;
  const ocupados = recentes
    .flatMap((p) => [p.status === "agendado" || p.status === "publicando" ? p.agendado_para : null, p.publicado_em])
    .filter(Boolean)
    .map((t) => new Date(t as string).getTime());
  let ultimo: Date | null = ocupados.length ? new Date(Math.max(...ocupados)) : null;
  const giroHoje = hoje.some((p) => p.tipo === "giro");

  // Audiência: visitas por página (48h) e tráfego do dia.
  const { data: eventos } = await sb.from("analytics_events").select("pagina, ts")
    .eq("tipo_evento", "pageview").gte("ts", new Date(agora.getTime() - 48 * 3_600_000).toISOString()).limit(50_000);
  const visitas = new Map<string, number>();
  let trafegoDia = 0;
  for (const e of (eventos ?? []) as Array<{ pagina: string; ts: string }>) {
    visitas.set(e.pagina, (visitas.get(e.pagina) ?? 0) + 1);
    if (agora.getTime() - new Date(e.ts).getTime() < 86_400_000) trafegoDia++;
  }

  const carregar = async (horas: number) => {
    const { data } = await sb.from("generated_articles")
      .select("id, titulo, subtitulo, resumo, tldr, slug, cidade_principal, imagem_capa_url, imagem_credito, foto_origem, publicado_em, prioridade_crivo, tema_crivo, criticidade_nivel, destaque_home, regiao:regioes(slug, nome), categoria:editorial_categories(slug, nome)")
      .eq("status", "publicado").gte("publicado_em", new Date(agora.getTime() - horas * 3_600_000).toISOString())
      .order("publicado_em", { ascending: false }).limit(400);
    return ((data ?? []) as unknown as Linha[]).filter((l) => !jaUsados.has(l.id));
  };
  const paraMateria = (l: Linha): MateriaIG => ({
    id: l.id, titulo: l.titulo, subtitulo: l.subtitulo, regiao_slug: l.regiao?.slug ?? null, categoria_slug: l.categoria?.slug ?? null,
    cidade_principal: l.cidade_principal, imagem_capa_url: l.imagem_capa_url, foto_origem: l.foto_origem, imagem_credito: l.imagem_credito,
    publicado_em: l.publicado_em, prioridade_crivo: l.prioridade_crivo, tema_crivo: l.tema_crivo, criticidade_nivel: l.criticidade_nivel,
    destaque_home: l.destaque_home, visitas: visitas.get(`/${l.regiao?.slug}/${l.slug}`) ?? 0,
  });

  const linhas12 = await carregar(12);
  const porId = new Map(linhas12.map((l) => [l.id, l]));
  const materias12 = linhas12.map(paraMateria);
  const ctx = { agora, maxVisitas: Math.max(0, ...materias12.map((m) => m.visitas ?? 0)), trafegoDia };
  const fazerGiro = !giroHoje && (body.forcar_giro || horaSP(agora) >= cfgRow.giro_hora);
  const avulsos = escolherAvulsos(materias12, usadosHoje, cfg, ctx, fazerGiro || !giroHoje ? 1 : 0);

  let giro: Escolha[] = [];
  let linhas24: Linha[] = [];
  if (fazerGiro) {
    linhas24 = await carregar(24);
    for (const l of linhas24) porId.set(l.id, l);
    const avulsosIds = new Set(avulsos.map((a) => a.materia.id));
    giro = montarGiro(linhas24.map(paraMateria).filter((m) => !avulsosIds.has(m.id)), cfg, ctx, cfgRow.giro_max);
    if (giro.length < 3) giro = [];
  }

  // Coluna nova da Vozes Políticas.
  let coluna: { id: string; titulo: string; subtitulo: string | null; slug: string | null; notas: string[] } | null = null;
  if (cfgRow.coluna_auto) {
    const { data: col } = await sb.from("colunas").select("id").eq("slug", "vozes-politicas").maybeSingle();
    if (col) {
      const { data: ed } = await sb.from("coluna_edicoes").select("id, titulo, subtitulo, slug, publicado_em")
        .eq("coluna_id", col.id).eq("status", "publicado").gte("publicado_em", new Date(agora.getTime() - 24 * 3_600_000).toISOString())
        .order("publicado_em", { ascending: false }).limit(1).maybeSingle();
      if (ed && !recentes.some((p) => p.edicao_id === ed.id)) {
        const { data: ns } = await sb.from("coluna_notas").select("titulo_gatilho").eq("edicao_id", ed.id).order("ordem");
        coluna = { id: ed.id, titulo: ed.titulo, subtitulo: ed.subtitulo, slug: ed.slug, notas: ((ns ?? []) as Array<{ titulo_gatilho: string }>).map((n) => n.titulo_gatilho) };
      }
    }
  }

  const plano = {
    avulsos: avulsos.map((a) => ({ id: a.materia.id, titulo: a.materia.titulo, classe: a.classe, score: a.score })),
    giro: giro.map((g) => ({ id: g.materia.id, regiao: g.materia.regiao_slug, titulo: g.materia.titulo, score: g.score })),
    coluna: coluna?.titulo ?? null,
    usados_hoje: usadosHoje,
    trafego_dia: trafegoDia,
  };
  if (body.simular) return json({ ok: true, simulacao: true, plano });

  // Horários: tudo o que vai entrar neste ciclo, alertas à frente.
  type Novo = { chave: string; alerta: boolean; score: number };
  const novos: Novo[] = [
    ...avulsos.map((a) => ({ chave: a.materia.id, alerta: a.classe === "alerta", score: a.score })),
    ...(giro.length ? [{ chave: "giro", alerta: false, score: 40 }] : []),
    ...(coluna ? [{ chave: "coluna", alerta: false, score: 35 }] : []),
  ];
  const horarios = agendar(novos, ultimo, agora, cfg);

  const resultado: Array<Record<string, unknown>> = [];
  const dentro = () => Date.now() - inicio < ORCAMENTO_MS;

  async function subir(postId: string, pngs: Uint8Array[]): Promise<string[]> {
    const urls: string[] = [];
    for (let i = 0; i < pngs.length; i++) {
      const path = `${diaSP(agora)}/${postId}/${String(i + 1).padStart(2, "0")}.png`;
      const { error } = await sb.storage.from("instagram").upload(path, pngs[i], { contentType: "image/png", upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
      urls.push(sb.storage.from("instagram").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  async function cardDaMateria(l: Linha, classe: Classe, lamina?: { atual: number; total: number }): Promise<{ card: Card; red: Awaited<ReturnType<typeof redigir>> | null; fotoUrl?: string | null; credito?: string | null }> {
    const m = paraMateria(l);
    const ch = chapeuDe(m, l.categoria?.nome ?? null, l.regiao ? (NOME_REGIAO[l.regiao.slug] ?? l.regiao.nome) : null);
    const red = lamina ? null : await redigir({ apiKey: aiKey, classe, titulo: l.titulo, subtitulo: l.subtitulo, texto: [l.tldr, l.resumo].filter(Boolean).join("\n") || l.subtitulo || "" });
    const titulo = red?.titulo ?? limitar(l.titulo, 100);
    const linhaFina = red?.linhaFina ?? (l.subtitulo ? limitar(l.subtitulo, 150) : null);
    if (classe === "alerta") {
      return { card: { formato: "alerta", chapeu: ch.texto, titulo, quando: red?.quando ?? null, dados: red?.dados ?? [], orientacao: red?.orientacao ?? null }, red };
    }
    let foto = temFotoUtilizavel(m, classe) && l.imagem_capa_url ? await imagemComoDataUri(l.imagem_capa_url) : null;
    let creditoFoto = limparCredito(l.imagem_credito);
    let fotoUrl = l.imagem_capa_url;
    // Matéria sem foto (post avulso): tenta uma foto real de licença livre do
    // lugar/tema no Wikimedia Commons, aprovada pela analista de imagem só
    // com risco baixo (ex.: Cataratas do Iguaçu). Nunca em alerta/tragédia.
    if (!foto && !lamina && aiKey && classe !== "tragedia" && Date.now() - inicio < ORCAMENTO_MS - 40_000) {
      try {
        const livre = await fotoLivrePorTema({
          sb, aiKey, articleId: l.id, titulo: l.titulo,
          resumo: [l.tldr, l.resumo].filter(Boolean).join(" ") || l.subtitulo,
          escopo: l.categoria?.nome ?? l.regiao?.nome ?? "geral",
        });
        if (livre && !("sensivel" in livre)) {
          foto = await imagemComoDataUri(livre.url);
          if (foto) { creditoFoto = limparCredito(livre.credito); fotoUrl = livre.url; }
        }
      } catch { /* sem foto livre: segue no tipográfico */ }
    }
    const corLamina = lamina && l.regiao ? COR_REGIAO[l.regiao.slug] : null;
    if (foto) {
      return {
        card: {
          formato: "foto", chapeu: lamina ? [l.cidade_principal, NOME_REGIAO[l.regiao?.slug ?? ""] ?? l.regiao?.nome].filter(Boolean).join(" · ") : ch.texto,
          cor: corLamina ?? ESCOPO[ch.escopo].claro, titulo, linhaFina, foto, credito: creditoFoto,
          lamina: lamina ? { ...lamina, rotulo: "Giro pelo Paraná" } : undefined,
        },
        red,
        fotoUrl,
        credito: fotoUrl === l.imagem_capa_url ? l.imagem_credito : creditoFoto,
      };
    }
    return {
      card: {
        formato: "tipografico", chapeu: lamina ? [l.cidade_principal, NOME_REGIAO[l.regiao?.slug ?? ""] ?? l.regiao?.nome].filter(Boolean).join(" · ") : ch.texto,
        cor: corLamina ? "#f0b07a" : ESCOPO[ch.escopo].escuro, titulo, linhaFina, destaque: lamina ? null : red?.destaque ?? null,
      },
      red,
    };
  }

  // 1. Avulsos
  for (const a of avulsos) {
    if (!dentro()) { resultado.push({ id: a.materia.id, pulado: "sem tempo neste ciclo" }); continue; }
    const quando = horarios.get(a.materia.id);
    if (!quando) { resultado.push({ id: a.materia.id, pulado: "fora da janela de hoje" }); continue; }
    const l = porId.get(a.materia.id)!;
    try {
      const { card, red, fotoUrl, credito } = await cardDaMateria(l, a.classe);
      const png = await renderizarCard(card);
      const postId = crypto.randomUUID();
      const imagens = await subir(postId, [png]);
      const nomeRegiao = l.regiao ? (NOME_REGIAO[l.regiao.slug] ?? l.regiao.nome) : null;
      const local = [l.cidade_principal, nomeRegiao && l.regiao?.slug !== "nacional" && l.regiao?.slug !== "internacional" ? nomeRegiao : null].filter(Boolean).join(" · ") || null;
      const legenda = montarLegenda({
        texto: red?.legenda ?? l.titulo, local, credito: card.formato === "foto" ? credito : null,
        chamada: a.classe === "alerta" ? "Mais informações no link da bio." : undefined,
        hashtags: hashtags(a.materia, nomeRegiao),
      });
      const { error } = await sb.from("instagram_posts").insert({
        id: postId, tipo: card.formato === "foto" ? "foto" : card.formato, classe: a.classe, status: "agendado",
        artigos: [l.id], score: a.score, motivo: `${a.classe} · peso ${a.score}`, // guarda a URL da foto (não o data URI) para poder renderizar de novo
        card: card.formato === "foto" ? { ...card, foto: fotoUrl } : card,
        legenda, imagens, links: [{ titulo: l.titulo, url: `${SITE}/${l.regiao?.slug}/${l.slug}` }], agendado_para: quando.toISOString(),
      });
      if (error) throw new Error(error.message);
      ultimo = quando;
      resultado.push({ id: l.id, post: postId, classe: a.classe, agendado_para: quando.toISOString() });
    } catch (e) {
      resultado.push({ id: a.materia.id, erro: (e as Error).message });
    }
  }

  // 2. Giro pelo Paraná (capa + até 9 lâminas: o Instagram aceita 10 imagens por carrossel)
  if (giro.length && dentro()) {
    const quando = horarios.get("giro");
    if (quando) {
      try {
        const laminas = giro.slice(0, 9);
        const capa: Card = {
          formato: "giro-capa", data: dataPorExtenso(agora),
          itens: giro.map((g) => { const l = porId.get(g.materia.id)!; return { regiao: l.regiao?.slug ?? "", cidade: l.cidade_principal, titulo: l.titulo }; }),
        };
        const pngs = [await renderizarCard(capa)];
        for (let i = 0; i < laminas.length && dentro(); i++) {
          const l = porId.get(laminas[i].materia.id)!;
          const { card } = await cardDaMateria(l, "regional", { atual: i + 1, total: laminas.length });
          pngs.push(await renderizarCard(card));
        }
        const postId = crypto.randomUUID();
        const imagens = await subir(postId, pngs);
        const linhasGiro = giro.map((g) => porId.get(g.materia.id)!);
        const texto = `Giro pelo Paraná: as notícias de hoje em ${giro.length} regiões.\n\n` +
          linhasGiro.map((l, i) => `${i + 1}. ${NOME_REGIAO[l.regiao?.slug ?? ""] ?? l.regiao?.nome}${l.cidade_principal ? ` (${l.cidade_principal})` : ""}: ${l.titulo}`).join("\n");
        const legenda = montarLegenda({ texto, chamada: "Leia todas no link da bio.", hashtags: ["#VozesParanaenses", "#Parana", "#GiroPeloParana"] });
        const { error } = await sb.from("instagram_posts").insert({
          id: postId, tipo: "giro", classe: "regional", status: "agendado", artigos: linhasGiro.map((l) => l.id),
          score: Math.max(...giro.map((g) => g.score)), motivo: `giro · ${giro.length} regiões`, card: capa, legenda, imagens,
          links: linhasGiro.map((l) => ({ titulo: l.titulo, url: `${SITE}/${l.regiao?.slug}/${l.slug}` })), agendado_para: quando.toISOString(),
        });
        if (error) throw new Error(error.message);
        resultado.push({ giro: postId, regioes: giro.length, imagens: imagens.length, agendado_para: quando.toISOString() });
      } catch (e) {
        resultado.push({ giro: "erro", erro: (e as Error).message });
      }
    } else {
      resultado.push({ giro: "fora da janela de hoje" });
    }
  }

  // 3. Coluna
  if (coluna && dentro()) {
    const quando = horarios.get("coluna");
    if (quando) {
      try {
        const card: Card = { formato: "coluna", coluna: "Vozes Políticas", titulo: coluna.titulo, linhaFina: coluna.subtitulo, notas: coluna.notas.filter((n) => !/^o tabuleiro$/i.test(n)).slice(0, 4) };
        const postId = crypto.randomUUID();
        const imagens = await subir(postId, [await renderizarCard(card)]);
        const texto = `Vozes Políticas: ${coluna.titulo}\n\n${coluna.subtitulo ?? ""}\n\nNesta edição: ${coluna.notas.join("; ")}.`;
        const legenda = montarLegenda({ texto, chamada: "A coluna inteira no link da bio.", hashtags: ["#VozesPoliticas", "#VozesParanaenses", "#Parana"] });
        const { error } = await sb.from("instagram_posts").insert({
          id: postId, tipo: "coluna", classe: "coluna", status: "agendado", edicao_id: coluna.id, score: 35, motivo: "edição nova da coluna",
          card, legenda, imagens, links: [{ titulo: coluna.titulo, url: `${SITE}/coluna/vozes-politicas/${coluna.slug ?? coluna.id}` }], agendado_para: quando.toISOString(),
        });
        if (error) throw new Error(error.message);
        resultado.push({ coluna: postId, agendado_para: quando.toISOString() });
      } catch (e) {
        resultado.push({ coluna: "erro", erro: (e as Error).message });
      }
    }
  }

  return json({ ok: true, plano, resultado, ms: Date.now() - inicio });
});
