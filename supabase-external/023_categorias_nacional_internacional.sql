-- =====================================================================
-- Vozes Paranaenses — 023_categorias_nacional_internacional.sql
-- Adiciona categorias "Nacional" e "Internacional" para tagear notícias
-- que o scraping capturou mas que não são especificamente sobre o Paraná
-- (ex.: cobertura Brasil ou mundo relevante para o leitor paranaense).
-- Idempotente.
-- =====================================================================

insert into public.editorial_categories (slug, nome, peso_engajamento) values
  ('nacional',      'Nacional',      0.7),
  ('internacional', 'Internacional', 0.6)
on conflict (slug) do update set
  nome = excluded.nome,
  peso_engajamento = excluded.peso_engajamento;

-- Cotas baixas por região × categoria: essas tags são exceção, não devem
-- dominar a home regional. Teto pequeno evita inundar o feed local.
insert into public.quota_rules (regiao_id, categoria_id, piso_pct, teto_pct)
select r.id, c.id, 0, case c.slug when 'nacional' then 10 else 5 end
from public.regioes r
cross join public.editorial_categories c
where c.slug in ('nacional','internacional')
on conflict (regiao_id, categoria_id) do nothing;