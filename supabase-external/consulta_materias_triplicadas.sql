-- Roda no SQL Editor do Supabase EXTERNO. Só leitura, não altera nada.
--
-- Mostra os clusters que têm MAIS DE UMA matéria gerada (o bug de hoje) —
-- revise antes de rodar a migration de limpeza.

select
  cluster_id,
  count(*) as quantidade,
  array_agg(id order by gerado_em) as ids_na_ordem_de_criacao,
  array_agg(titulo order by gerado_em) as titulos,
  array_agg(status order by gerado_em) as status_de_cada_uma,
  array_agg(gerado_em order by gerado_em) as horarios
from generated_articles
group by cluster_id
having count(*) > 1
order by max(gerado_em) desc;
