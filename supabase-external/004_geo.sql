-- Vozes Paranaenses — geolocalização editorial
-- Adiciona cidade principal e cidades mencionadas em generated_articles
-- e cria índice p/ ranking "cidade + entorno" na home.
-- Idempotente: pode rodar múltiplas vezes.

ALTER TABLE public.generated_articles
  ADD COLUMN IF NOT EXISTS cidade_principal text,
  ADD COLUMN IF NOT EXISTS cidades_mencionadas text[] DEFAULT '{}'::text[];

-- Índice p/ busca por cidade principal (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_generated_articles_cidade_principal
  ON public.generated_articles (lower(cidade_principal));

-- Índice GIN p/ array de cidades mencionadas
CREATE INDEX IF NOT EXISTS idx_generated_articles_cidades_mencionadas
  ON public.generated_articles USING GIN (cidades_mencionadas);