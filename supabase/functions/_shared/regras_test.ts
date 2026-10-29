// Testes das regras da automação das 399 cidades (região pela cidade, foto,
// data do dia, ciclos, criticidade, crivo). Rodar a partir da raiz do repo:
//   npx deno run --allow-read supabase/functions/_shared/regras_test.ts
// Sai com código 1 se algum caso falhar.

import { detectarCidade, cidadePorNome } from "./cidades.ts";
import { classificarFoto, ehAgenciaPublica } from "./foto-credito.ts";
import { ehDoDia, extrairDataPublicacao, inicioDoCiclo, diaSaoPaulo } from "./data-publicacao.ts";
import { avaliarRegras } from "./criticidade.ts";
import { decidirFormato, decidirImagem, ehAbrangenciaNacional, motivoDescartePortal, pareceReleaseDeAssessoria, podeIrParaDobra, temaHeuristico, parseCrivo } from "./crivo-editorial.ts";
import { escolherFotoCommons, filtrarCandidatasCommons, promptIlustracao } from "./imagem.ts";
import { escolherFotoBaixoRisco, normalizarAvaliacoes, normalizarPlano } from "./analista-imagem.ts";
import { limparPrefeituraMecanico, verificarTitulo } from "./titulo.ts";
import { dataAtendeNetParaIso, ehAtendeNet, parseListaAtendeNet, parseMateriaAtendeNet } from "./atende-net.ts";
import { ehListaJson, parseListaJson } from "./lista-json.ts";
import { chaveVisual, escolherFundo } from "./instagram-cards.ts";
import { agendar, chapeuDe, classificar, CONFIG_PADRAO, escolherAvulsos, montarGiro, numerosConferem, proximoHorario, temFotoUtilizavel, type MateriaIG } from "./instagram-selecao.ts";
import { corpoTitulo, limitar } from "./instagram-cards.ts";
import { normalizarColuna, separarPautas, textoDaPagina, urlPermitida } from "./coluna-politica.ts";
import { faltando5w1h, motivoVeto5w1h } from "./cinco-w.ts";
import { ehDeHojeOuOntem as hojeOuOntem } from "./data-publicacao.ts";
import { calcularRecorte } from "./recorte-marca.ts";
import { cabeNaCotaForaDoPr, faixaForaDoPr } from "./crivo-editorial.ts";
import { CICLOS_PORTAIS, cicloAtual, fonteElegivel, imagemValida, normalizarUrl, ordenarPorTentativa } from "./coleta.ts";
import { ehFotoGenerica, escolherFotoGenerica } from "./foto-generica.ts";

