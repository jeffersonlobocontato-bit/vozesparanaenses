-- =====================================================================
-- Vozes Paranaenses — 022_publicacao_automatica.sql
-- Suporte à escrita e publicação automáticas, sem curadoria manual do que
-- escrever — a decisão humana passa a ser só "publicar ou não" (e só
-- quando necessário: matéria com foto real da fonte NUNCA publica
-- sozinha, fica sempre na fila para decisão).
--
-- Expiração em duas fases (proteção contra perda de conteúdo por dias
-- sem revisar o painel — ver expire-drafts):
--   1. Rascunho com mais de 12h vira 'expirado' (some da fila ativa)
--   2. Expirado com mais de 7 dias é apagado de vez
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter type materia_status add value if not exists 'expirado';

alter table public.generated_articles
  add column if not exists publicado_automaticamente boolean not null default false,
  add column if not exists expirado_em timestamptz;
