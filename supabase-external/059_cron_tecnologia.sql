-- =====================================================================
-- 059 — Tecnologia: publicação periódica automática
--   * coluna serie_semanal_jefferson em generated_articles (marca a
--     edição semanal em que Jefferson Lobo comenta os fatos da semana)
--   * cron chamando o endpoint /api/public/publicar-tecnologia-periodico
--     do próprio site; a rotina respeita o ritmo de 2 em 2 dias.
-- =====================================================================

alter table public.generated_articles
  add column if not exists serie_semanal_jefferson boolean not null default false;

comment on column public.generated_articles.serie_semanal_jefferson is
  'Marca a edição semanal especial da editoria Tecnologia, em que Jefferson Lobo comenta os fatos da semana em IA.';

create index if not exists idx_generated_articles_serie_semanal
  on public.generated_articles (categoria_id, gerado_em desc)
  where serie_semanal_jefferson;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('vozes-tecnologia-periodico');
exception when others then null;
end $$;

-- A cada 4 horas: a rotina só publica se já passaram 2 dias.
select cron.schedule(
  'vozes-tecnologia-periodico',
  '20 */4 * * *',
  $$
  select net.http_post(
    url := 'https://vozesparanaenses.com.br/api/public/publicar-tecnologia-periodico',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );
  $$
);
