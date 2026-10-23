-- =====================================================================
-- Vozes Paranaenses — 075_analista_imagem_nacional_internacional.sql
--
-- Analista de risco de imagem para NACIONAL e INTERNACIONAL (temas gerais e
-- política). Essas editorias saem só com texto; a analista garante ao
-- menos 1 matéria de cada com imagem de risco baixo — foto de licença
-- livre do lugar/instituição (Wikimedia Commons, avaliada pela IA olhando a
-- foto) ou ilustração por IA — para elas também entrarem na primeira dobra
-- da home. Ver supabase/functions/_shared/analista-imagem.ts.
--
--   1. generated_articles.imagem_analise: o que a analista decidiu e por quê
--   2. cron: analista-imagem-curadoria de meia em meia hora, 8h–22h
--
-- PREENCHA v_url e v_key (mesmos valores do 068/073). Recusa rodar com os
-- marcadores no lugar.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

alter table public.generated_articles
  add column if not exists imagem_analise jsonb;

comment on column public.generated_articles.imagem_analise is
  'Analista de imagem (nacional/internacional): plano, fotos avaliadas, nota de risco e decisão (foto_commons, ilustracao_ia, sem_imagem).';

create extension if not exists pg_cron;
create extension if not exists pg_net;

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

-- 8h às 22h de Brasília = 11h às 01h UTC. Minutos 25 e 55: depois das
-- rodadas de escrita, quando já há matéria nova para analisar.
select pg_temp.agendar('vozes-analista-imagem', '25,55 0,1,11-23 * * *', 'analista-imagem-curadoria', '{}'::jsonb);

select jobname, schedule, position('{PROJECT_URL}' in command) = 0 as url_ok
from cron.job where jobname like 'vozes-%' order by jobname;