const src = Deno.readTextFileSync(new URL("../../../src/lib/parana-municipios.ts", import.meta.url));
const cidades = [...src.matchAll(/\{ slug: "([^"]+)", name: "([^"]+)", region: "([^"]+)" \}/g)].map((m) => ({ slug: m[1], nome: JSON.parse(`"${m[2]}"`), regiao_id: m[3] }));
let falhas = 0;
const ok = (nome: string, cond: boolean, extra = "") => { if (!cond) falhas++; console.log(`${cond ? "✓" : "✗"} ${nome} ${extra}`); };

// Região pela cidade citada
const fonteCwb = { regiao_id: "metropolitana", cidade_slug: "curitiba", abrangencia: "regional" };
let d = detectarCidade("Palotina recebe nova unidade de saúde", "CURITIBA – O governo do estado anunciou nesta quarta...", cidades, fonteCwb);
ok("Palotina em jornal de Curitiba → Oeste", d?.slug === "palotina" && d?.regiao_id === "oeste", JSON.stringify(d));
d = detectarCidade("Governo anuncia obras", "Curitiba, 22 de outubro de 2026 – As obras em Palotina começam segunda. Em Palotina, a prefeitura...", cidades, fonteCwb);
ok("dateline de Curitiba ignorado", d?.slug === "palotina", JSON.stringify(d));
d = detectarCidade("Polícia prende suspeito", "O delegado João de Castro informou que o caso segue.", cidades, fonteCwb);
ok("sobrenome Castro não vira cidade", d === null, JSON.stringify(d));
d = detectarCidade("Festa de São João reúne famílias", "A festa de São João foi um sucesso.", cidades, fonteCwb);
ok("festa de São João não vira cidade", d === null, JSON.stringify(d));
d = detectarCidade("Feira acontece no sábado", "A feira ocorre na praça central.", cidades, { regiao_id: "oeste", cidade_slug: "palotina", abrangencia: "municipal" });
ok("sem cidade no texto + fonte municipal → sede", d?.slug === "palotina" && d?.via === "fonte");
d = detectarCidade("Feira acontece no sábado", "A feira ocorre na praça central.", cidades, fonteCwb);
ok("sem cidade + fonte regional → null", d === null);
d = detectarCidade("Foz do Iguaçu recebe turistas", "", cidades);
ok("nome mais longo vence", d?.slug === "foz-do-iguacu", JSON.stringify(d));
ok("cidadePorNome('Palotina (PR)')", cidadePorNome("Palotina (PR)", cidades)?.slug === "palotina");
ok("cidadePorNome('São José dos Pinhais')", cidadePorNome("São José dos Pinhais", cidades)?.slug === "sao-jose-dos-pinhais");

// Foto
const veic = ["Gazeta do Povo", "Extra Guarapuava", "Portal de Beltrão"];
const casos: Array<[string | null, string]> = [
  ["Foto: Divulgação/Prefeitura de Palotina", "autorizada"],
  ["Assessoria de Imprensa", "autorizada"],
  ["João Silva/PMC", "autorizada"],
  ["AEN", "autorizada"],
  ["Foto: Gilson Abreu/AEN", "autorizada"],
  ["Foto: João Silva", "proibida"],
  ["Imagem: reprodução — Extra Guarapuava", "proibida"],
  ["Cozinhando com a Dete! / Portal de Beltrão", "proibida"],
  ["Reprodução/Prefeitura", "proibida"],
  ["Arquivo pessoal", "proibida"],
  ["Imagem: gerada por IA (Vozes Paranaenses)", "proibida"],
  ["Foto: Albari Rosa/Gazeta do Povo", "proibida"],
  ["Foto: Pública", "autorizada"],
  [null, "sem_credito"],
];
for (const [cred, esperado] of casos) {
  const r = classificarFoto("https://x/img.jpg", cred, veic);
  ok(`foto "${cred}" → ${esperado}`, r === esperado, r !== esperado ? `(veio ${r})` : "");
}
ok("sem imagem → sem_foto", classificarFoto(null, "Divulgação") === "sem_foto");

// Datas
const agora = new Date("2026-10-22T14:30:00-03:00");
ok("hoje (Brasília)", ehDoDia("2026-10-22T09:00:00-03:00", agora));
ok("ontem 23h Brasília ≠ hoje", !ehDoDia("2026-10-21T23:30:00-03:00", agora));
ok("UTC 01h de 22/10 = 21/10 22h Brasília ≠ hoje", !ehDoDia("2026-10-22T01:00:00Z", agora));
ok("sem data → false", !ehDoDia(null, agora));
let x = extrairDataPublicacao('<meta property="article:published_time" content="2026-10-22T10:15:00-03:00">', "https://a/b");
ok("meta article", x?.origem === "meta_article" && ehDoDia(x.iso, agora));
x = extrairDataPublicacao('<script type="application/ld+json">{"datePublished":"2026-10-22T08:00:00-0300"}</script>', "https://a/b");
ok("jsonld", x?.origem === "jsonld" && ehDoDia(x!.iso, agora), JSON.stringify(x));
x = extrairDataPublicacao("<p>Publicado em 22/10/2026 às 09h30</p>", "https://a/b");
ok("texto dd/mm/aaaa", x?.origem === "texto" && ehDoDia(x!.iso, agora), JSON.stringify(x));
x = extrairDataPublicacao("<p>nada</p>", "https://a.com/2026/10/22/noticia");
ok("data na URL", x?.origem === "url" && ehDoDia(x!.iso, agora), JSON.stringify(x));
x = extrairDataPublicacao("<span>Início Notícias Publicado em: 22/10/2026 11:25 | Fonte</span>", "https://a/b");
ok("Publicado em: dd/mm/aaaa hh:mm", x?.origem === "texto" && ehDoDia(x!.iso, agora), JSON.stringify(x));
x = extrairDataPublicacao("<div>Imprimir Fechar Data de Publica&ccedil;&atilde;o: 22 de outubro de 2026</div>", "https://a/b");
ok("Data de Publicação por extenso", x?.origem === "texto" && ehDoDia(x!.iso, agora), JSON.stringify(x));
x = extrairDataPublicacao("<p>Publicado em 22 de outubro de 2026 às 10:30 hs.</p>", "https://a/b");
ok("Publicado em ... às hh:mm", x?.iso === "2026-10-22T13:30:00.000Z", JSON.stringify(x));
x = extrairDataPublicacao("<p>Administração - Segunda-feira, 19 de Outubro de 2026 Início Notícia</p>", "https://a/b");
ok("editoria - dia-da-semana, data", x?.iso?.startsWith("2026-10-19") === true, JSON.stringify(x));
x = extrairDataPublicacao("<header>Sabáudia, quinta-feira, 22 de outubro de 2026 (43) 3151-1122</header><p>texto</p>", "https://a/b");
ok("data de HOJE no cabeçalho NÃO conta", x === null, JSON.stringify(x));
x = extrairDataPublicacao("<p>Versão do sistema: 2.0.0 - 22/10/2026 . Data: 22 de outubro de 2026</p>", "https://a/b");
ok("versão do sistema / Data: solto NÃO contam", x === null, JSON.stringify(x));
ok("sem data → null", extrairDataPublicacao("<p>nada</p>", "https://a.com/noticia") === null);
// Coluna Vozes Políticas — pautas na ordem
{
  const p1 = separarPautas("https://a.com/x helicóptero\n\nTRE-PR e Moro: https://b.com/y.\n\nFechamento sobre o Senado");
  ok("pautas por linha em branco, na ordem", p1.length === 3 && p1[0].urls[0] === "https://a.com/x" && p1[1].urls[0] === "https://b.com/y" && p1[2].urls.length === 0, JSON.stringify(p1));
  const p2 = separarPautas("1. https://a.com/1\n2) https://a.com/2\n- tema solto");
  ok("uma pauta por linha, sem numeração", p2.length === 3 && p2[2].texto === "tema solto" && p2[0].texto === "https://a.com/1", JSON.stringify(p2));
  ok("pauta vazia", separarPautas("  \n ").length === 0);
  const c = normalizarColuna({ titulo: "T", subtitulo: "S", pergunta_engajamento: "", notas: [
    { pauta: 2, titulo_gatilho: "B", corpo: "b" }, { pauta: null, fechamento: true, titulo_gatilho: "Fim", corpo: "f" }, { pauta: 1, titulo_gatilho: "A", corpo: "a" },
  ] }, 2);
  ok("notas na ordem das pautas, fechamento no fim", c?.notas.map((n) => n.titulo_gatilho).join(",") === "A,B,Fim" && c?.pergunta_engajamento === null, JSON.stringify(c));
  ok("resposta sem notas é inválida", normalizarColuna({ titulo: "T", notas: [] }, 2) === null);
  ok("bloqueia rede interna", !urlPermitida("http://localhost/x") && !urlPermitida("http://192.168.0.1/") && !urlPermitida("file:///etc") && urlPermitida("https://www.bemparana.com.br/noticia"));
  const pg2 = textoDaPagina('<head><meta property="og:title" content="Título &amp; tal"></head><article><p>Parágrafo curto</p><p>Este é um parágrafo longo o bastante para entrar no texto da fonte.</p></article>');
  ok("texto da página: og:title e parágrafos longos", pg2.titulo === "Título & tal" && pg2.texto.startsWith("Este é"), JSON.stringify(pg2));
}
// Robô do Instagram — classes, peso, giro e horários
{
  const base = (o: Partial<MateriaIG>): MateriaIG => ({ id: crypto.randomUUID(), titulo: "x", regiao_slug: "oeste", categoria_slug: "cidades", publicado_em: "2026-10-25T12:00:00-03:00", prioridade_crivo: "media", tema_crivo: "geral", criticidade_nivel: "baixo", ...o });
  const c = (o: Partial<MateriaIG>) => classificar(base(o)).classe;
  ok("IG: alerta de tempestade", c({ titulo: "Alertas indicam tempestades com ventos de 100 km/h", tema_crivo: "utilidade_publica", prioridade_crivo: "alta" }) === "alerta");
  ok("IG: deslizamento bloqueia rodovia é alerta", c({ titulo: "Chuvas provocam deslizamentos e bloqueiam rodovias", prioridade_crivo: "alta" }) === "alerta");
  ok("IG: morte em acidente é tragédia", c({ titulo: "Homem morre em acidente na PR-317", prioridade_crivo: "alta", criticidade_nivel: "medio" }) === "tragedia");
  ok("IG: criticidade alta fica fora", c({ titulo: "Suspeito é preso", criticidade_nivel: "alto" }) === "fora");
  ok("IG: política fica fora do automático", c({ titulo: "Urnas", categoria_slug: "eleicoes-2026" }) === "fora" && c({ titulo: "x", categoria_slug: "politica" }) === "fora");
  ok("IG: esporte fica fora", c({ categoria_slug: "esportes", regiao_slug: "nacional" }) === "fora");
  ok("IG: internacional e nacional", c({ regiao_slug: "nacional", categoria_slug: "internacional" }) === "internacional" && c({ regiao_slug: "nacional", categoria_slug: "economia" }) === "nacional");
  ok("IG: regional vai para o giro", c({ regiao_slug: "litoral" }) === "regional");
  ok("IG: dois tipográficos vizinhos nunca com a mesma cor", escolherFundo(["escuro"]) === "verde" && escolherFundo(["escuro", "verde"]) === "papel" && chaveVisual({ formato: "tipografico", fundo: escolherFundo([chaveVisual({ formato: "tipografico" })]) }) !== "escuro");
  ok("IG: cor da grade por formato", chaveVisual(null, "giro") === "claro" && chaveVisual({ formato: "foto" }) === "foto" && chaveVisual({ formato: "tipografico", fundo: "areia" }) === "claro");
  const tarde = new Date("2026-10-25T16:40:00-03:00");
  ok("IG: alerta de 8h atrás não é mais alerta", classificar(base({ titulo: "Temporal deixa 5,4 mil imóveis sem energia", tema_crivo: "utilidade_publica", prioridade_crivo: "alta", publicado_em: "2026-10-25T08:00:00-03:00" }), CONFIG_PADRAO, tarde).classe !== "alerta");
  ok("IG: alerta recente segue alerta", classificar(base({ titulo: "Temporal deixa 5,4 mil imóveis sem energia", tema_crivo: "utilidade_publica", prioridade_crivo: "alta", publicado_em: "2026-10-25T14:00:00-03:00" }), CONFIG_PADRAO, tarde).classe === "alerta");
  ok("IG: briga pessoal não vai sozinha como segurança", c({ titulo: "Mulher procura a PM após receber ameaças e ofensas por aplicativo", tema_crivo: "seguranca", categoria_slug: "seguranca", prioridade_crivo: "alta" }) === "regional");
  ok("IG: apreensão é segurança", c({ titulo: "Receita Federal apreende 86 iPhones", tema_crivo: "seguranca", prioridade_crivo: "alta" }) === "seguranca");
  ok("IG: chapéu do estado todo é Paraná", chapeuDe(base({ titulo: "Temporal deixa 5,4 mil imóveis sem energia no Paraná", cidade_principal: null }), "Cidades", "Oeste").texto === "Paraná · Cidades");
  ok("IG: Cataratas marcada como nacional não vira Brasil", chapeuDe(base({ titulo: "Vazão nas Cataratas do Iguaçu atinge 13,7 milhões de l/s", regiao_slug: "nacional", cidade_principal: null }), "Meio Ambiente", null).escopo === "parana");
  ok("IG: tragédia nunca leva foto", !temFotoUtilizavel(base({ imagem_capa_url: "x" }), "tragedia") && !temFotoUtilizavel(base({ imagem_capa_url: "x", titulo: "Vítima é socorrida" }), "regional") && temFotoUtilizavel(base({ imagem_capa_url: "x" }), "regional"));

  const ctx = { agora: new Date("2026-10-25T14:00:00-03:00"), maxVisitas: 0, trafegoDia: 0 };
  const cands = [
    base({ titulo: "Defesa Civil emite alerta de granizo", tema_crivo: "utilidade_publica", prioridade_crivo: "alta" }),
    base({ titulo: "Receita apreende iPhones", tema_crivo: "seguranca", prioridade_crivo: "alta" }),
    base({ titulo: "PM prende quadrilha", tema_crivo: "seguranca", prioridade_crivo: "alta" }),
    base({ titulo: "Operação apreende cigarros", tema_crivo: "seguranca", prioridade_crivo: "media" }),
    base({ titulo: "França detém mil", regiao_slug: "nacional", categoria_slug: "internacional", prioridade_crivo: "alta" }),
    base({ titulo: "Tiroteio nos EUA", regiao_slug: "nacional", categoria_slug: "internacional", prioridade_crivo: "media" }),
  ];
  const esc = escolherAvulsos(cands, {}, CONFIG_PADRAO, ctx);
  ok("IG: cotas — 1 alerta, 2 segurança, 1 internacional", esc.filter((e) => e.classe === "seguranca").length === 2 && esc.filter((e) => e.classe === "internacional").length === 1 && esc[0].classe === "alerta", JSON.stringify(esc.map((e) => e.classe)));
  const cheio = escolherAvulsos(cands, { total: 7 }, CONFIG_PADRAO, ctx);
  ok("IG: teto do dia cheio — só alerta fura", cheio.length === 1 && cheio[0].classe === "alerta", JSON.stringify(cheio.map((e) => e.classe)));

  const giro = montarGiro([
    base({ regiao_slug: "oeste", titulo: "a", prioridade_crivo: "baixa" }),
    base({ regiao_slug: "oeste", titulo: "b", prioridade_crivo: "alta" }),
    base({ regiao_slug: "litoral", titulo: "c", prioridade_crivo: "media" }),
    base({ regiao_slug: "nacional", titulo: "d", prioridade_crivo: "alta" }),
  ], CONFIG_PADRAO, ctx);
  ok("IG: giro — a mais forte de cada região, só PR", giro.length === 2 && giro.find((g) => g.materia.regiao_slug === "oeste")?.materia.titulo === "b", JSON.stringify(giro.map((g) => g.materia.titulo)));

  const agora = new Date("2026-10-25T14:00:00-03:00");
  const ag = agendar([{ chave: "a", alerta: false, score: 50 }, { chave: "b", alerta: true, score: 10 }, { chave: "c", alerta: false, score: 30 }], new Date("2026-10-25T13:40:00-03:00"), agora, CONFIG_PADRAO);
  ok("IG: alerta primeiro, 30 min após o último", ag.get("b")?.toISOString() === "2026-10-25T17:10:00.000Z", String(ag.get("b")?.toISOString()));
  ok("IG: depois 75 min entre posts", ag.get("a")?.toISOString() === "2026-10-25T18:25:00.000Z" && ag.get("c")?.toISOString() === "2026-10-25T19:40:00.000Z", `${ag.get("a")?.toISOString()} ${ag.get("c")?.toISOString()}`);
  ok("IG: fora da janela não agenda", proximoHorario(new Date("2026-10-25T21:30:00-03:00"), agora, CONFIG_PADRAO) === null);
  ok("IG: antes das 7h começa às 7h", proximoHorario(null, new Date("2026-10-25T05:10:00-03:00"), CONFIG_PADRAO)?.toISOString() === "2026-10-25T10:00:00.000Z");
  ok("IG: números do card conferem com o texto", numerosConferem("150 mm", "chuva de até 150 mm") && !numerosConferem("200 mm", "chuva de até 150 mm") && numerosConferem("1.000", "quase 1.000 pessoas"));
  ok("IG: título longo diminui o corpo", corpoTitulo("x".repeat(95), 84) < 84 && limitar("uma frase longa demais aqui", 14) === "uma frase…");
}
// Lista em JSON (DataTables) — Paranaguá
{
  const js = JSON.stringify({ success: true, aaData: [["6318", "23/10/2026", "<a href='/noticias/noticia6318.html'>Projeto Leme prepara jovens de Paranaguá</a>"], ["6317", "22/10/2026", "<a href='/noticias/noticia6317.html'>Prefeitura reforça sinalização viária</a>"]] });
  const it = parseListaJson(js, "https://www.paranagua.pr.gov.br/include/processo-listar-noticias.php");
  ok("lista JSON: 2 itens com URL absoluta", it.length === 2 && it[0].url === "https://www.paranagua.pr.gov.br/noticias/noticia6318.html", JSON.stringify(it[0]));
  ok("lista JSON: data dd/mm/aaaa vira ISO", it[0].data === "2026-10-23T15:00:00.000Z" && ehDoDia(it[0].data, new Date("2026-10-23T18:00:00-03:00")), String(it[0].data));
  ok("lista JSON: detecta endpoint", ehListaJson("https://www.paranagua.pr.gov.br/include/processo-listar-noticias.php") && !ehListaJson("https://a.pr.gov.br/noticias"));
}
// Formatos das prefeituras reativadas (out/2026) — data junto ao título
const pg = (og: string, corpo: string) => `<html><head><meta property="og:title" content="${og}"></head><body>${corpo}</body></html>`;
const menu = "Início Serviços Transparência Ouvidoria Licitações Concursos Secretarias Contato ".repeat(3);
x = extrairDataPublicacao(pg("Produtor rural: atenção ao prazo", `${menu}<h1>Produtor rural: atenção ao prazo</h1><p>texto longo da matéria</p><div>Compartilhe: <span>22</span> / <span>Out,</span> / <span>2026</span> Por: Última modificação em 22/10/2026</div>`), "https://a/noticias_individual/1");
ok("noticias_site: Compartilhe: 22 Out, 2026 Por:", x?.iso?.startsWith("2026-10-22") === true, JSON.stringify(x));
x = extrairDataPublicacao(pg("Imbaú ganha destaque na revista Terras de Riquezas...", `${menu} Notícias Principal Notícias Notícia OUT 23 23 OUT 2026 AGRICULTURA, PECUÁRIA E ABASTECIMENTO SECRETARIAS 15 visualizações Imbaú ganha destaque na revista Terras de Riquezas com avanços`), "https://a/portal/noticias/0/3/2714/x");
ok("portal: Notícia OUT 23 23 OUT 2026", x?.iso?.startsWith("2026-10-23") === true, JSON.stringify(x));
x = extrairDataPublicacao(pg("Trupe Duda, de Planalto, encanta o público na V Mostra de Circo", `${menu} Trupe Duda, de Planalto, encanta o público na V Mostra de Circo 23 de outubro de 2026 A arte circense`), "https://a/noticia/1945");
ok("título seguido de 23 de outubro de 2026", x?.iso?.startsWith("2026-10-23") === true, JSON.stringify(x));
x = extrairDataPublicacao(pg("PADROEIRO DO MUNICÍPIO GANHA NOVO VISUAL APÓS REVITALIZAÇÃO - PREFEITURA DE MAUÁ DA SERRA", `${menu} Padroeiro do município ganha novo visual após revitalização 18 de Outubro de 2026 A Prefeitura`), "https://a/noticia?uri=x");
ok("og:title em caixa alta com nome do site", x?.iso?.startsWith("2026-10-18") === true, JSON.stringify(x));
x = extrairDataPublicacao(pg("Campina Grande do Sul realiza leilão online de bens móveis", `${menu} Início Portal de Not&#237;cias Not&#237;cias Administra&#231;&#227;o 23 de outubro de 2026 Campina Grande do Sul realiza leilão online de bens móveis`), "https://a/noticia/campina");
ok("data logo antes do título (entidades numéricas)", x?.iso?.startsWith("2026-10-23") === true, JSON.stringify(x));
x = extrairDataPublicacao(pg("Missal chega a 100 óculos entregues em 2026", `${menu} Missal chega a 100 óculos entregues em 2026 22 de Outubro, 2026 texto`), "https://a/noticias/missal/");
ok("22 de Outubro, 2026", x?.iso?.startsWith("2026-10-22") === true, JSON.stringify(x));
x = extrairDataPublicacao("<p>Data de publicação: 17:10 sexta-feira, 23/10/2026</p>", "https://a/noticias/noticia/1");
ok("Data de publicação: hh:mm dia-da-semana, dd/mm/aaaa", x?.iso === "2026-10-23T20:10:00.000Z", JSON.stringify(x));
x = extrairDataPublicacao(`<head><meta name="og:title" content="Prefeitura convoca credores de empenhos antigos até 28 de outubro | Prefeitura Municipal de Formosa do Oeste - PR"></head><body>${menu} Notícias Página Inicial Notícias Prefeitura convoca credores de empenhos antigos até 28 de outubro --> --> Imprimir Fechar 16 de outubro de 2026 texto</body>`, "https://a/noticia/view/36/x");
ok("og:title com name= e '|'", x?.iso?.startsWith("2026-10-16") === true, JSON.stringify(x));
x = extrairDataPublicacao('<head><meta property="og:article:published_time" content="2026-10-22"></head>', "https://a/noticiasView/1_x.html");
ok("og:article:published_time", x?.origem === "meta_article" && x.iso.startsWith("2026-10-22"), JSON.stringify(x));
x = extrairDataPublicacao(pg("Prefeitura abre inscrições para curso de informática", `<div>Sabáudia, quinta-feira, 22 de outubro de 2026</div>${menu}${menu} Prefeitura abre inscrições para curso de informática Texto da matéria sem data nenhuma.`), "https://a/noticia/9");
ok("data de HOJE no topo, longe do título, NÃO conta", x === null, JSON.stringify(x));

ok("inicio ciclo 11h", inicioDoCiclo(11, agora).toISOString() === "2026-10-22T14:00:00.000Z");

// Ciclos (prefeituras 12h/18h, portais 10h/16h/21h)
ok("14h30 → prefeituras fechado", cicloAtual(agora) === null);
ok("12h20 → prefeituras ciclo 12", cicloAtual(new Date("2026-10-22T12:20:00-03:00")) === 12);
ok("11h20 → prefeituras fechado", cicloAtual(new Date("2026-10-22T11:20:00-03:00")) === null);
ok("19h50 → prefeituras ciclo 18", cicloAtual(new Date("2026-10-22T19:50:00-03:00")) === 18);
ok("20h → prefeituras fechado", cicloAtual(new Date("2026-10-22T20:00:00-03:00")) === null);
ok("10h30 → portais ciclo 10", cicloAtual(new Date("2026-10-22T10:30:00-03:00"), CICLOS_PORTAIS) === 10);
ok("16h10 → portais ciclo 16", cicloAtual(new Date("2026-10-22T16:10:00-03:00"), CICLOS_PORTAIS) === 16);
ok("22h50 → portais ciclo 21", cicloAtual(new Date("2026-10-22T22:50:00-03:00"), CICLOS_PORTAIS) === 21);
ok("12h → portais fechado", cicloAtual(new Date("2026-10-22T12:00:00-03:00"), CICLOS_PORTAIS) === null);
const t1220 = new Date("2026-10-22T12:20:00-03:00");
ok("fonte coletada 7h hoje → elegível no ciclo 12", fonteElegivel({ id: "1", nome: "x", regiao_id: null, frequencia_horas: null, ultimo_scrape_em: "2026-10-22T07:00:00-03:00" }, t1220));
ok("fonte coletada 12h05 → não elegível", !fonteElegivel({ id: "1", nome: "x", regiao_id: null, frequencia_horas: null, ultimo_scrape_em: "2026-10-22T12:05:00-03:00" }, t1220));
const t1615 = new Date("2026-10-22T16:15:00-03:00");
ok("portal coletado 10h30 → elegível no ciclo 16", fonteElegivel({ id: "1", nome: "x", regiao_id: null, frequencia_horas: null, ultimo_scrape_em: "2026-10-22T10:30:00-03:00" }, t1615, CICLOS_PORTAIS));
ok("normaliza utm/www", normalizarUrl("https://www.a.com/n/?utm_source=x&id=2#top") === "https://a.com/n/?id=2", normalizarUrl("https://www.a.com/n/?utm_source=x&id=2#top"));

// Criticidade (regras)
const r = (t: string) => avaliarRegras(t).nivel;
ok("casos suspeitos de dengue → baixo", r("Saúde confirma 12 casos suspeitos de dengue em Palotina") === "baixo");
ok("candidatos do concurso → baixo", r("Prefeitura divulga lista de candidatos aprovados no concurso") === "baixo");
ok("vacinação de crianças → baixo", r("Campanha de vacinação para crianças começa segunda; segunda dose disponível") === "baixo");
ok("partida de futebol → baixo", r("A partida entre Toledo e Cascavel termina empatada") === "baixo");
ok("suspeito preso → alto", r("Polícia prende o suspeito de assalto em Toledo") === "alto");
ok("criança morre em acidente → alto", r("Criança morre em acidente na BR-277") === "alto");
ok("estupro → critico", r("Homem é investigado por estupro") === "critico");
ok("eleição → alto", r("Segundo turno da eleição para governador movimenta Palotina") === "alto");
ok("Finados/cemitério → baixo", r("Prefeitura define prazo para limpeza de túmulos antes do Dia de Finados; famílias homenageiam entes falecidos e mortos queridos") === "baixo");
ok("homem morre em acidente → medio+", r("Homem morre em acidente na PR-317") !== "baixo");
ok("morte natural → medio", r("Morre aos 90 anos o pioneiro de Palotina") === "medio");

// Crivo
ok("tema vacinação → saude", temaHeuristico("Campanha de vacinação contra gripe") === "saude");
ok("tema festa → evento", temaHeuristico("Festa do Peão terá shows nacionais") === "evento");
ok("tema prefeito entrega → propaganda", temaHeuristico("Prefeito entrega uniformes e celebra parceria") === "propaganda_governo");
ok("parseCrivo", parseCrivo('{"categoria":"saude","tema":"saude","valor_noticioso":true}', "").prioridade === "alta");
const f = (o: Partial<Parameters<typeof decidirFormato>[0]>) => decidirFormato({ origem: "portal", valorNoticioso: true, fotoStatus: "proibida", forcarNota: false, temRegiao: true, ...o });
ok("prefeitura com foto → matéria com a foto", f({ origem: "prefeitura", fotoStatus: "autorizada" }).formato === "materia" && f({ origem: "prefeitura", fotoStatus: "autorizada" }).foto === "fonte_autorizada");
ok("prefeitura com foto e cota estourada → nota", f({ origem: "prefeitura", fotoStatus: "autorizada", forcarNota: true }).formato === "nota");
ok("prefeitura sem foto → nota", f({ origem: "prefeitura", fotoStatus: "sem_foto" }).formato === "nota");
ok("prefeitura sem foto e sem região → descarta", f({ origem: "prefeitura", fotoStatus: "sem_foto", temRegiao: false }).formato === "descartar");
ok("portal com foto liberada → matéria c/ foto", f({ fotoStatus: "autorizada" }).formato === "materia" && f({ fotoStatus: "autorizada" }).foto === "fonte_autorizada");
ok("portal sem foto liberada → matéria sem capa (VAPT-VUPT)", f({}).formato === "materia" && f({}).foto === "nenhuma");
ok("portal sem foto nenhuma → matéria sem capa", f({ fotoStatus: "sem_foto" }).formato === "materia" && f({ fotoStatus: "sem_foto" }).foto === "nenhuma");
ok("portal com cota estourada → descarta (nunca nota)", f({ fotoStatus: "autorizada", forcarNota: true }).formato === "descartar");
ok("dobra: portal sempre", podeIrParaDobra("portal", false));
ok("dobra: prefeitura das 20 maiores", podeIrParaDobra("prefeitura", true));
ok("dobra: prefeitura de cidade pequena fica fora", !podeIrParaDobra("prefeitura", false));
ok("sem valor → descarta", f({ valorNoticioso: false }).formato === "descartar");
ok("prefeitura sem valor → descarta", f({ origem: "prefeitura", valorNoticioso: false }).formato === "descartar");

// Atende.Net (IPM): dados em base64 no HTML estático
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const utf8 = (t: string) => new TextEncoder().encode(t);
const latin1 = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0));
ok("atende.net detectado", ehAtendeNet("https://cascavel.atende.net/cidadao/noticia") && !ehAtendeNet("https://www.cascavel.pr.gov.br/noticias"));
ok("data Atende.Net → ISO Brasília", dataAtendeNetParaIso("23/10/2026 14:01:08") === "2026-10-23T14:01:08-03:00");
const listaJson = JSON.stringify({ registros: [{ codigo: "1", titulo: "Educa\u00e7\u00e3o abre vagas", chamada: "Inscri\u00e7\u00f5es at\u00e9 sexta", data: "23/10/2026 09:21:17", url: "/cidadao/noticia/educacao-abre-vagas" }] })
  .replace(/\\\\u/g, "\\u");
