-- =====================================================================
-- Vozes Paranaenses — 072_dobra_home_20_maiores.sql
--
-- Regra da PRIMEIRA DOBRA da home (out/2026):
--   - matéria de PORTAL/veículo ........................ pode entrar
--   - matéria de PREFEITURA das 20 maiores cidades ..... pode entrar
--   - matéria de PREFEITURA das demais cidades ......... NÃO entra na
--     dobra; aparece nas páginas de região, cidade, editoria e nas
--     colunas regionais
--   - matéria fixada pelo editor ....................... sempre pode
--
-- (Release de prefeitura COM foto vira matéria; SEM foto vira nota na
-- coluna regional "Vozes {Região}" — ver _shared/crivo-editorial.ts.)
--
-- 1. cidades.destaque_home: as 20 mais populosas do PR (IBGE, Censo 2022).
--    Editável: para trocar uma cidade, basta mudar o campo — sem deploy.
-- 2. generated_articles.destaque_home: preenchido pelo generate-article;
--    aqui, preenche o que já foi publicado.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

alter table public.cidades
  add column if not exists destaque_home boolean not null default false;

update public.cidades set destaque_home = (slug in (
  'curitiba',              -- 1.773.733
  'londrina',              --   555.937
  'maringa',               --   409.657
  'ponta-grossa',          --   358.367
  'cascavel',              --   348.051
  'sao-jose-dos-pinhais',  --   329.222
  'foz-do-iguacu',         --   285.415
  'colombo',               --   232.056
  'guarapuava',            --   182.093
  'araucaria',             --   151.666
  'toledo',                --   150.470
  'fazenda-rio-grande',    --   148.873
  'paranagua',             --   145.829
  'campo-largo',           --   136.327
  'apucarana',             --   130.134
  'pinhais',               --   127.019
  'almirante-tamandare',   --   119.825
  'arapongas',             --   119.138
  'piraquara',             --   118.730
  'sarandi'                --   118.455  (21ª: Umuarama, 117.095)
));

-- Default true: matéria escrita pelo editor (manual, "Escrever agora",
-- imprensa) continua podendo ir para a dobra. O pipeline grava false
-- para prefeitura de cidade fora da lista.
alter table public.generated_articles
  add column if not exists destaque_home boolean not null default true;

-- Matérias já publicadas: prefeitura (cluster oficial) de cidade fora da
-- lista sai da dobra. Cidade pela prefeitura que publicou; na falta dela,
-- pela cidade_principal da matéria.
update public.generated_articles g
set destaque_home = false
from public.article_clusters c
where c.id = g.cluster_id
  and c.fonte_oficial = true
  and g.fixado_posicao is null
  and not exists (
    select 1
    from public.cluster_articles ca
    join public.raw_articles ra on ra.id = ca.raw_article_id
    join public.fontes f on f.id = ra.fonte_id
    join public.cidades cf on cf.slug = f.cidade_slug
    where ca.cluster_id = g.cluster_id and cf.destaque_home
  )
  and not exists (
    select 1 from public.cidades cg
    where lower(cg.nome) = lower(g.cidade_principal) and cg.destaque_home
      and not exists (
        select 1 from public.cluster_articles ca2
        join public.raw_articles ra2 on ra2.id = ca2.raw_article_id
        join public.fontes f2 on f2.id = ra2.fonte_id
        where ca2.cluster_id = g.cluster_id and f2.cidade_slug is not null
      )
  );

create index if not exists generated_articles_dobra_idx
  on public.generated_articles (publicado_em desc)
  where status = 'publicado' and destaque_home;

-- Conferência
select
  (select count(*) from public.cidades where destaque_home) as cidades_destaque,
  (select count(*) from public.generated_articles where status = 'publicado' and not destaque_home) as materias_fora_da_dobra,
  (select count(*) from public.generated_articles where status = 'publicado' and destaque_home) as materias_na_dobra;
