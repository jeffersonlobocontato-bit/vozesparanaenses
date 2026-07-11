-- 020: guarda o crédito/legenda da foto extraída no scraping (ex.: "Foto: João Silva/PMU").
-- Preservado junto com a URL original em raw_articles e depois copiado para generated_articles.
alter table public.raw_articles
  add column if not exists imagem_credito text;

comment on column public.raw_articles.imagem_credito is
  'Crédito/legenda da foto original extraída da fonte (figcaption, wp-caption-text, meta author, ou padrão "Foto:/Crédito:" próximo da imagem).';