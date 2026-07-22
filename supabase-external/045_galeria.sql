-- Vozes Paranaenses — 045_galeria.sql
-- Suporte à galeria de fotos por matéria. A foto de capa (imagem_capa_url)
-- continua sendo o campo canônico usado por listagens, OG, sitemap, etc.
-- A galeria é um array ordenado; por convenção o item [0] espelha a capa.
-- Idempotente.

alter table public.generated_articles
  add column if not exists imagem_galeria jsonb;

comment on column public.generated_articles.imagem_galeria is
  'Galeria opcional de fotos [{url, legenda?, credito?}]. Item 0 é a capa (mesma URL de imagem_capa_url). Editor pode reordenar, adicionar e remover fotos; matéria pode ficar sem foto (galeria vazia e imagem_capa_url nulo).';