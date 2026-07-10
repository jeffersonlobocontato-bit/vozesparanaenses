-- =====================================================================
-- Vozes Paranaenses — 010_drop_legacy_scaffold.sql
-- LIMPEZA: 001_init.sql criou um schema de conteúdo em inglês (regions,
-- categories, sources, raw_items, facts, articles, article_versions,
-- article_sources, leads, classifieds, page_views) que foi substituído
-- pelo schema em português de 002_vozes.sql (regioes, editorial_categories,
-- fontes, raw_articles, extracted_facts, generated_articles,
-- whatsapp_leads, classificados, analytics_events) — confirmado que
-- NENHUMA dessas 11 tabelas é referenciada em nenhum .from() do código
-- atual (front-end ou edge functions).
--
-- IMPORTANTE: este script NÃO remove `public.profiles`, `public.user_roles`,
-- a função `public.has_role()`, `public.set_updated_at()` nem o tipo
-- `user_role` — essas peças continuam ativas e são usadas pelas policies
-- de RLS em 005_images.sql, 007_ads.sql e 008_authority.sql.
--
-- Roda no Supabase EXTERNO. Idempotente (todos os drops usam IF EXISTS).
-- =====================================================================

drop table if exists public.page_views cascade;
drop table if exists public.classifieds cascade;
drop table if exists public.leads cascade;
drop table if exists public.article_sources cascade;
drop table if exists public.article_versions cascade;
drop table if exists public.articles cascade;
drop table if exists public.facts cascade;
drop table if exists public.raw_items cascade;
drop table if exists public.sources cascade;
drop table if exists public.categories cascade;
drop table if exists public.regions cascade;

-- Os enums article_status / source_kind / lead_channel já haviam sido
-- removidos (com cascade) pela própria 002_vozes.sql — nada a fazer aqui.
-- user_role é mantido: ainda é o tipo da coluna public.user_roles.role.
