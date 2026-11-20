-- Fase 1 da redução de custo de IA (20/11/2026). JÁ APLICADA no banco Rede de Portais.
-- Conta as falhas de IA por pauta; o process-pending-clusters descarta a pauta
-- na 3ª falha, em vez de repeti-la a cada ciclo de 4 minutos.
alter table public.article_clusters add column if not exists tentativas_ia int not null default 0;
