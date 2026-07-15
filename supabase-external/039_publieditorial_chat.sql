-- =====================================================================
-- Vozes Paranaenses — 039_publieditorial_chat.sql
-- Roda no Supabase EXTERNO (SQL editor do banco de conteúdo).
--
-- Cria a tabela de histórico do chat da entrevista publieditorial. O
-- agente IA (edge function publieditorial-chat) faz as perguntas e
-- grava aqui as mensagens do cliente e as próprias, até ter material
-- suficiente pra chamar a tool `finalizar_briefing` e disparar a
-- geração da matéria.
--
-- Idempotente.
-- =====================================================================

create table if not exists public.publieditorial_chat_messages (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.publieditorial_briefings(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_publieditorial_chat_messages_briefing
  on public.publieditorial_chat_messages(briefing_id, criado_em);

grant all on public.publieditorial_chat_messages to service_role;

alter table public.publieditorial_chat_messages enable row level security;

-- Sem policy pra anon/authenticated: leitura/escrita só pelo backend
-- (edge functions com service role).