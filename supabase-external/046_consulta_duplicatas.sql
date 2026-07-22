-- Roda no SQL Editor do Supabase EXTERNO. Só leitura, não altera nada.
--
-- Agrupa matérias publicadas na mesma categoria + região + mesmo dia —
-- candidatas fortes a duplicata (foi assim que achamos o caso de Foz do
-- Iguaçu). Não é 100% preciso (pode aparecer coincidência legítima de duas
-- matérias diferentes no mesmo dia/categoria/região), então revise a olho
-- antes de apagar qualquer uma.

select
  c.nome as categoria,
  r.nome as regiao,
  date(ga.publicado_em) as dia,
  count(*) as quantidade,
  array_agg(ga.titulo order by ga.publicado_em) as titulos,
  array_agg(ga.slug order by ga.publicado_em) as slugs,
  array_agg(ga.id order by ga.publicado_em) as ids
from generated_articles ga
join editorial_categories c on c.id = ga.categoria_id
join regioes r on r.id = ga.regiao_id
where ga.status = 'publicado'
group by c.nome, r.nome, date(ga.publicado_em)
having count(*) > 1
order by dia desc;
