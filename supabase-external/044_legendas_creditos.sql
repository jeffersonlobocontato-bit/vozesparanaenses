-- =====================================================================
-- Vozes Paranaenses — 044_legendas_creditos.sql
-- Legenda para foto de capa + legenda e crédito para vídeo.
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.generated_articles
  add column if not exists imagem_legenda text;

alter table public.generated_articles
  add column if not exists video_legenda text;

alter table public.generated_articles
  add column if not exists video_credito text;

comment on column public.generated_articles.imagem_legenda is
  'Legenda descritiva da foto de capa (o que a imagem mostra). Editável no admin.';
comment on column public.generated_articles.video_legenda is
  'Legenda descritiva do vídeo da matéria. Editável no admin.';
comment on column public.generated_articles.video_credito is
  'Crédito/autoria do vídeo (ex.: "Vídeo: TV Vozes"). Editável no admin.';