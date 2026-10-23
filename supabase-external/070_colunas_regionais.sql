-- =====================================================================
-- Vozes Paranaenses — 070_colunas_regionais.sql
--
-- As notas deixam de ter uma coluna por cidade ("Vozes {Cidade}") e
-- passam a ter UMA COLUNA POR REGIÃO ("Vozes Oeste", "Vozes Campos
-- Gerais"...), que concentra as notas de todas as cidades da região.
-- Cada nota continua marcada com a sua cidade (cidade_slug), para o
-- filtro por cidade e para a página da cidade.
--
-- Regra de destino (out/2026):
--   release de PREFEITURA ....... sempre NOTA na coluna regional
--   notícia de PORTAL/veículo ... sempre MATÉRIA; sem foto liberada vai
--                                 para o VAPT-VUPT (matéria sem capa)
--
-- Esta migration:
--   1. liga a coluna à região (colunas.regiao_id) e cria as 10 colunas
--      regionais do PR;
--   2. cria garantir_coluna_regiao(), usada pelo generate-article;
--   3. converte em nota as matérias de PREFEITURA que estavam publicadas
--      sem foto (as que apareciam no VAPT-VUPT). A matéria original sai
--      do ar (status 'expirado') e o endereço antigo redireciona para a
--      nota na coluna (ver artigo_origem_slug).
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

-- 1. Coluna ligada à região ------------------------------------------------
alter table public.colunas
  add column if not exists regiao_id uuid references public.regioes(id);

create unique index if not exists colunas_regiao_unica
  on public.colunas (regiao_id)
  where tipo = 'regiao';

-- Origem da nota quando ela veio de uma matéria convertida (redireciona
-- o endereço antigo da matéria para a nota).
alter table public.coluna_cidade_notas
  add column if not exists artigo_origem_id uuid,
  add column if not exists artigo_origem_slug text;

create index if not exists coluna_cidade_notas_origem_slug_idx
  on public.coluna_cidade_notas (artigo_origem_slug)
  where artigo_origem_slug is not null;

create index if not exists coluna_cidade_notas_coluna_pub_idx
  on public.coluna_cidade_notas (coluna_id, publicado_em desc)
  where status = 'publicado';

-- 2. Função usada pelo pipeline ------------------------------------------
create or replace function public.garantir_coluna_regiao(p_regiao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
  v_nome text;
begin
  select id into v_id from public.colunas where regiao_id = p_regiao_id and tipo = 'regiao';
  if v_id is not null then return v_id; end if;

  select slug, nome into v_slug, v_nome from public.regioes where id = p_regiao_id;
  if v_slug is null then
    raise exception 'regiao_inexistente: %', p_regiao_id;
  end if;
  -- Mesmo rótulo público do site (src/lib/region-labels.ts).
  v_nome := case v_slug
    when 'norte-central' then 'Norte'
    when 'centro-ocidental' then 'Centro Oeste'
    else v_nome
  end;

  insert into public.colunas (slug, nome, descricao, tipo, regiao_id, ativo)
  values (
    'vozes-' || v_slug,
    'Vozes ' || v_nome,
    'As notas das cidades da região ' || v_nome || ', em ordem de publicação.',
    'regiao',
    p_regiao_id,
    true
  )
  on conflict (slug) do update
    set regiao_id = excluded.regiao_id, tipo = 'regiao', ativo = true
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.garantir_coluna_regiao(uuid) from public, anon, authenticated;
grant execute on function public.garantir_coluna_regiao(uuid) to service_role;

-- As 10 colunas regionais já nascem criadas (a home e as rotas
-- /vozes/{regiao} não dependem da primeira nota).
select public.garantir_coluna_regiao(id)
from public.regioes
where slug not in ('nacional', 'internacional');

-- 3. Matérias de prefeitura sem foto → notas na coluna regional ----------
-- Cidade: a da prefeitura que publicou (fontes.cidade_slug). Região: a
-- dessa cidade. Corpo da nota: o resumo da matéria.
with origem as (
  select distinct on (g.id)
    g.id            as artigo_id,
    g.slug          as artigo_slug,
    g.cluster_id,
    g.titulo,
    coalesce(nullif(trim(g.resumo), ''), nullif(trim(g.subtitulo), ''), left(g.corpo, 600)) as corpo,
    g.publicado_em,
    g.gerado_em,
    coalesce(cf.slug, cg.slug)            as cidade_slug,
    coalesce(cf.regiao_id, cg.regiao_id, g.regiao_id) as regiao_id,
    f.nome          as fonte_nome,
    ra.url          as fonte_url
  from public.generated_articles g
  join public.article_clusters c on c.id = g.cluster_id
  join public.cluster_articles ca on ca.cluster_id = g.cluster_id
  join public.raw_articles ra on ra.id = ca.raw_article_id
  join public.fontes f on f.id = ra.fonte_id and f.tipo = 'prefeitura'
  left join public.cidades cf on cf.slug = f.cidade_slug
  left join public.cidades cg on lower(cg.nome) = lower(g.cidade_principal)
  where g.status = 'publicado'
    and g.imagem_capa_url is null
    and coalesce(c.fonte_oficial, true)
  order by g.id, ra.coletado_em
),
inseridas as (
  insert into public.coluna_cidade_notas (
    coluna_id, cidade_slug, regiao_id, cluster_id, titulo, corpo,
    fonte_nome, fonte_url, status, publicado_em, criado_em,
    artigo_origem_id, artigo_origem_slug
  )
  select
    public.garantir_coluna_regiao(o.regiao_id),
    o.cidade_slug, o.regiao_id, o.cluster_id, o.titulo, o.corpo,
    o.fonte_nome, o.fonte_url, 'publicado', o.publicado_em, coalesce(o.gerado_em, o.publicado_em),
    o.artigo_id, o.artigo_slug
  from origem o
  join public.regioes r on r.id = o.regiao_id and r.slug not in ('nacional', 'internacional')
  where o.corpo is not null
    and not exists (select 1 from public.coluna_cidade_notas n where n.cluster_id = o.cluster_id)
  returning artigo_origem_id
)
update public.generated_articles g
set status = 'expirado'
from inseridas i
where g.id = i.artigo_origem_id;

-- Conferência: notas por coluna regional e matérias convertidas.
select c.nome as coluna, count(n.id) as notas, count(n.artigo_origem_id) as convertidas
from public.colunas c
left join public.coluna_cidade_notas n on n.coluna_id = c.id and n.status = 'publicado'
where c.tipo = 'regiao'
group by c.nome
order by c.nome;
