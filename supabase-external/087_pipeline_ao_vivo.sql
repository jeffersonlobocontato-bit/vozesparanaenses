-- =====================================================================
-- 087 — Pipeline ao vivo (/admin/pipeline)
--
--   pipeline_eventos(desde, ate) → linha do tempo do pipeline num intervalo:
--     cada notícia coletada, fato agrupado/descartado, apuração 5W1H,
--     matéria redigida, avaliação de criticidade, escolha de imagem,
--     publicação e post do Instagram, com o horário de cada um.
--     Serve ao modo "ao vivo" (últimos minutos) e ao "replay do último ciclo".
--   pipeline_painel() → números do dia, fila do Instagram, leitores e
--     alertas (fonte parada, chamada de função que falhou, job do cron
--     com falha, fila de revisão).
--
-- Só admin/editor. Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create or replace function public.pipeline_eventos(p_desde timestamptz, p_ate timestamptz default now())
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
  if p_ate - p_desde > interval '6 hours' then
    p_desde := p_ate - interval '6 hours';
  end if;

  with ev as (
    -- 1 coleta
    select r.coletado_em as t, 'coleta' as etapa, r.id::text as id,
           jsonb_build_object('titulo', left(r.titulo, 140), 'fonte', f.nome, 'tipo', f.tipo::text) as d
    from raw_articles r left join fontes f on f.id = r.fonte_id
    where r.coletado_em >= p_desde and r.coletado_em < p_ate
    union all
    -- 2 deduplicação e crivo
    select c.criado_em, 'crivo', c.id::text,
           jsonb_build_object('ok', c.status::text <> 'descartado', 'motivo', c.descarte_motivo,
                              'tema', c.tema_crivo, 'cidade', c.cidade_slug)
    from article_clusters c
    where c.criado_em >= p_desde and c.criado_em < p_ate
    union all
    -- 3 apuração 5W1H
    select x.criado_em, 'apuracao', x.id::text,
           jsonb_build_object('titulo', left(coalesce(x.o_que, ''), 140),
             'quem', nullif(trim(coalesce(x.quem::text, '')), '') is not null,
             'oque', nullif(trim(coalesce(x.o_que::text, '')), '') is not null,
             'quando', nullif(trim(coalesce(x.quando::text, '')), '') is not null,
             'onde', nullif(trim(coalesce(x.onde::text, '')), '') is not null,
             'como', x.dados is not null,
             'porque', nullif(trim(coalesce(x.por_que::text, '')), '') is not null)
    from extracted_facts x
    where x.criado_em >= p_desde and x.criado_em < p_ate
    union all
    -- 4 redação
    select g.gerado_em, 'redacao', g.id::text,
           jsonb_build_object('titulo', g.titulo, 'editoria', ec.nome, 'cidade', g.cidade_principal,
                              'agente', (select a.nome from agentes_redatores a where a.categoria_id = g.categoria_id and a.ativo limit 1))
    from generated_articles g left join editorial_categories ec on ec.id = g.categoria_id
    where g.gerado_em >= p_desde and g.gerado_em < p_ate
    union all
    -- 5 criticidade
    select g.criticidade_avaliada_em, 'criticidade', g.id::text,
           jsonb_build_object('titulo', g.titulo, 'nivel', g.criticidade_nivel, 'score', g.criticidade_score,
                              'motivo', (select m from jsonb_array_elements_text(
                                          case when jsonb_typeof(to_jsonb(g.criticidade_motivos)) = 'array'
                                               then to_jsonb(g.criticidade_motivos) else '[]'::jsonb end) m limit 1),
                              'auto', coalesce(g.publicado_automaticamente, false), 'status', g.status::text)
    from generated_articles g
    where g.criticidade_avaliada_em >= p_desde and g.criticidade_avaliada_em < p_ate
    union all
    -- 6 imagem (decidida junto da redação)
    select g.gerado_em + interval '20 seconds', 'imagem', g.id::text,
           jsonb_build_object('titulo', g.titulo, 'origem', g.foto_origem, 'credito', g.imagem_credito,
                              'tem', g.imagem_capa_url is not null)
    from generated_articles g
    where g.gerado_em >= p_desde and g.gerado_em < p_ate
    union all
    -- 7 publicação
    select g.publicado_em, 'publicacao', g.id::text,
           jsonb_build_object('titulo', g.titulo, 'cidade', g.cidade_principal, 'regiao', rg.slug,
                              'auto', coalesce(g.publicado_automaticamente, false))
    from generated_articles g left join regioes rg on rg.id = g.regiao_id
    where g.status::text = 'publicado' and g.publicado_em >= p_desde and g.publicado_em < p_ate
    union all
    -- 8 redes: card criado e post publicado
    select p.criado_em, 'redes', p.id::text || ':fila',
           jsonb_build_object('acao', 'fila', 'tipo', p.tipo, 'classe', p.classe, 'fundo', p.card->>'fundo',
                              'formato', p.card->>'formato', 'agendado_para', p.agendado_para)
    from instagram_posts p
    where p.criado_em >= p_desde and p.criado_em < p_ate
    union all
    select p.publicado_em, 'redes', p.id::text || ':pub',
           jsonb_build_object('acao', 'publicado', 'tipo', p.tipo, 'classe', p.classe, 'fundo', p.card->>'fundo',
                              'formato', p.card->>'formato')
    from instagram_posts p
    where p.status = 'publicado' and p.publicado_em >= p_desde and p.publicado_em < p_ate
  )
  select coalesce(jsonb_agg(jsonb_build_object('t', t, 'etapa', etapa, 'id', id, 'd', d) order by t), '[]'::jsonb)
  into v
  from (select * from ev where t is not null order by t desc limit 1500) z;

  return v;
