-- =====================================================================
-- Vozes Paranaenses — 074_estatisticas_fontes.sql
--
-- Números por fonte para o painel admin (Fontes monitoradas):
--   fontes_estatisticas()        → uma linha por fonte (coluna "Notícias")
--   fonte_ficha(p_fonte_id uuid) → ficha da fonte: big numbers, série de
--                                  30 dias, descartes e últimas notícias
--
-- "Notícia gerada da fonte" = matéria ou nota cujo cluster tem pelo menos
-- um item coletado dessa fonte (uma matéria com 3 portais conta para os 3).
--
-- As duas funções são security definer e só respondem para admin/editor.
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

-- Portais seguem os ciclos 11h/18h: o formulário do admin gravava 6h em
-- toda fonte salva, o que tira a fonte do ciclo fixo (21 portais estavam
-- assim). Frequência própria fica só para fontes de curadoria.
update public.fontes
set frequencia_horas = null
where tipo = 'veiculo' and curadoria_editoria is null and frequencia_horas is not null;

-- Usada na ficha (criada também pela 073; aqui para não depender da ordem).
alter table public.article_clusters add column if not exists descarte_motivo text;

create index if not exists raw_articles_fonte_coletado_idx on public.raw_articles (fonte_id, coletado_em desc);
create index if not exists cluster_articles_raw_idx on public.cluster_articles (raw_article_id);

