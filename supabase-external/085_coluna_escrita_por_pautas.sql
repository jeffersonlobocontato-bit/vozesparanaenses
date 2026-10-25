-- =====================================================================
-- Vozes Paranaenses — 085_coluna_escrita_por_pautas.sql
--
-- Vozes Políticas escrita a partir de uma caixa única de pautas (links e/ou
-- textos, na ordem das notas). A função coluna-escrever usa o agente da
-- coluna e devolve a edição estruturada para revisão no painel.
--
--   1. colunas.agente_instrucoes — o agente da coluna (editável no painel,
--      aba Identidade). Vazio = agente padrão do código
--      (supabase/functions/_shared/coluna-politica.ts).
--   2. coluna_edicoes.pautas — as pautas que geraram a edição (para
--      reescrever depois).
--   3. coluna_escritas_ia — uma linha por escrita, para o painel de custos
--      (item ia_coluna da 084; a tabela é criada aqui e lá, em qualquer ordem).
--
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

alter table public.colunas add column if not exists agente_instrucoes text;
alter table public.coluna_edicoes add column if not exists pautas text;

create table if not exists public.coluna_escritas_ia (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references public.colunas(id) on delete cascade,
  pautas int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists coluna_escritas_ia_criado_idx on public.coluna_escritas_ia (criado_em);
-- Só a função (service role) escreve; ninguém de fora lê.
alter table public.coluna_escritas_ia enable row level security;

-- O custo (item ia_coluna) já vem na 084 (painel de custos).

-- Conferência
select column_name from information_schema.columns where table_name = 'colunas' and column_name = 'agente_instrucoes';
