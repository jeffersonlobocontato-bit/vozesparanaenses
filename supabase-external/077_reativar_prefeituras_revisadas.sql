-- =====================================================================
-- Vozes Paranaenses — 077_reativar_prefeituras_revisadas.sql
--
-- Revisão das 59 prefeituras que a 069 cadastrou INATIVAS ("sem data":
-- a coleta não conseguia ler a data da matéria). Revisadas site a site em
-- 23/10/2026, com o leitor de data testado no HTML real de cada plataforma.
-- O leitor (_shared/data-publicacao.ts) passou a entender:
--   - "Compartilhe: 22 Out, 2026 Por:"          (plataforma /noticias_site)
--   - "Notícia OUT 23 23 OUT 2026"               (/portal/noticias, /noticiasView)
--   - og:article:published_time                  (/noticiasView)
--   - "Data de publicação: 17:10 sexta-feira, 23/10/2026"
--   - data colada ao título da matéria ("Título 22 de Outubro de 2026",
--     "Editoria 23 de outubro de 2026 Título") — a data de hoje no topo do
--     site, longe do título, continua sem valer.
--
-- Resultado: 29 ATIVADAS (publicaram nos últimos 15 dias e a data é lida).
-- Fazenda Rio Grande, Formosa do Oeste e Saudade do Iguaçu pareciam fora
-- do ar (falha da ferramenta de leitura), mas estão no ar e publicando.
-- Paranaguá monta a lista por JavaScript a partir de um JSON; a coleta lê
-- esse JSON direto (_shared/lista-json.ts).
-- Ficam inativas (30): 26 paradas (última notícia há mais de 15 dias —
-- Ramilândia, também no ar, parou em 01/09), 2 com data só na lista ou lista por JavaScript (Barra do
-- Jacaré, Turvo), Grandes Rios (sem data) e Prudentópolis
-- (matérias com erro de servidor). Endereços errados das
-- paradas também são corrigidos, para a próxima revisão.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

-- 1. Endereços corrigidos ------------------------------------------------
update public.fontes f set url_base = v.url
from (values
  ('chopinzinho',        'https://www.chopinzinho.pr.gov.br/noticias_site'),      -- era matéria avulsa
  ('guaira',             'https://www.guaira.pr.gov.br/noticias'),                -- era matéria avulsa
  ('pitanga',            'https://www.pitanga.pr.gov.br/noticias/'),              -- era matéria avulsa
  ('imbau',              'https://www.imbau.pr.gov.br/portal/rss'),               -- RSS oficial (data na listagem)
  ('piraquara',          'https://www.piraquara.pr.gov.br/portal/rss'),
  ('sao-mateus-do-sul',  'https://www.saomateusdosul.pr.gov.br/portal/rss'),
  ('mandirituba',        'https://mandirituba.pr.gov.br/noticias'),               -- era ?pagina=404
  ('jaboti',             'https://www.jaboti.pr.gov.br/portal/noticias'),
  ('engenheiro-beltrao', 'https://www.engenheirobeltrao.pr.gov.br/portal/noticias'),
  ('paranagua',          'https://www.paranagua.pr.gov.br/include/processo-listar-noticias.php'), -- lista em JSON (o HTML não traz a lista)
  ('grandes-rios',       'https://www.grandesrios.pr.gov.br/noticias'),
  ('fazenda-rio-grande', 'https://www.fazendariogrande.pr.gov.br/noticias'),     -- era página de erro
  ('formosa-do-oeste',   'https://www.formosadooeste.pr.gov.br/noticia'),
  ('saudade-do-iguacu',  'https://www.saudadedoiguacu.pr.gov.br/noticias/'),
  ('ramilandia',         'https://www.ramilandia.pr.gov.br/noticias/')
) as v(cidade_slug, url)
where f.tipo::text = 'prefeitura' and f.cidade_slug = v.cidade_slug;

-- 2. Ativação --------------------------------------------------------------
update public.fontes set ativo = true
where tipo::text = 'prefeitura' and not ativo and cidade_slug in (
  'antonina', 'ariranha-do-ivai', 'boa-esperanca-do-iguacu', 'bom-sucesso', 'cafeara',
  'campina-grande-do-sul', 'cantagalo', 'chopinzinho', 'conselheiro-mairinck',
  'guaira', 'imbau', 'jardim-alegre', 'jardim-olinda', 'lidianopolis', 'maria-helena',
  'maua-da-serra', 'missal', 'piraquara', 'pitanga', 'planalto', 'rolandia',
  'salto-do-itarare', 'santa-maria-do-oeste', 'sao-mateus-do-sul', 'uniao-da-vitoria',
  'fazenda-rio-grande', 'formosa-do-oeste', 'saudade-do-iguacu', 'paranagua'
);

-- Conferência: 188 ativas (159 + 29) e 30 inativas.
select ativo, count(*) from public.fontes where tipo::text = 'prefeitura' group by ativo;