const lista = parseListaAtendeNet(`<html><consulta id_elemento="x" dados="${b64(utf8(listaJson))}"></consulta></html>`, "https://cascavel.atende.net");
ok("lista Atende.Net: título, url absoluta e data", lista.length === 1 && lista[0].titulo === "Educação abre vagas" && lista[0].url === "https://cascavel.atende.net/cidadao/noticia/educacao-abre-vagas" && lista[0].data === "2026-10-23T09:21:17-03:00", JSON.stringify(lista));
const corpoHtml = "<p>A prefeitura abriu inscri\u00e7\u00f5es &#8212; at\u00e9 sexta.</p><p>Segundo par\u00e1grafo.</p><div>Imagens Relacionadas</div>";
const dadosPag = JSON.stringify({ midia_capa: "https://cascavel.atende.net/static/portal/img/capa_607x1120.jpeg", data: "23/10/2026 10:34:27" });
const mat = parseMateriaAtendeNet(`<pagina content="${b64(latin1(corpoHtml))}" dados-pagina="${b64(utf8(dadosPag))}"></pagina>`);
ok("matéria Atende.Net: corpo latin1, entidades e rodapé", mat.corpoCompleto.startsWith("A prefeitura abriu inscrições — até sexta.") && mat.corpoCompleto.includes("Segundo parágrafo.") && !mat.corpoCompleto.includes("Imagens"), JSON.stringify(mat.corpoCompleto));
ok("matéria Atende.Net: capa e data", mat.imagem?.endsWith("_607x1120.jpeg") === true && mat.data === "2026-10-23T10:34:27-03:00");

