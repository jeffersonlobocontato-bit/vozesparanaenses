-- =====================================================================
-- Vozes Paranaenses — 076_horarios_alternados_por_frente.sql
--
-- Horários alternados por frente (Brasília), para a home girar o dia todo
-- em vez de encher só às 11h e às 18h. Substitui a grade do 068/073.
--
--   07h  curadoria nacional/internacional
--   10h  portais do PR
--   12h  prefeituras
--   14h  tecnologia + nacional/internacional
--   16h  portais do PR
--   18h  prefeituras
--   21h  portais do PR + esportes
--   07h–23h  processamento (agrupar, crivo, escrever) a cada 4–5 min
--
-- Cada janela de coleta fica aberta 2h; o cron chama em lotes e cada fonte
-- é coletada uma vez por janela (portais/prefeituras pelo ciclo em
-- _shared/coleta.ts; curadoria por tempo decorrido, 5h).
--
-- Também corrige: até aqui a curadoria geral (nacional/internacional) e a
-- de esportes não entravam em nenhum cron — o scrape-source chamado sem
-- filtro só pega portais. Agora cada editoria tem o seu job.
--
-- Tecnologia: Google DeepMind passa a ser lido pelo RSS (sem custo de
-- renderização). A publicação de tecnologia vira 1 por dia (rota do site,
-- ritmo de 20h), chamada às 14h45 e 15h45.
--
-- PREENCHA v_url e v_key (mesmos valores do 068/073/075). Recusa rodar com
-- os marcadores no lugar.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Fonte de tecnologia com RSS público.
update public.fontes
set url_base = 'https://deepmind.google/blog/rss.xml', tipo_renderizacao = 'estatico'
where curadoria_editoria = 'tecnologia' and url_base ilike '%deepmind.google%';

create or replace function pg_temp.agendar(nome text, quando text, funcao text, corpo jsonb)
returns void language plpgsql as $fn$
declare
  v_url text := '{PROJECT_URL}';     -- ex.: https://xxxx.supabase.co
  v_key text := '{ANON_KEY}';        -- chave publishable/anon do projeto Lovable
begin
  if v_url like '%{%' or v_key like '%{%' then
    raise exception 'Preencha v_url e v_key em pg_temp.agendar antes de rodar (marcadores ainda no lugar).';
  end if;
  if exists (select 1 from cron.job where jobname = nome) then
    perform cron.unschedule(nome);
  end if;
  perform cron.schedule(
    nome,
    quando,
    format(
      $cmd$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization', %L), body := %L::jsonb, timeout_milliseconds := 10000);$cmd$,
      rtrim(v_url, '/') || '/functions/v1/' || funcao,
      'Bearer ' || v_key,
      corpo::text
    )
  );
end $fn$;

-- Horários em UTC (Brasília + 3h). Janela de 2h por ciclo.

-- Coleta -----------------------------------------------------------------
-- Portais 10h, 16h, 21h → 13-14, 19-20, 00-01 UTC
select pg_temp.agendar('vozes-scrape-source', '1-59/3 0-1,13-14,19-20 * * *', 'scrape-source', '{}'::jsonb);
-- Prefeituras 12h, 18h → 15-16, 21-22 UTC
select pg_temp.agendar('vozes-scrape-prefeitura', '*/3 15-16,21-22 * * *', 'scrape-prefeitura', '{}'::jsonb);
-- Nacional/internacional 7h e 14h → 10-11, 17-18 UTC
select pg_temp.agendar('vozes-curadoria-geral', '3-59/10 10-11,17-18 * * *', 'scrape-source', '{"curadoria_editorias": ["geral"]}'::jsonb);
-- Tecnologia 14h → 17-18 UTC
select pg_temp.agendar('vozes-tecnologia-scrape', '6-59/10 17-18 * * *', 'scrape-source', '{"curadoria_editorias": ["tecnologia"]}'::jsonb);
-- Esportes 21h → 00-01 UTC
select pg_temp.agendar('vozes-curadoria-esportes', '8-59/10 0-1 * * *', 'scrape-source', '{"curadoria_editorias": ["esportes"]}'::jsonb);

-- Processamento 7h–23h → 10-23 e 00-02 UTC ------------------------------
select pg_temp.agendar('vozes-cluster-articles',   '2-59/5 0-2,10-23 * * *', 'cluster-articles', '{}'::jsonb);
select pg_temp.agendar('vozes-classify-and-quota', '4-59/5 0-2,10-23 * * *', 'classify-and-quota', '{"limit": 40}'::jsonb);
select pg_temp.agendar('vozes-process-pending',    '*/4 0-2,10-23 * * *', 'process-pending-clusters', '{"limit": 8}'::jsonb);

-- Tecnologia: agrupa depois da coleta e publica 1 por dia ------------------
select pg_temp.agendar('vozes-tecnologia-cluster', '25,55 17-18 * * *', 'cluster-articles', '{"curadoria_editorias": ["tecnologia"]}'::jsonb);
-- A publicação de tecnologia é rota do SITE, não edge function.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'vozes-tecnologia-periodico') then
    perform cron.unschedule('vozes-tecnologia-periodico');
  end if;
end $$;
select cron.schedule(
  'vozes-tecnologia-periodico',
  '45 17,18 * * *',
  $$select net.http_post(url := 'https://vozesparanaenses.com.br/api/public/publicar-tecnologia-periodico', headers := jsonb_build_object('Content-Type','application/json'), body := '{}'::jsonb, timeout_milliseconds := 120000);$$
);

-- Conferência: 12 jobs vozes-* (com a analista de imagem da 075), todos com url_ok = true.
select jobname, schedule, position('{PROJECT_URL}' in command) = 0 as url_ok
from cron.job where jobname like 'vozes-%' order by jobname;
