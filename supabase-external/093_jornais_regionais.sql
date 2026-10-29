-- 093 — Jornais e portais regionais que faltavam (56 veículos).
--
-- Pesquisa de 29/10/2026 (Guia de Mídia, Atlas da Imprensa, buscas por
-- região) + teste do leitor no GitHub Actions (scripts/diag-prefeituras,
-- fontes4.json): só entra o que devolveu lista com data e notícia recente.
-- Servem para duas coisas: mais pauta regional (passam pelo crivo de portal:
-- release de assessoria, fato fora do PR e crítica política são descartados)
-- e medir de verdade quais cidades têm cobertura regional (citações por
-- cidade detectada em raw_articles).
-- Região e cidade-base vêm da tabela cidades; abrangência regional (a região
-- da notícia sai da cidade citada). Idempotente pela URL.

insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, cidade_slug, regiao_id, abrangencia)
select v.nome, v.url, 'veiculo', 'estatico', false, true, c.slug, c.regiao_id, 'regional'
from (values
  ('Diário dos Campos — Ponta Grossa', 'https://dcmais.com.br/', 'ponta-grossa'),
  ('GDia — Foz do Iguaçu', 'https://gdia.com.br/', 'foz-do-iguacu'),
  ('Jornal Hoje — Cascavel', 'https://jhoje.com.br/', 'cascavel'),
  ('aRede — Ponta Grossa', 'https://arede.info/', 'ponta-grossa'),
  ('O Paraná — Cascavel', 'https://oparana.com.br/', 'cascavel'),
  ('H2FOZ — Foz do Iguaçu', 'https://www.h2foz.com.br/', 'foz-do-iguacu'),
  ('P1 News — Castro', 'https://p1news.com.br/', 'castro'),
  ('Jornal do Oeste — Toledo', 'https://www.jornaldooeste.com.br/', 'toledo'),
  ('Hoje Centro Sul — Irati', 'https://www.hojecentrosul.com.br/', 'irati'),
  ('Aqui Agora — Oeste', 'https://www.aquiagora.net/', 'assis-chateaubriand'),
  ('Toledo News', 'https://www.toledonews.com.br/', 'toledo'),
  ('Portal Guaíra', 'https://portalguaira.com/', 'guaira'),
  ('Gazeta de Toledo', 'https://gazetadetoledo.com.br/', 'toledo'),
  ('Folha de Palotina', 'https://www.folhadepalotina.com.br/', 'palotina'),
  ('Jornal Mensageiro — Medianeira', 'https://www.jornalmensageiro.com/', 'medianeira'),
  ('Costa Oeste News — São Miguel do Iguaçu', 'https://www.costaoestenews.com/', 'sao-miguel-do-iguacu'),
  ('RR Mais — Guaraniaçu', 'https://www.rrmais.com.br/', 'guaraniacu'),
  ('RBJ — Sudoeste', 'https://www.rbj.com.br/', 'francisco-beltrao'),
  ('Correio do Cidadão — Guarapuava', 'https://www.correiodocidadao.com.br/', 'guarapuava'),
  ('Jornal de Beltrão', 'https://jornaldebeltrao.com.br/', 'francisco-beltrao'),
  ('Rede Sul de Notícias — Guarapuava', 'https://www.redesuldenoticias.com.br/', 'guarapuava'),
  ('VVale — União da Vitória', 'https://www.vvale.com.br/', 'uniao-da-vitoria'),
  ('Jornal Fatos — Pinhão', 'https://jornalfatos.com.br/', 'pinhao'),
  ('Paraná Centro — Ivaiporã', 'https://jornal.paranacentro.com.br/', 'ivaipora'),
  ('Cantu em Foco — Laranjeiras do Sul', 'https://www.cantuemfoco.com.br/', 'laranjeiras-do-sul'),
  ('Correio do Lago — Santa Helena', 'https://www.correiodolago.com.br/noticia-lista/', 'santa-helena'),
  ('Ivaiporã Online', 'https://ivaipora.online/', 'ivaipora'),
  ('Correio do Povo — Laranjeiras do Sul', 'https://www.jcorreiodopovo.com.br/', 'laranjeiras-do-sul'),
  ('Portal Cambé', 'https://www.portalcambe.com.br/', 'cambe'),
  ('Correio de Notícias — Mandaguari', 'https://correiodenoticias.net/', 'mandaguari'),
  ('Diário Reservense — Reserva do Iguaçu', 'https://diarioreservense.com.br/', 'reserva-do-iguacu'),
  ('Jandaia Online', 'https://www.jandaiaonline.com.br/', 'jandaia-do-sul'),
  ('Folha Extra — Norte Pioneiro', 'https://folhaextra.com/', 'santo-antonio-da-platina'),
  ('Maringá Mais', 'https://www.maringamais.com.br/', 'maringa'),
  ('NP Diário — Norte Pioneiro', 'https://npdiario.com.br/', 'santo-antonio-da-platina'),
  ('AN Notícias — Apucarana', 'https://www.annoticias.com.br/', 'apucarana'),
  ('Folha do Norte PR — Bandeirantes', 'https://folhadonortepr.com.br/', 'bandeirantes'),
  ('Tribuna do Vale — Sto. Antônio da Platina', 'https://www.tribunadovale.com.br/', 'santo-antonio-da-platina'),
  ('Tribuna de Cianorte', 'https://www.tribunadecianorte.com.br/', 'cianorte'),
  ('Jornal de Ibaiti', 'https://www.jornaldeibaiti.com.br/', 'ibaiti'),
  ('Jornal Noroeste — Paranavaí', 'https://jornalnoroeste.com/', 'paranavai'),
  ('Gazeta Regional — Goioerê', 'https://www.gazetaregional.com/', 'goioere'),
  ('Repórter do Vale — Borrazópolis', 'https://jornalreporterdovale.com/', 'borrazopolis'),
  ('Paraná Notícias — Campo Mourão', 'https://parananoticias.com.br/', 'campo-mourao'),
  ('Ubiratã Online', 'https://ubirataonline.com.br/', 'ubirata'),
  ('Banda B — Curitiba e RMC', 'https://www.bandab.com.br/', 'curitiba'),
  ('Tribuna do Paraná', 'https://www.tribunapr.com.br/', 'curitiba'),
  ('Massa News', 'https://massanews.com/', 'curitiba'),
  ('Plural — Curitiba', 'https://www.plural.jor.br/', 'curitiba'),
  ('Jornal de Colombo', 'https://www.jornaldecolombo.com.br/', 'colombo'),
  ('Diário de Piraquara', 'https://diariodepiraquara.com.br/', 'piraquara'),
  ('Tudo Pinhais', 'https://www.tudopinhais.com.br/', 'pinhais'),
  ('Correio do Litoral — Guaratuba', 'https://correiodolitoral.com/', 'guaratuba'),
  ('Click Riomafra — Rio Negro', 'https://www.clickriomafra.com.br/', 'rio-negro'),
  ('Agora Litoral — Paranaguá', 'https://agoralitoral.com.br/', 'paranagua'),
  ('Portal NP Online', 'https://portalnponline.com/noticia', 'jacarezinho')
) as v(nome, url, cidade)
join public.cidades c on c.slug = v.cidade
where not exists (select 1 from public.fontes f where f.url_base = v.url);