// Regra do título: sem "Prefeitura"; com tag de cidade, sem a cidade
ok("título com Prefeitura viola", verificarTitulo("Prefeitura de Cambará abre PSS na saúde", null).length === 1);
ok("título com a cidade da tag viola", verificarTitulo("Cascavel recebe corrida de 75 anos", "Cascavel").length === 1);
ok("título sem cidade e sem Prefeitura passa", verificarTitulo("Corrida de 75 anos entrega kits a 6 mil atletas", "Cascavel").length === 0);
ok("cidade sem tag pode ficar no título", verificarTitulo("Cambará abre processo seletivo na saúde", null).length === 0);
ok("cidade com acento/caixa é reconhecida", verificarTitulo("SÃO JOSÉ DOS PINHAIS amplia vagas em creches", "São José dos Pinhais").length === 1);
ok("nome de cidade dentro de outra palavra não conta", verificarTitulo("Lapada de sol marca o fim de semana", "Lapa").length === 0);
ok("ajuste mecânico tira Prefeitura de", limparPrefeituraMecanico("Prefeitura de Cambará abre PSS na saúde") === "Cambará abre PSS na saúde");

// Portais (out/2026): assessoria, escopo, crítica política, imagem
const cv = parseCrivo('{"categoria":"meio-ambiente","tema":"geral","valor_noticioso":true,"origem_assessoria":false,"escopo":"parana","critica_politica":false,"imagem":"tematica"}', "");
ok("crivo lê escopo/imagem", cv.escopo === "parana" && cv.imagem === "tematica" && !cv.origem_assessoria);
ok("crivo sem campos novos → padrão seguro", parseCrivo('{"categoria":"cidades","tema":"geral"}', "").imagem === "fato");
ok("assessoria: crédito Divulgação/Prefeitura", pareceReleaseDeAssessoria("Texto qualquer. Foto: Divulgação/Prefeitura de Toledo"));
ok("assessoria: com informações da Prefeitura", pareceReleaseDeAssessoria("A obra começa amanhã. (Com informações da Prefeitura de Cascavel)"));
ok("assessoria: crédito da imagem", pareceReleaseDeAssessoria("", "Prefeitura de Londrina"));
ok("assessoria de imprensa da polícia não conta", !pareceReleaseDeAssessoria("Segundo a assessoria de imprensa da Polícia Militar, dois foram presos."));
ok("descarta release de assessoria", motivoDescartePortal({ origem_assessoria: true, escopo: "parana", critica_politica: false }) !== null);
ok("descarta nacional em portal do PR", motivoDescartePortal({ origem_assessoria: false, escopo: "nacional", critica_politica: false }) !== null);
ok("descarta crítica política", motivoDescartePortal({ origem_assessoria: false, escopo: "parana", critica_politica: true }) !== null);
ok("mantém fato paranaense", motivoDescartePortal({ origem_assessoria: false, escopo: "parana", critica_politica: false }) === null);
const fi = (o: Partial<Parameters<typeof decidirImagem>[0]>) => decidirImagem({ origem: "portal", fotoStatus: "proibida", categoriaSlug: "cidades", tipoImagem: "fato", temCidade: true, ...o });
ok("curadoria com foto liberada (Agência Brasil) → foto", fi({ origem: "curadoria", fotoStatus: "autorizada" }) === "fonte");
ok("curadoria sem foto liberada → só texto", fi({ origem: "curadoria", fotoStatus: "proibida", tipoImagem: "tematica" }) === "nenhuma" && f({ origem: "curadoria" }).foto === "nenhuma");
ok("portal esportes com foto liberada → foto", fi({ categoriaSlug: "esportes", fotoStatus: "autorizada" }) === "fonte");
ok("portal esportes sem foto liberada → só texto", fi({ categoriaSlug: "esportes", fotoStatus: "proibida", tipoImagem: "tematica" }) === "nenhuma");
ok("portal com foto institucional → foto", fi({ fotoStatus: "autorizada" }) === "fonte");
ok("portal tema geral → ilustração IA", fi({ tipoImagem: "tematica" }) === "ilustracao_ia");
ok("portal fala da cidade → foto da cidade", fi({ tipoImagem: "cidade" }) === "foto_cidade");
ok("portal fato específico sem foto → nenhuma", fi({}) === "nenhuma");
ok("prefeitura com foto → foto dela", fi({ origem: "prefeitura", fotoStatus: "autorizada" }) === "fonte");
ok("curadoria fora da dobra", !podeIrParaDobra("curadoria", true));
ok("prompt de ilustração proíbe pessoas e crianças", /sem pessoas/.test(promptIlustracao("x")) && /sem crian/.test(promptIlustracao("x")));
const pag = (title: string, w: number, h: number, lic: string, cats: string) => ({ title, imageinfo: [{ width: w, height: h, thumburl: `https://x/${title}`, extmetadata: { LicenseShortName: { value: lic }, Categories: { value: cats }, Artist: { value: "<a>Fulano</a>" } } }] });
const fc = escolherFotoCommons([
  pag("File:Flag of Palmeira, Paraná.jpg", 2000, 1000, "Public domain", "Flags"),
  pag("File:Vista de Cascavel (Paraná).jpg", 5760, 3336, "CC BY-SA 2.0", "Cascavel (Paraná)"),
  pag("File:Inauguração salão.jpg", 3000, 2000, "Public domain", "Cascavel (Paraná)"),
  pag("File:Vista aérea.jpg", 4000, 2000, "All rights reserved", "Cascavel (Paraná)"),
]);
ok("Commons: escolhe a vista com licença livre", fc?.titulo === "Vista de Cascavel (Paraná).jpg" && fc.credito === "Foto: Fulano / Wikimedia Commons (CC BY-SA 2.0)", JSON.stringify(fc));