end;
$$;

revoke all on function public.pipeline_eventos(timestamptz, timestamptz) from public, anon;
grant execute on function public.pipeline_eventos(timestamptz, timestamptz) to authenticated;

create or replace function public.pipeline_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, cron, net
as $$
declare
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v jsonb;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;

  select jsonb_build_object(
    'hoje', jsonb_build_object(
      'coletadas', (select count(*) from raw_articles where coletado_em >= v_inicio),
      'fatos', (select count(*) from article_clusters where criado_em >= v_inicio),
      'descartados', (select count(*) from article_clusters where criado_em >= v_inicio and status::text = 'descartado'),
      'apuradas', (select count(*) from extracted_facts where criado_em >= v_inicio),
      'redigidas', (select count(*) from generated_articles where gerado_em >= v_inicio),
      'publicadas', (select count(*) from generated_articles where status::text = 'publicado' and publicado_em >= v_inicio),
      'automaticas', (select count(*) from generated_articles where status::text = 'publicado' and publicado_em >= v_inicio and publicado_automaticamente),
      'posts', (select count(*) from instagram_posts where status = 'publicado' and publicado_em >= v_inicio)
    ),
    'revisao', (select count(*) from generated_articles where status::text = 'rascunho' and gerado_em >= now() - interval '2 days'),
    'fontes_ativas', (select count(*) from fontes where ativo),
    'instagram', jsonb_build_object(
      'ativo', (select ativo from instagram_config where id = 1),
      'proximo', (select min(agendado_para) from instagram_posts where status = 'agendado' and agendado_para >= now() - interval '6 hours'),
      'na_fila', (select count(*) from instagram_posts where status = 'agendado'),
      'grade', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'classe', classe, 'fundo', card->>'fundo', 'formato', card->>'formato') order by publicado_em desc), '[]'::jsonb)
                from (select * from instagram_posts where status = 'publicado' order by publicado_em desc limit 8) p)
    ),
    'leitores', jsonb_build_object(
      'agora', (select count(*) from analytics_events where ts >= now() - interval '5 minutes'),
      'cidades_hoje', (select count(distinct cidade_leitor) from analytics_events where ts >= v_inicio and cidade_leitor is not null),
      'top', (select coalesce(jsonb_agg(c), '[]'::jsonb) from (
                select cidade_leitor c from analytics_events
                where ts >= now() - interval '60 minutes' and cidade_leitor is not null
                group by 1 order by count(*) desc limit 3) t)
    ),
    'alertas', jsonb_build_object(
      'http_falhas_1h', (select count(*) from net._http_response where created >= now() - interval '1 hour' and (status_code is null or status_code >= 400)),
      'http_ultima_falha', (select left(coalesce(error_msg, content::text, ''), 160) from net._http_response
                            where created >= now() - interval '1 hour' and (status_code is null or status_code >= 400)
                            order by created desc limit 1),
      'cron_falhas_24h', (select coalesce(jsonb_agg(jsonb_build_object('job', jobname, 'n', n)), '[]'::jsonb) from (
                            select j.jobname, count(*) n from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                            where d.start_time >= now() - interval '24 hours' and d.status = 'failed'
                            group by 1 order by 2 desc limit 3) x),
      'fontes_paradas', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'ultimo', ultimo_scrape_em)), '[]'::jsonb) from (
                            select nome, ultimo_scrape_em from fontes
                            where ativo and (ultimo_scrape_em is null or ultimo_scrape_em < now() - interval '30 hours')
                            order by ultimo_scrape_em nulls first limit 3) x),
      'fontes_paradas_total', (select count(*) from fontes where ativo and (ultimo_scrape_em is null or ultimo_scrape_em < now() - interval '30 hours'))
    )
  ) into v;
  return v;
end;
$$;

revoke all on function public.pipeline_painel() from public, anon;
grant execute on function public.pipeline_painel() to authenticated;
