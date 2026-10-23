// Testes das regras da automação das 399 cidades (região pela cidade, foto,
// data do dia, ciclos, criticidade, crivo). Rodar a partir da raiz do repo:
//   npx deno run --allow-read supabase/functions/_shared/regras_test.ts
// Sai com código 1 se algum caso falhar.

import { detectarCidade, cidadePorNome } from "./cidades.ts";
import { classificarFoto } from "./foto-credito.ts";
import { ehDoDia, extrairDataPublicacao, inicioDoCiclo, diaSaoPaulo } from "./data-publicacao.ts";
import { avaliarRegras } from "./criticidade.ts";
import { decidirFormato, decidirImagem, motivoDescartePortal, pareceReleaseDeAssessoria, podeIrParaDobra, temaHeuristico, parseCrivo } from "./crivo-editorial.ts";
import { escolherFotoCommons, promptIlustracao } from "./imagem.ts";
import { limparPrefeituraMecanico, verificarTitulo } from "./titulo.ts";
import { dataAtendeNetParaIso, ehAtendeNet, parseListaAtendeNet, parseMateriaAtendeNet } from "./atende-net.ts";
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
ok("curadoria → só texto", fi({ origem: "curadoria", fotoStatus: "autorizada" }) === "nenhuma" && f({ origem: "curadoria" }).foto === "nenhuma");
ok("portal esportes → só texto", fi({ categoriaSlug: "esportes", fotoStatus: "autorizada" }) === "nenhuma");
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
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo");
if (falhas) Deno.exit(1);
