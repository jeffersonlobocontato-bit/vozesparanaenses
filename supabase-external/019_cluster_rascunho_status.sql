-- =====================================================================
-- Vozes Paranaenses — 019_cluster_rascunho_status.sql
-- Adiciona 'rascunho_gerado' ao enum cluster_status.
--
-- Quando o editor gera uma matéria a partir de uma pauta, o cluster
-- passa para esse status e deixa de aparecer no Painel de Pautas,
-- mantendo a página limpa e focada apenas em pautas pendentes.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter type cluster_status add value if not exists 'rascunho_gerado';

-- Pautas que já geraram uma matéria (rascunho ou publicada) somem do painel
update public.article_clusters
set status = 'rascunho_gerado'
where status in ('novo', 'selecionado_cota', 'fatos_extraidos', 'descartado')
  and exists (
    select 1 from public.generated_articles ga
    where ga.cluster_id = article_clusters.id
  );