create or replace function public.fontes_estatisticas()
returns table (
  fonte_id uuid,
  coletadas bigint,
  materias_publicadas bigint,
  materias_total bigint,
  notas_publicadas bigint,
  ultima_publicacao_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;
  return query
  with clusters_da_fonte as (
    select distinct ra.fonte_id, ca.cluster_id
    from public.raw_articles ra
    join public.cluster_articles ca on ca.raw_article_id = ra.id
  ),
  materias as (
    select c.fonte_id,
           count(distinct ga.id) filter (where ga.status = 'publicado') as publicadas,
           count(distinct ga.id) as total,
           max(ga.publicado_em) filter (where ga.status = 'publicado') as ultima
    from clusters_da_fonte c
    join public.generated_articles ga on ga.cluster_id = c.cluster_id
    group by c.fonte_id
  ),
  notas as (
    select c.fonte_id,
           count(distinct n.id) filter (where n.status = 'publicado') as publicadas,
           max(n.publicado_em) filter (where n.status = 'publicado') as ultima
    from clusters_da_fonte c
    join public.coluna_cidade_notas n on n.cluster_id = c.cluster_id
    group by c.fonte_id
  ),
  coletas as (
    select ra.fonte_id, count(*) as total from public.raw_articles ra group by ra.fonte_id
  )
  select f.id,
         coalesce(co.total, 0),
         coalesce(m.publicadas, 0),
         coalesce(m.total, 0),
         coalesce(n.publicadas, 0),
         greatest(m.ultima, n.ultima)
  from public.fontes f
  left join coletas co on co.fonte_id = f.id
  left join materias m on m.fonte_id = f.id
  left join notas n on n.fonte_id = f.id;
end $$;

create or replace function public.fonte_ficha(p_fonte_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;

  with raws as (
    select ra.id, ra.titulo, ra.url, ra.coletado_em, ra.data_publicacao_original, ra.foto_status
    from public.raw_articles ra
    where ra.fonte_id = p_fonte_id
  ),
  clusters as (
    select distinct ca.cluster_id
    from public.cluster_articles ca
    join raws r on r.id = ca.raw_article_id
  ),
  materias as (
    select ga.id, ga.titulo, ga.slug, ga.status::text as status, ga.publicado_em, ga.gerado_em,
           ga.imagem_capa_url is not null as tem_foto, rg.slug as regiao_slug
    from public.generated_articles ga
    join clusters c on c.cluster_id = ga.cluster_id
    left join public.regioes rg on rg.id = ga.regiao_id
  ),
  notas as (
    select n.id, n.titulo, n.status, n.publicado_em, n.criado_em, n.cidade_slug, rg.slug as regiao_slug
    from public.coluna_cidade_notas n
    join clusters c on c.cluster_id = n.cluster_id
    left join public.regioes rg on rg.id = n.regiao_id
  ),
  descartadas as (
    select ac.id as cluster_id
    from public.article_clusters ac
    join clusters c on c.cluster_id = ac.id
    where ac.status::text = 'descartado'
      and not exists (select 1 from public.generated_articles ga where ga.cluster_id = ac.id)
      and not exists (select 1 from public.coluna_cidade_notas n where n.cluster_id = ac.id)
  ),
  dias as (
    select ((now() at time zone 'America/Sao_Paulo')::date - g)::date as dia
    from generate_series(0, 29) g
  )
  select jsonb_build_object(
    'fonte', (
      select jsonb_build_object(
        'id', f.id, 'nome', f.nome, 'url_base', f.url_base, 'tipo', f.tipo::text, 'ativo', f.ativo,
        'regiao', rg.nome, 'cidade_slug', f.cidade_slug, 'ultimo_scrape_em', f.ultimo_scrape_em,
        'ultimo_ciclo', f.ultimo_ciclo
      )
      from public.fontes f left join public.regioes rg on rg.id = f.regiao_id
      where f.id = p_fonte_id
    ),
    'numeros', jsonb_build_object(
      'coletadas', (select count(*) from raws),
      'coletadas_30d', (select count(*) from raws where coletado_em > now() - interval '30 days'),
      'pautas', (select count(*) from clusters),
      -- Descartada de verdade = não virou matéria nem nota (clusters que
      -- viraram matéria também podem ter ficado com status 'descartado').
      'pautas_descartadas', (select count(*) from descartadas),
      'materias_publicadas', (select count(*) from materias where status = 'publicado'),
      'materias_rascunho', (select count(*) from materias where status = 'rascunho'),
      'materias_rejeitadas', (select count(*) from materias where status in ('rejeitado', 'expirado')),
      'materias_com_foto', (select count(*) from materias where status = 'publicado' and tem_foto),
      'notas_publicadas', (select count(*) from notas where status = 'publicado'),
      'notas_revisao', (select count(*) from notas where status = 'revisao'),
      'ultima_publicacao_em', (select max(x) from (
        select max(publicado_em) as x from materias where status = 'publicado'
        union all select max(publicado_em) from notas where status = 'publicado') u)
    ),
    'serie_30d', (
      select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'coletadas', (select count(*) from raws r where (r.coletado_em at time zone 'America/Sao_Paulo')::date = d.dia),
        'publicadas', (select count(*) from materias m where m.status = 'publicado' and (m.publicado_em at time zone 'America/Sao_Paulo')::date = d.dia)
                    + (select count(*) from notas n where n.status = 'publicado' and (n.publicado_em at time zone 'America/Sao_Paulo')::date = d.dia)
      ) order by d.dia)
      from dias d
    ),
    'descartes', (
      select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'total', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(ac.descarte_motivo, 'sem motivo registrado') as motivo, count(*) as total
        from public.article_clusters ac join descartadas d on d.cluster_id = ac.id
        group by 1
      ) t
    ),
    'ultimas_materias', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.quando desc), '[]'::jsonb)
      from (
        select id, titulo, slug, status, regiao_slug, tem_foto, coalesce(publicado_em, gerado_em) as quando
        from materias order by coalesce(publicado_em, gerado_em) desc nulls last limit 15
      ) t
    ),
    'ultimas_notas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.quando desc), '[]'::jsonb)
      from (
        select id, titulo, status, cidade_slug, regiao_slug, coalesce(publicado_em, criado_em) as quando
        from notas order by coalesce(publicado_em, criado_em) desc nulls last limit 10
      ) t
    ),
    'ultimas_coletas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.coletado_em desc), '[]'::jsonb)
      from (
        select titulo, url, coletado_em, data_publicacao_original, foto_status
        from raws order by coletado_em desc limit 15
      ) t
    )
  ) into v;
  return v;
end $$;

revoke all on function public.fontes_estatisticas() from public, anon;
revoke all on function public.fonte_ficha(uuid) from public, anon;
grant execute on function public.fontes_estatisticas() to authenticated;
grant execute on function public.fonte_ficha(uuid) to authenticated;
