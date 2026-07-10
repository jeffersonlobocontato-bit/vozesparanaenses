-- =====================================================================
-- Vozes Paranaenses — 011_cluster_status_extend.sql
-- Adiciona 'fatos_extraidos' ao enum cluster_status, para suportar a
-- separação entre extração de fatos (extract-facts) e geração da
-- matéria (generate-article), que antes eram uma única chamada de IA.
--
-- Novo fluxo de status do cluster:
--   novo → selecionado_cota (classify-and-quota) → fatos_extraidos
--   (extract-facts) → [gerado manualmente via generate-article,
--   que não muda o status do cluster — o rascunho vive em
--   generated_articles.status]
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter type cluster_status add value if not exists 'fatos_extraidos';
