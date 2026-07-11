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
