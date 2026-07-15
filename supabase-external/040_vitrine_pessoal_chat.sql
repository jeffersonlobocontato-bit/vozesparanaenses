-- =====================================================================
-- Vozes Paranaenses — 040_vitrine_pessoal_chat.sql
-- Estende a Vitrine Pessoal pro mesmo modelo de entrevista por chat (com
-- voz) que já existe no Publieditorial — em vez de só o formulário
-- estático. A entrevista cria o pedido já no início (vazio) e vai
-- preenchendo os campos conforme a conversa avança.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- 1. Relaxa colunas que antes eram preenchidas de uma vez (formulário) e
--    agora são preenchidas progressivamente (chat).
alter table public.vitrine_pessoal_pedidos
  alter column nome_cliente drop not null,
  alter column contato drop not null,
  alter column profissao drop not null,
  alter column sobre_pessoa_ou_empresa drop not null,
  alter column regiao_id drop not null,
  alter column briefing_texto drop not null;

-- 2. Novo status inicial — pedido existe, mas a entrevista ainda não
--    terminou (sem os campos ainda preenchidos).
alter table public.vitrine_pessoal_pedidos drop constraint if exists vitrine_pessoal_pedidos_status_check;
alter table public.vitrine_pessoal_pedidos add constraint vitrine_pessoal_pedidos_status_check
  check (status in (
    'entrevistando','gerando','aguardando_edicao','enviado_para_aprovacao',
    'aprovado','pago','publicado','recusado','erro'
  ));

-- 3. Histórico do chat da entrevista (mesmo padrão do Publieditorial)
create table if not exists public.vitrine_pessoal_chat_messages (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.vitrine_pessoal_pedidos(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_vitrine_pessoal_chat_messages_pedido
  on public.vitrine_pessoal_chat_messages(pedido_id, criado_em);

grant all on public.vitrine_pessoal_chat_messages to service_role;
alter table public.vitrine_pessoal_chat_messages enable row level security;
-- Sem policy pra anon/authenticated: leitura/escrita só pelo backend
-- (edge functions com service role) — mesmo padrão do Publieditorial.
