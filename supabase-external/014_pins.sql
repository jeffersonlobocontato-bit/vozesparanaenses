-- Fixação de matérias na manchete e nos destaques laterais.
-- fixado_posicao:
--   NULL  = não fixada (comportamento automático por data)
--   0     = manchete principal
--   1..N  = destaques da coluna lateral (1 é o topo)
alter table public.generated_articles
  add column if not exists fixado_posicao smallint;

create index if not exists generated_articles_fixado_posicao_idx
  on public.generated_articles (fixado_posicao)
  where fixado_posicao is not null;