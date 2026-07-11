-- =====================================================================
-- Vozes Paranaenses — 015_analytics_dims.sql
-- Colunas adicionais em analytics_events para segmentar o Painel de
-- Analytics pelas mesmas dimensões já usadas no targeting de anúncios
-- (regiao/cidade/editoria) — sem elas, só dava pra cruzar por região.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.analytics_events
  add column if not exists categoria text,
  add column if not exists cidade text;

create index if not exists analytics_regiao_ts_idx on public.analytics_events (regiao_id, ts desc);
