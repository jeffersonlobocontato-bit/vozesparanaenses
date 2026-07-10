-- =====================================================================
-- Vozes Paranaenses — 009_advertisers_columns_fix.sql
-- CORREÇÃO: 007_ads.sql tentou recriar `public.advertisers` com um schema
-- mais completo (cnpj, email, telefone, cidade, regiao_slug, ativo), mas
-- usou `create table if not exists` — como a tabela já existia desde
-- 002_vozes.sql (nome, regiao_id, contato, plano), essas colunas nunca
-- foram criadas de fato. A tela admin.anuncios.tsx lê/grava exatamente
-- essas colunas ausentes, então inserts/updates de anunciante falham.
-- Esta migration adiciona as colunas que faltam, sem remover as antigas.
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.advertisers
  add column if not exists cnpj          text,
  add column if not exists email         text,
  add column if not exists telefone      text,
  add column if not exists cidade        text,
  add column if not exists regiao_slug   text,
  add column if not exists ativo         boolean not null default true,
  add column if not exists atualizado_em timestamptz not null default now();

-- Mantém atualizado_em em dia a cada update (mesmo padrão de correcoes_touch_updated_at)
create or replace function public.advertisers_touch_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists advertisers_touch_atualizado_em on public.advertisers;
create trigger advertisers_touch_atualizado_em
  before update on public.advertisers
  for each row execute function public.advertisers_touch_atualizado_em();

-- Nota: as colunas antigas (regiao_id, contato, plano, created_at) foram
-- mantidas por segurança — nenhuma referência a elas foi encontrada no
-- código atual, mas removê-las é uma decisão separada, não urgente.
