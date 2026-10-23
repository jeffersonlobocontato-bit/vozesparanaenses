-- =====================================================================
-- Vozes Paranaenses — 073_portais_e_curadoria_nos_ciclos.sql
--
-- Liga TODAS as frentes nos ciclos das 11h e 18h (Brasília):
--   - portais/jornais do PR (scrape-source), que na fase 1 rodavam só
--     pelo botão manual;
--   - curadoria (esportes, nacional, internacional), que agora passa pelo
--     crivo e publica sozinha — só texto, sem foto.
--
-- Regras novas dos portais (out/2026, ver _shared/crivo-editorial.ts):
--   - fora: release de assessoria de prefeitura (já coletamos da própria
--     prefeitura), notícia nacional/internacional e crítica política sobre
--     a cidade;
--   - só notícia do dia e sem repetir entre portais (agrupamento +
--     cluster_duplicado em 72h, já existentes);
--   - imagem: foto com crédito institucional; senão ilustração por IA
--     (tema geral) ou foto real da cidade com licença livre (Wikimedia
--     Commons, conferindo cidade + Paraná); fato específico sem foto vai
--     para o VAPT-VUPT;
--   - esportes, nacional, internacional e tecnologia: só texto.
--
-- PREENCHA v_url e v_key (mesmos valores do 068: projeto Supabase do
-- Lovable — SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY do .env). O script se
-- recusa a rodar com os marcadores no lugar.
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

-- 1. Colunas usadas pelo crivo dos portais -----------------------------
alter table public.article_clusters
  add column if not exists imagem_tipo text
    check (imagem_tipo is null or imagem_tipo in ('tematica', 'cidade', 'fato')),
  add column if not exists descarte_motivo text;

comment on column public.article_clusters.imagem_tipo is
  'Crivo (portais): tematica = ilustração por IA resolve; cidade = foto geral da cidade; fato = só foto real do fato (sem ela, sai sem capa).';
comment on column public.article_clusters.descarte_motivo is
  'Por que o crivo descartou a pauta (assessoria, fora do PR, crítica política, sem valor).';

-- 2. Cron dos portais nos ciclos ------------------------------------------
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

-- Portais e curadoria (esportes/geral): mesma janela das prefeituras,
-- intercalado (minuto 1, 4, 7...) para não disputar o mesmo minuto.
select pg_temp.agendar('vozes-scrape-source', '1-59/3 14-15,21-22 * * *', 'scrape-source', '{}'::jsonb);

-- Conferência: deve listar 8 jobs vozes-*, todos com url_ok = true.
select jobname, schedule, position('{PROJECT_URL}' in command) = 0 as url_ok
from cron.job where jobname like 'vozes-%' order by jobname;
