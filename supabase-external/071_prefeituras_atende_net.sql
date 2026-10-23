-- =====================================================================
-- Vozes Paranaenses — 071_prefeituras_atende_net.sql
--
-- Prefeituras que publicam notícias no portal Atende.Net da IPM
-- ({cidade}.atende.net/cidadao/noticia). A página monta a lista com
-- JavaScript, mas os dados vêm no HTML estático em base64; o
-- scrape-prefeitura agora tem um leitor próprio para isso
-- (supabase/functions/_shared/atende-net.ts) — fetch comum, sem Firecrawl
-- e sem custo.
--
-- Levantamento de 23/10/2026: das 399 cidades, 51 têm portal Atende.Net;
-- 26 publicam notícia de verdade nele (as demais estão vazias, paradas
-- desde 2023-2025 ou publicam em outro site). Esta migration:
--   - corrige as fontes que já existiam com endereço errado (Cascavel,
--     Paranavaí) ou que não liam nada (Matinhos);
--   - cadastra as outras 23.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

with alvo(slug, host) as (
  values
    -- publicam toda semana (última notícia em out/2026)
    ('arapongas', 'arapongas'),
    ('araucaria', 'araucaria'),
    ('campo-largo', 'campolargo'),
    ('campo-mourao', 'campomourao'),
    ('cascavel', 'cascavel'),
    ('castro', 'castro'),
    ('corbelia', 'corbelia'),
    ('guaraniacu', 'guaraniacu'),
    ('lapa', 'lapa'),
    ('mambore', 'mambore'),
    ('maripa', 'maripa'),
    ('matinhos', 'matinhos'),
    ('ouro-verde-do-oeste', 'ouroverdedooeste'),
    ('paranavai', 'paranavai'),
    ('pato-bragado', 'patobragado'),
    ('pinhais', 'pinhais'),
    ('rio-branco-do-sul', 'riobrancodosul'),
    ('rio-negro', 'rionegro'),
    ('santa-helena', 'santahelena'),
    ('santo-antonio-da-platina', 'santoantoniodaplatina'),
    -- publicam com menos frequência (última notícia em ago-set/2026)
    ('eneas-marques', 'eneasmarques'),
    ('janiopolis', 'janiopolis'),
    ('juranda', 'juranda'),
    ('paraiso-do-norte', 'paraisodonorte'),
    ('santa-izabel-do-oeste', 'santaizabeldooeste'),
    ('santa-mariana', 'santamariana')
),
-- 1. Corrige a fonte de prefeitura que a cidade já tinha (a mais antiga).
existentes as (
  select distinct on (f.cidade_slug) f.id, a.host
  from public.fontes f
  join alvo a on a.slug = f.cidade_slug
  where f.tipo = 'prefeitura'
  order by f.cidade_slug, f.created_at
),
corrigidas as (
  update public.fontes f
  set url_base = 'https://' || e.host || '.atende.net/cidadao/noticia',
      tipo_renderizacao = 'estatico',
      protecao_antibot = false,
      frequencia_horas = null,
      ativo = true,
      updated_at = now()
  from existentes e
  where f.id = e.id
  returning f.cidade_slug
)
-- 2. Cadastra as cidades que ainda não tinham fonte de prefeitura.
insert into public.fontes (regiao_id, nome, url_base, tipo_renderizacao, protecao_antibot, frequencia_horas, ativo, tipo, cidade_slug, abrangencia)
select
  c.regiao_id,
  'Prefeitura de ' || c.nome,
  'https://' || a.host || '.atende.net/cidadao/noticia',
  'estatico',
  false,
  null,
  true,
  'prefeitura',
  a.slug,
  'municipal'
from alvo a
join public.cidades c on c.slug = a.slug
where not exists (
  select 1 from public.fontes f where f.cidade_slug = a.slug and f.tipo = 'prefeitura'
);

-- Conferência: devem aparecer 26 fontes ativas no Atende.Net.
select f.nome, f.url_base, f.ativo
from public.fontes f
where f.tipo = 'prefeitura' and f.url_base like '%.atende.net/%'
order by f.nome;
