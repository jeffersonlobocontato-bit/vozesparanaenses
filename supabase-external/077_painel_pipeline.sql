-- =====================================================================
-- Vozes Paranaenses — 077_painel_pipeline.sql
--
-- Dá ao painel admin a grade REAL do ciclo de conteúdo (lida do pg_cron)
-- e o resumo do dia, em vez de horários escritos à mão na tela — que
-- ficavam desatualizados a cada mudança de cron (068 → 073 → 076).
--
--   pipeline_agenda()      → um registro por job do cron: horário, função
--                            chamada, corpo, última execução e falhas 24h.
--                            NÃO devolve o comando (ele carrega a chave).
--   pipeline_resumo_hoje() → números do dia (Brasília) por frente.
--
-- Só admin/editor. Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create or replace function public.pipeline_agenda()
returns table (
  jobname text,
  schedule text,
  active boolean,
  alvo text,
  corpo text,
  ultima_execucao timestamptz,
  ultimo_status text,
  ultima_mensagem text,
  execucoes_24h integer,
  falhas_24h integer
)
language plpgsql
stable
security definer
set search_path = public, cron
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;

  return query
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    -- Edge function ("scrape-prefeitura") ou rota do site ("/api/...").
    coalesce(
      substring(j.command from '/functions/v1/([A-Za-z0-9_-]+)'),
      substring(j.command from 'url := ''https?://[^/'']+(/[^'']*)''')
    ),
    substring(j.command from 'body := ''([^'']*)''::jsonb'),
    ult.start_time,
    ult.status::text,
    left(ult.return_message, 200),
    coalesce(st.n, 0)::integer,
    coalesce(st.falhas, 0)::integer
  from cron.job j
  left join lateral (
    select d.start_time, d.status, d.return_message
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by d.start_time desc
    limit 1
  ) ult on true
  left join lateral (
    select count(*) as n, count(*) filter (where d.status <> 'succeeded') as falhas
    from cron.job_run_details d
    where d.jobid = j.jobid and d.start_time > now() - interval '24 hours'
  ) st on true
  order by j.jobname;
end $$;

revoke all on function public.pipeline_agenda() from public, anon;
grant execute on function public.pipeline_agenda() to authenticated;

create or replace function public.pipeline_resumo_hoje()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v jsonb;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;

  select jsonb_build_object(
    'coletado', (
      select coalesce(jsonb_object_agg(frente, n), '{}'::jsonb) from (
        select case
                 when f.tipo = 'prefeitura' then 'prefeituras'
                 when f.curadoria_editoria = 'tecnologia' then 'tecnologia'
                 when f.curadoria_editoria = 'esportes' then 'esportes'
                 when f.curadoria_editoria is not null then 'nacional'
                 else 'portais'
               end as frente,
               count(*) as n
        from public.raw_articles r
        join public.fontes f on f.id = r.fonte_id
        where r.coletado_em >= v_inicio
        group by 1
      ) x
    ),
    'materias_publicadas', (
      select count(*) from public.generated_articles
      where status = 'publicado' and publicado_em >= v_inicio
    ),
    'materias_revisao', (
      select count(*) from public.generated_articles where status = 'rascunho'
    ),
    'notas_publicadas', (
      select count(*) from public.coluna_cidade_notas
      where status = 'publicado' and publicado_em >= v_inicio
    ),
    'notas_revisao', (
      select count(*) from public.coluna_cidade_notas where status = 'revisao'
    ),
    'pautas_aguardando', (
      select count(*) from public.article_clusters
      where status::text in ('novo', 'selecionado_cota', 'fatos_extraidos')
        and criado_em > now() - interval '24 hours'
    ),
    'fontes_ativas', (
      select coalesce(jsonb_object_agg(frente, n), '{}'::jsonb) from (
        select case
                 when tipo = 'prefeitura' then 'prefeituras'
                 when curadoria_editoria = 'tecnologia' then 'tecnologia'
                 when curadoria_editoria = 'esportes' then 'esportes'
                 when curadoria_editoria is not null then 'nacional'
                 else 'portais'
               end as frente,
               count(*) as n
        from public.fontes where ativo
        group by 1
      ) y
    ),
    'ultima_materia', (select max(gerado_em) from public.generated_articles)
  ) into v;
  return v;
end $$;

revoke all on function public.pipeline_resumo_hoje() from public, anon;
grant execute on function public.pipeline_resumo_hoje() to authenticated;
