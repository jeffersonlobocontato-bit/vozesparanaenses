-- =====================================================================
-- Vozes Paranaenses — 068_cron_ciclos_11h_18h.sql
-- Substitui 003_pipeline_cron.sql. Varredura das 399 cidades em DOIS
-- ciclos por dia: 11h e 18h (Brasília = UTC-3, sem horário de verão).
--
-- Cada ciclo fica aberto 2h. Dentro da janela, o cron chama as funções
-- várias vezes; cada chamada processa um LOTE (ver _shared/coleta.ts):
--
--   BRT 11h–13h / 18h–20h  (UTC 14–15 / 21–22)
--     scrape-prefeitura ........ a cada 3 min (lote de assessorias)
--     scrape-source (veículos) . NÃO agendado na fase 1 — portais rodam
--                                manualmente pelo painel ("Rodar portais").
--                                Para ligar: descomentar a linha abaixo.
--   BRT 11h–14h / 18h–21h  (UTC 14–16 / 21–23)
--     cluster-articles ......... a cada 5 min (agrupa e deduplica)
--     classify-and-quota ....... a cada 5 min (editoria + crivo + repetição)
--     process-pending-clusters . a cada 4 min (fatos → matéria/nota →
--                                criticidade → publica ou fila de revisão)
--   Tecnologia (curadoria, inalterado): scrape/cluster a cada 6h,
--   edição periódica pelo site.
--
-- ⚠️ O pipeline ficou PARADO de 18/09 a 22/10/2026 porque o 003 foi
--    rodado sem trocar {PROJECT_URL}/{ANON_KEY}. Este script se recusa a
--    rodar com os marcadores no lugar.
--
-- PREENCHA v_url e v_key abaixo (projeto Supabase do Lovable — o mesmo
-- de SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY no .env do repositório).
-- =====================================================================

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

-- Valida os marcadores ANTES de apagar os jobs antigos.
select pg_temp.agendar('vozes-validacao', '0 0 31 2 *', 'scrape-source', '{}'::jsonb);
select cron.unschedule('vozes-validacao');

-- Limpa os jobs antigos do pipeline (idempotente).
do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname like 'vozes-%' loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

-- Ciclos das cidades ----------------------------------------------------
select pg_temp.agendar('vozes-scrape-prefeitura', '*/3 14-15,21-22 * * *', 'scrape-prefeitura', '{}'::jsonb);
-- Fase 1 (out/2026): só prefeituras no automático. Portais no botão manual.
-- select pg_temp.agendar('vozes-scrape-source',  '1-59/3 14-15,21-22 * * *', 'scrape-source', '{}'::jsonb);
select pg_temp.agendar('vozes-cluster-articles',  '2-59/5 14-16,21-23 * * *', 'cluster-articles', '{}'::jsonb);
select pg_temp.agendar('vozes-classify-and-quota','4-59/5 14-16,21-23 * * *', 'classify-and-quota', '{"limit": 40}'::jsonb);
select pg_temp.agendar('vozes-process-pending',   '*/4 14-16,21-23 * * *', 'process-pending-clusters', '{"limit": 8}'::jsonb);

-- Tecnologia (curadoria) — mesmos horários de antes ---------------------
select pg_temp.agendar('vozes-tecnologia-scrape',  '0 */6 * * *',  'scrape-source',    '{"curadoria_editorias": ["tecnologia"]}'::jsonb);
select pg_temp.agendar('vozes-tecnologia-cluster', '20 */6 * * *', 'cluster-articles', '{"curadoria_editorias": ["tecnologia"]}'::jsonb);
-- A edição periódica de tecnologia é rota do SITE (059), não edge function.
select cron.schedule(
  'vozes-tecnologia-periodico',
  '20 */4 * * *',
  $$select net.http_post(url := 'https://vozesparanaenses.com.br/api/public/publicar-tecnologia-periodico', headers := jsonb_build_object('Content-Type','application/json'), body := '{}'::jsonb);$$
);

-- Conferência: deve listar 7 jobs (8 com os portais), todos com url_ok = true.
select jobname, schedule, position('{PROJECT_URL}' in command) = 0 as url_ok from cron.job where jobname like 'vozes-%' order by jobname;
