-- Fixação geo-segmentada de matérias.
-- Escopo define onde a matéria fixada aparece:
--   'estado'  (ou null) — em toda a home estadual (comportamento antigo)
--   'regiao'  — só em uma ou mais regiões (slugs em fixado_regioes)
--   'cidades' — só em cidades específicas (slugs em fixado_cidades)
alter table public.generated_articles
  add column if not exists fixado_escopo   text,
  add column if not exists fixado_regioes  text[] default '{}'::text[],
  add column if not exists fixado_cidades  text[] default '{}'::text[];

create index if not exists generated_articles_fixado_regioes_idx
  on public.generated_articles using gin (fixado_regioes);

create index if not exists generated_articles_fixado_cidades_idx
  on public.generated_articles using gin (fixado_cidades);