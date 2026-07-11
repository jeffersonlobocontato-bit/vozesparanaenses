-- 017: persist a permanent copy of the scraped source photo on each article
-- so the editor can freely switch between the original, an AI variation, or
-- a manual upload without depending on the source site staying online.
alter table public.generated_articles
  add column if not exists imagem_original_url text;

comment on column public.generated_articles.imagem_original_url is
  'URL pública (bucket article-covers) da cópia permanente da foto original scraped da fonte. Nunca é sobrescrita — imagem_capa_url pode apontar aqui, para uma variação IA, ou para um upload manual.';
