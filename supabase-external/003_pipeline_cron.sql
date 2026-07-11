-- =====================================================================
-- Vozes Paranaenses — Cron do pipeline (rodar no SQL Editor externo)
-- Agenda as edge functions do projeto Lovable para:
--   scrape-source      → o cron dispara a cada 30 min, mas a função só
--                        processa de verdade nos 4 ciclos fixos do dia
--                        (7h, 12h, 15h, 19h — horário de Brasília; ver
--                        016_scraping_priorizado.sql). Fontes com
--                        frequencia_horas preenchido são exceção e usam
--                        o comportamento antigo (a cada N horas).
--   cluster-articles   → a cada 45 min
--   classify-and-quota → a cada hora
--   extract-facts      → chamado sob demanda pelo dashboard editorial
--                        (botão "Extrair fatos" em /admin/pauta), um
--                        cluster por vez, para permitir revisão antes de
--                        gerar a matéria
--   generate-article   → chamado sob demanda pelo dashboard editorial,
--                        só depois que o cluster estiver 'fatos_extraidos'
--
-- SUBSTITUA antes de rodar:
--   {PROJECT_URL}    → ex: project--<id>.lovable.app
--   {ANON_KEY}       → chave anon/publishable do projeto Lovable
--
-- As edge functions rodam no Supabase Lovable (projeto principal), não
-- neste Supabase externo. Elas escrevem aqui via service role key.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpa jobs antigos (idempotente)
do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname like 'vozes-%' loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

-- 1. Scrape das fontes ativas — a cada 30 minutos
select cron.schedule(
  'vozes-scrape-source',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://{PROJECT_URL}/functions/v1/scrape-source',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer {ANON_KEY}'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Cluster de artigos brutos — a cada 45 minutos
select cron.schedule(
  'vozes-cluster-articles',
  '15,45 * * * *',
  $$
  select net.http_post(
    url := 'https://{PROJECT_URL}/functions/v1/cluster-articles',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer {ANON_KEY}'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Classificação + aplicação de cotas — de hora em hora
select cron.schedule(
  'vozes-classify-and-quota',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://{PROJECT_URL}/functions/v1/classify-and-quota',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer {ANON_KEY}'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Consultas úteis:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
