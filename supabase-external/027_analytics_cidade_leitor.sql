-- =====================================================================
-- Vozes Paranaenses — 023_analytics_cidade_leitor.sql
-- Cidade aproximada do LEITOR (geolocalização por IP, resolvida no
-- servidor e o IP descartado na hora — nunca gravado). Distinta da
-- coluna `cidade` já existente, que é sobre o que a matéria fala,
-- não sobre quem está lendo.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.analytics_events
  add column if not exists cidade_leitor text,
  add column if not exists uf_leitor text;

comment on column public.analytics_events.cidade_leitor is
  'Cidade aproximada do leitor, resolvida por geolocalização de IP no servidor (track-pageview). O IP nunca é armazenado — só o resultado da consulta.';
