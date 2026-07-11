-- Reset completo de conteúdo editorial.
-- Mantém: fontes, regiões, cidades, categorias, anunciantes, usuários, config.
-- Apaga: matérias publicadas, clusters, artigos scrapeados, fatos, impressões de anúncios.

BEGIN;

TRUNCATE TABLE
  public.generated_articles,
  public.extracted_facts,
  public.cluster_articles,
  public.article_clusters,
  public.raw_articles,
  public.ad_impressions
RESTART IDENTITY CASCADE;

COMMIT;
