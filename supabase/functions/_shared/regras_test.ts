// Testes das regras da automação das 399 cidades (região pela cidade, foto,
// data do dia, ciclos, criticidade, crivo). Rodar a partir da raiz do repo:
//   npx deno run --allow-read supabase/functions/_shared/regras_test.ts
// Sai com código 1 se algum caso falhar.

import { detectarCidade, cidadePorNome } from "./cidades.ts";
import { classificarFoto } from "./foto-credito.ts";
import { ehDoDia, extrairDataPublicacao, inicioDoCiclo, diaSaoPaulo } from "./data-publicacao.ts";
import { avaliarRegras } from "./criticidade.ts";
import { decidirFormato, temaHeuristico, parseCrivo } from "./crivo-editorial.ts";
import { cicloAtual, fonteElegivel, normalizarUrl } from "./coleta.ts";

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
ok("inicio ciclo 11h", inicioDoCiclo(11, agora).toISOString() === "2026-10-22T14:00:00.000Z");

// Ciclos
ok("14h30 → ciclo fechado", cicloAtual(agora) === null);
ok("11h20 → ciclo 11", cicloAtual(new Date("2026-10-22T11:20:00-03:00")) === 11);
ok("19h50 → ciclo 18", cicloAtual(new Date("2026-10-22T19:50:00-03:00")) === 18);
ok("20h → fechado", cicloAtual(new Date("2026-10-22T20:00:00-03:00")) === null);
const t1120 = new Date("2026-10-22T11:20:00-03:00");
ok("fonte coletada 7h hoje → elegível no ciclo 11", fonteElegivel({ id: "1", nome: "x", regiao_id: null, frequencia_horas: null, ultimo_scrape_em: "2026-10-22T07:00:00-03:00" }, t1120));
ok("fonte coletada 11h05 → não elegível", !fonteElegivel({ id: "1", nome: "x", regiao_id: null, frequencia_horas: null, ultimo_scrape_em: "2026-10-22T11:05:00-03:00" }, t1120));
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
const f = (o: Partial<Parameters<typeof decidirFormato>[0]>) => decidirFormato({ prioridade: "media", valorNoticioso: true, fotoStatus: "proibida", forcarNota: false, temCidade: true, ...o });
ok("foto autorizada → matéria c/ foto", f({ fotoStatus: "autorizada" }).formato === "materia" && f({ fotoStatus: "autorizada" }).foto === "fonte_autorizada");
ok("alta sem foto → matéria c/ foto da cidade", f({ prioridade: "alta" }).foto === "cidade_geral");
ok("evento sem foto → nota", f({ prioridade: "baixa" }).formato === "nota");
ok("média sem foto → nota", f({}).formato === "nota");
ok("cota estourada → nota", f({ fotoStatus: "autorizada", forcarNota: true }).formato === "nota");
ok("baixa sem cidade → descarta", f({ prioridade: "baixa", temCidade: false }).formato === "descartar");
ok("sem valor → descarta", f({ valorNoticioso: false }).formato === "descartar");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo");
if (falhas) Deno.exit(1);
