-- =====================================================================
-- Vozes Paranaenses — 054_impede_matéria_duplicada.sql
-- Corrige o bug de matérias triplicadas: process-pending-clusters nunca
-- marcava o cluster como "já escrito" depois de gerar a matéria, então
-- qualquer chamada seguinte (o dreno de segurança do painel, duplo
-- clique, ou duas abas rodando o pipeline ao mesmo tempo) encontrava a
-- MESMA pauta como pendente de novo e escrevia outra matéria pra ela.
--
-- O código já foi corrigido em duas camadas (process-pending-clusters
-- marca o cluster na hora; generate-article recusa reescrever cluster
-- que já tem matéria). Esta migration é a TERCEIRA camada — trava no
-- próprio banco, pra nunca mais depender só de lógica de aplicação.
--
-- PASSO 1: limpa o que já duplicou hoje, mantendo sempre a PRIMEIRA
-- matéria gerada de cada cluster (a mais antiga) e apagando as demais.
-- Revise a consulta_materias_triplicadas.sql ANTES de rodar isto, se
-- quiser conferir manualmente o que vai ser removido.
--
-- Roda no Supabase EXTERNO. Idempotente (não quebra se rodar de novo).
-- =====================================================================

delete from public.generated_articles ga
where ga.id in (
  select id from (
    select id, row_number() over (
      partition by cluster_id order by gerado_em asc, id asc
    ) as posicao
    from public.generated_articles
    where cluster_id is not null
  ) ranked
  where ranked.posicao > 1
);

-- PASSO 2: trava — um cluster nunca mais pode ter mais de uma matéria.
-- (ADD CONSTRAINT não aceita IF NOT EXISTS no Postgres — checa manualmente.)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'generated_articles_cluster_id_unique'
  ) then
    alter table public.generated_articles
      add constraint generated_articles_cluster_id_unique unique (cluster_id);
  end if;
end $$;