// Analista de imagem (nacional/internacional)
ok("plano inválido → sensível, sem imagem", normalizarPlano(null).tema_sensivel === true);
ok("plano: no máximo 2 buscas", normalizarPlano({ tema_sensivel: false, buscas: ["Palácio do Planalto", "Congresso Nacional", "STF"], motivo: "x" }).buscas.length === 2);
ok("plano sem tema_sensivel explícito → sensível", normalizarPlano({ buscas: ["Kremlin"] }).tema_sensivel === true);
const av = normalizarAvaliacoes({ avaliacoes: [{ indice: 1, risco: "baixo" }, { indice: 0, risco: "medio" }, { indice: 9, risco: "baixo" }] }, 3);
ok("avaliação: índice fora do intervalo é ignorado; ausente = alto", av.length === 3 && av[2].risco === "alto" && av[1].risco === "baixo");
ok("escolhe só risco baixo", escolherFotoBaixoRisco(av) === 1 && escolherFotoBaixoRisco([{ indice: 0, risco: "medio", motivos: [] }]) === null);
const cands = filtrarCandidatasCommons([
  pag("File:Palácio do Planalto.jpg", 3000, 2000, "CC BY 3.0 br", "Palácio do Planalto"),
  pag("File:Brasão do Brasil.jpg", 2000, 1500, "Public domain", "Coats of arms of Brazil"),
  pag("File:Congresso.jpg", 4000, 2600, "All rights reserved", "Congresso Nacional"),
  pag("File:Esplanada.png", 4000, 2600, "CC0", "Brasília"),
]);
ok("Commons por tema: só JPEG livre e sem brasão", cands.length === 1 && cands[0].titulo === "Palácio do Planalto.jpg", JSON.stringify(cands.map((c) => c.titulo)));
// Veto 5W1H
const completo = { quem: "Prefeitura de Toledo", o_que: "entrega placas", quando: "quinta-feira (22)", onde: "Toledo", por_que: "fomentar o turismo rural", como: "em cerimônia na Secretaria" };
ok("5W1H completo → escreve", faltando5w1h(completo).length === 0);
ok("5W1H tudo nulo → veta", faltando5w1h({ quem: null, o_que: null, quando: null, onde: null, por_que: null, como: null }).length === 6);
ok("5W1H sem por quê → veta", faltando5w1h({ ...completo, por_que: null }).join() === "por_que");
ok("'Não informado' conta como vazio", faltando5w1h({ ...completo, quando: "Não informado." }).join() === "quando");
ok("'Sem informações' conta como vazio", faltando5w1h({ ...completo, onde: "Sem informações oficiais" }).join() === "onde");
ok("'não há registro' conta como vazio", faltando5w1h({ ...completo, quem: "Não há registro de envolvidos" }).join() === "quem");
ok("resposta que começa com 'Não' mas é fato → passa", faltando5w1h({ ...completo, o_que: "Nova lei proíbe fogos com estampido" }).length === 0);
ok("policial sem por quê/quando/quem → passa", faltando5w1h({ ...completo, por_que: null, quando: null, quem: "Não identificado" }, { policial: true }).length === 0);
ok("policial sem onde → veta", faltando5w1h({ ...completo, onde: null }, { policial: true }).join() === "onde");
ok("policial tudo nulo → veta", faltando5w1h({ quem: null, o_que: null, quando: null, onde: null, por_que: null, como: null }, { policial: true }).length === 2);
ok("motivo legível", motivoVeto5w1h(["quando", "por_que"]) === "5W1H incompleto: sem quando, por quê");
// Política nacional
ok("crédito Agência Brasil liberado", classificarFoto("https://x/a.jpg", "Foto: Bruno Peres/Agência Brasil") === "autorizada");
ok("crédito Agência Senado liberado", classificarFoto("https://x/a.jpg", "Roque de Sá/Agência Senado") === "autorizada");
ok("crédito Câmara dos Deputados liberado", classificarFoto("https://x/a.jpg", "Foto: Mario Agra/Câmara dos Deputados") === "autorizada");
ok("fonte Agência Brasil é agência pública", ehAgenciaPublica("Agência Brasil — Política") && !ehAgenciaPublica("G1"));
const rp = (t: string) => avaliarRegras(t, undefined, { categoria: "politica" }).nivel;
ok("política: votação no Congresso não segura", rp("Câmara aprova em votação projeto do partido X sobre saneamento") === "baixo");
ok("política: segundo turno segura", rp("TSE divulga regras para o segundo turno") === "alto");
ok("política: candidato a governador segura", rp("Candidato a governador apresenta proposta") === "alto");
ok("fora da política: partido continua segurando", avaliarRegras("Vereador troca de partido").nivel === "alto");
// Abrangência nacional (portal sem cidade apurada)
ok("El Niño no Sul do Brasil → nacional", ehAbrangenciaNacional("Paraná (especialmente região Oeste) e Sul do Brasil"));
ok("todo o país → nacional", ehAbrangenciaNacional("Em todo o país"));
ok("Oeste do Paraná → não é nacional", !ehAbrangenciaNacional("Região Oeste do Paraná"));
ok("Cascavel → não é nacional", !ehAbrangenciaNacional("Cascavel, PR"));
// Imagem válida para capa
ok("emoji do WordPress não é foto", !imagemValida("https://s.w.org/images/core/emoji/17.0.2/72x72/1f534.png"));
ok("miniatura ?w=200 não serve", !imagemValida("https://admin.cnnbrasil.com.br/x/foto.jpg?w=200"));
ok("og:image grande serve", imagemValida("https://admin.cnnbrasil.com.br/x/foto.jpg?w=1200&h=630&crop=1"));
ok("foto comum serve", imagemValida("https://s2-g1.glbimg.com/abc/afp-20261024.jpg"));
ok("logo não serve", !imagemValida("https://site.com/wp-content/themes/x/logo.png"));
// Logomarca / nome da prefeitura / imagem padrão do site → só texto (28/10)
for (const u of [
  "https://www.toledo.pr.gov.br/sites/default/files/prefeitura_municipal_de_toledo_h_preto.png",
  "https://www.palmeira.pr.gov.br/wp-content/uploads/Pref-PalmeiraHorizontal-2022-menor.png",
  "https://odiariodemaringa.com.br/wp-content/uploads/cropped-ODIARIO-DE-MARINGA-544png-1.png",
  "https://www.camara.leg.br/tema/assets/images/imagens-compartilhamento/imagem-padrao.jpg",
  "https://www.folhadelondrina.com.br/themes/default/assets/img/default.jpg",
  "https://cdn.cgn.inf.br/fotos-cgn/2019/10/16161540/CGN768x461.gif",
  "https://x.pr.gov.br/img/brasao-municipio.png",
  "https://x.pr.gov.br/img/Logomarca_Prefeitura.jpg",
  "data:image/svg+xml;base64,PHN2Zz4=",
]) ok(`logomarca/padrão não serve: ${u.slice(-40)}`, !imagemValida(u));
for (const u of [
  "https://www.toledo.pr.gov.br/sites/default/files/styles/noticia/public/2026-10/jogos-idosos-ginasio.jpg",
  "https://cascavel.pr.gov.br/arquivos/28102026_obra_avenida.jpg",
  "https://www5.foz.pr.gov.br/wp-content/uploads/2026/10/Festival-Cervejeiro-em-Brasao-Dourado-1024x683.png",
  "https://www.aen.pr.gov.br/sites/default/arquivos_restritos/files/imagem/2026-10/foto_estrada.jpeg",
]) ok(`foto de notícia serve: ${u.slice(-30)}`, imagemValida(u));
// Fila pela última tentativa
const fila = ordenarPorTentativa([
  { id: "travada", ultimo_scrape_em: null, ultimo_ciclo: { em: "2026-10-24T15:57:00Z" } },
  { id: "ontem", ultimo_scrape_em: "2026-10-23T21:00:00Z", ultimo_ciclo: { em: "2026-10-23T21:00:00Z" } },
  { id: "nunca", ultimo_scrape_em: null, ultimo_ciclo: null },
]).map((f) => f.id).join(",");
ok("fila: nunca tentada › tentada ontem › travada que acabou de tentar", fila === "nunca,ontem,travada", fila);
// Banco de fotos genéricas (segurança/esportes sem foto)
const gid = (ed: string, t: string) => escolherFotoGenerica(ed, t, "abc")?.id ?? "nenhuma";
ok("acidente na PR-456 → rodovia", gid("seguranca", "Colisão na PR-456 deixa dois feridos").startsWith("rodovia"));
ok("BR (federal) → sem foto", gid("seguranca", "Colisão na BR-277 deixa dois feridos") === "nenhuma");
ok("crime sexual → sem foto", gid("seguranca", "Homem é preso por estupro de vulnerável") === "nenhuma");
ok("queda em casa → sem foto", gid("seguranca", "Idosa sofre corte após queda de sofá") === "nenhuma");
ok("arma de fogo não é bombeiros", gid("seguranca", "Homem é preso após disparos de arma de fogo").startsWith("pm-"));
ok("colisão urbana → Samu", gid("seguranca", "Motoboy fica ferido após colisão no Centro").startsWith("samu"));
ok("rodoviária não é rodovia", gid("seguranca", "Homem passa mal em ônibus na rodoviária") === "nenhuma");
ok("coxa (corpo) não é Coritiba", gid("esportes", "Corinthians treina e Memphis sente a coxa") === "nenhuma");
ok("Siate → bombeiros", gid("seguranca", "Mulher cai de escada e é atendida pelo Siate").startsWith("cbm-"));
ok("incêndio → bombeiros", gid("seguranca", "Incêndio destrói casa em Toledo").startsWith("cbm-"));
ok("afogamento → resgate aquático", gid("seguranca", "Jovem morre afogado no Rio Iguaçu").startsWith("cbm-"));
ok("delegado → polícia civil", gid("seguranca", "Delegado prende suspeito de golpe").startsWith("pcpr-"));
ok("presídio → polícia penal", gid("seguranca", "Detentos fogem de presídio").startsWith("ppen-"));
ok("assalto → viatura da PM", gid("seguranca", "Homem é preso após assalto a mercado").startsWith("pm-"));
ok("ampolas apreendidas → PM em patrulha (nunca o Palácio)", /^pm-[1-4]$/.test(gid("seguranca", "Mulher é presa com 319 ampolas de medicamentos emagrecedores")));
ok("temporal (outra editoria) → clima", gid("cotidiano", "Temporal com granizo atinge o Oeste").startsWith("clima-temporal"));
ok("geada → clima", gid("cotidiano", "Cidades amanhecem com geada").startsWith("clima-geada"));
ok("deslizamento → interdição", gid("cotidiano", "Deslizamento interdita estrada em Guaratuba").startsWith("clima-interdicao"));
ok("chuva → clima-chuva", gid("cotidiano", "Semana começa com chuva em todo o Paraná").startsWith("clima-chuva"));
ok("Coritiba → Couto Pereira", gid("esportes", "Coritiba vence o Londrina") === "couto-pereira-1");
ok("outro clube → sem foto", gid("esportes", "Operário empata em Ponta Grossa") === "nenhuma");
ok("outra editoria → sem foto", gid("saude", "Hospital abre leitos") === "nenhuma");
ok("URL do banco é genérica", ehFotoGenerica("https://vozesparanaenses.com.br/fotos-genericas/civil-1.jpg"));
// Cota diária de fora do PR
ok("Brasileirão sem clube do PR conta como esportes", faixaForaDoPr("nacional", "esportes", "Flamengo vence o Palmeiras") === "esportes");
ok("Athletico fora da cota", faixaForaDoPr("nacional", "esportes", "Athletico-PR empata com o Grêmio") === null);
ok("Coritiba fora da cota", faixaForaDoPr("internacional", "esportes", "Coritiba anuncia reforço") === null);
ok("política nacional na faixa nacional", faixaForaDoPr("nacional", "politica", "Senado aprova") === "nacional");
ok("internacional na faixa internacional", faixaForaDoPr("internacional", "internacional", "Guerra") === "internacional");
ok("região do PR não conta", faixaForaDoPr("oeste", "esportes", "Flamengo") === null);
ok("cota nacional: 5º passa", cabeNaCotaForaDoPr("nacional", 4, "media"));
ok("cota nacional: 6º não passa", !cabeNaCotaForaDoPr("nacional", 5, "media"));
ok("prioridade alta tem folga de 2", cabeNaCotaForaDoPr("nacional", 6, "alta") && !cabeNaCotaForaDoPr("nacional", 7, "alta"));

