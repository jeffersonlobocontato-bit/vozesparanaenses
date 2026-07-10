-- =====================================================================
-- Vozes Paranaenses — 013_painel_pauta.sql
-- Suporte ao novo Painel de Pauta (curadoria por bloco de horário,
-- região/fonte e potencial de interesse de leitura).
--
-- 1. peso_engajamento por categoria: multiplicador usado no cálculo do
--    interesse_score. Valores iniciais calibrados pelo padrão observado
--    em portais regionais reais (trânsito/policial e agro concentram a
--    maior parte do engajamento local) — recalibrar com dados reais de
--    `analytics_events` assim que houver volume suficiente de tráfego.
-- 2. interesse_score no cluster: nº de fontes × peso da categoria ×
--    fator de recência, calculado em classify-and-quota.
-- 3. fatos_extraidos_em: timestamp de quando a extração aconteceu,
--    usado para agrupar o painel em blocos de horário (ex.: Manhã,
--    Tarde, Noite) — sem precisar fazer join com extracted_facts.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.editorial_categories
  add column if not exists peso_engajamento numeric not null default 1.0;

update public.editorial_categories set peso_engajamento = 1.4 where slug = 'seguranca';
update public.editorial_categories set peso_engajamento = 1.2 where slug = 'agro';
update public.editorial_categories set peso_engajamento = 1.1 where slug = 'cidades';
update public.editorial_categories set peso_engajamento = 0.9 where slug in ('educacao', 'esportes');
update public.editorial_categories set peso_engajamento = 0.8 where slug in ('cultura', 'meio-ambiente');
-- politica, economia e saude ficam no default 1.0

alter table public.article_clusters
  add column if not exists interesse_score numeric,
  add column if not exists fatos_extraidos_em timestamptz;
