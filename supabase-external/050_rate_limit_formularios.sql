-- =====================================================================
-- Vozes Paranaenses — 050_rate_limit_formularios.sql
-- Tabela genérica de limite por IP pra formulários públicos (contato,
-- Vitrine Pessoal, Publieditorial, chat de vendas) — parte da correção de
-- segurança pra impedir spam/cadastro falso automatizado e uso indevido
-- das funções de IA.
--
-- Guarda só o HASH do IP (nunca o IP em si), suficiente pra contar
-- tentativas sem virar dado pessoal identificável guardado cru.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.form_rate_limit (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  endpoint text not null,
  criado_em timestamptz not null default now()
);

create index if not exists form_rate_limit_lookup_idx
  on public.form_rate_limit(endpoint, ip_hash, criado_em);

-- Limpeza automática de registros com mais de 24h — a tabela não precisa
-- crescer pra sempre, só serve de janela deslizante curta.
create index if not exists form_rate_limit_criado_em_idx
  on public.form_rate_limit(criado_em);

grant all on public.form_rate_limit to service_role;
alter table public.form_rate_limit enable row level security;
-- Sem policy de leitura/escrita pra anon/authenticated — só o backend
-- (service role, dentro das Edge Functions/rotas de servidor) mexe aqui.