// Prefeitura: hoje ou ontem
{
  const ag = new Date("2026-10-29T15:00:00Z"); // 12h de 29/10 em Brasília
  ok("hoje vale", hojeOuOntem("2026-10-29T10:00:00Z", ag));
  ok("ontem às 20h vale", hojeOuOntem("2026-10-28T23:00:00Z", ag));
  ok("ontem só com data vale", hojeOuOntem("2026-10-28T03:00:00Z", ag));
  ok("anteontem não vale", !hojeOuOntem("2026-10-27T15:00:00Z", ag));
  ok("futuro não vale", !hojeOuOntem("2026-10-30T15:00:00Z", ag));
}
// Recorte da marca (foto de prefeitura)
{
  const canto = calcularRecorte([{ x: 0.03, y: 0.03, w: 0.25, h: 0.1 }], 1200, 800);
  ok("logo no canto de cima → corta o topo", !!canto && canto.y > 0.13 && canto.w === 1);
  const rodape = calcularRecorte([{ x: 0.6, y: 0.88, w: 0.37, h: 0.09 }], 1200, 800);
  ok("marca no rodapé → corta embaixo", !!rodape && rodape.y === 0 && rodape.h < 0.88);
  ok("marca no meio → não dá para recortar", calcularRecorte([{ x: 0.3, y: 0.35, w: 0.4, h: 0.3 }], 1200, 800) === null);
  ok("sem marca → foto inteira", JSON.stringify(calcularRecorte([], 1200, 800)) === JSON.stringify({ x: 0, y: 0, w: 1, h: 1 }));
}
// "Rondon" dentro de "Marechal Cândido Rondon" não é a cidade de Rondon
{
  const cs = [
    { slug: "rondon", nome: "Rondon", regiao_id: "noroeste" },
    { slug: "marechal-candido-rondon", nome: "Marechal Cândido Rondon", regiao_id: "oeste" },
  ] as unknown as Parameters<typeof detectarCidade>[2];
  ok("Marechal Cândido Rondon no título", detectarCidade("Marechal Cândido Rondon abre vagas", "", cs)?.slug === "marechal-candido-rondon");
  ok("MCR no corpo não vira Rondon", detectarCidade("Feira de empregos", "A feira em Marechal Cândido Rondon reúne empresas. Marechal Cândido Rondon espera 2 mil pessoas.", cs)?.slug === "marechal-candido-rondon");
  ok("'Rondon' solto (imprensa do Oeste) não vira a cidade de Rondon", detectarCidade("Rondon recebe festival", "O festival acontece no parque.", cs)?.slug !== "rondon");
  ok("prefeitura de Rondon vale", detectarCidade("Obra na escola", "A Prefeitura de Rondon entregou a obra. Rondon investiu R$ 1 milhão.", cs)?.slug === "rondon");
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo");
if (falhas) Deno.exit(1);
