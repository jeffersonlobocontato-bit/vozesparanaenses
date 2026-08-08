-- =====================================================================
-- Vozes Paranaenses — 057_imprensa_clientes.sql
-- "Portal da Imprensa" — diferente do Publieditorial/Vitrine Pessoal
-- (que usam link com token, sem senha), aqui o cliente tem LOGIN de
-- verdade (Supabase Auth), criado pelo admin. Cada cliente logado só
-- enxerga o próprio painel, nunca o de outro cliente.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.clientes_imprensa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome_empresa text not null,
  nome_contato text not null,
  email text not null,
  slug text not null unique,
  categoria_padrao_id uuid references public.editorial_categories(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

create index if not exists clientes_imprensa_slug_idx on public.clientes_imprensa(slug);

alter table public.clientes_imprensa enable row level security;

-- Admin/editor vê e gerencia todos os clientes.
drop policy if exists "equipe gerencia clientes imprensa" on public.clientes_imprensa;
create policy "equipe gerencia clientes imprensa" on public.clientes_imprensa
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- Cliente logado só enxerga o PRÓPRIO registro — nunca o de outro cliente.
drop policy if exists "cliente ve proprio registro" on public.clientes_imprensa;
create policy "cliente ve proprio registro" on public.clientes_imprensa
  for select to authenticated
  using (user_id = auth.uid());

grant all on public.clientes_imprensa to service_role;
grant select, insert, update, delete on public.clientes_imprensa to authenticated;

-- =====================================================================
-- Submissões de conteúdo (o que o cliente gera/publica pelo chat)
-- =====================================================================

create table if not exists public.imprensa_submissoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes_imprensa(id) on delete cascade,
  modo text not null default 'chat' check (modo in ('chat', 'upload')),
  historico_chat jsonb not null default '[]'::jsonb,
  conteudo_bruto text,
  categoria_detectada_id uuid references public.editorial_categories(id),
  titulo_gerado text,
  subtitulo_gerado text,
  corpo_gerado text,
  fotos jsonb not null default '[]'::jsonb,
  termo_aceito_em timestamptz,
  termo_aceito_ip text,
  termo_aceito_texto text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aguardando_aprovacao', 'publicado', 'rejeitado')),
  generated_article_id uuid references public.generated_articles(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  publicado_em timestamptz
);

create index if not exists imprensa_submissoes_cliente_idx on public.imprensa_submissoes(cliente_id, criado_em desc);

alter table public.imprensa_submissoes enable row level security;

drop policy if exists "equipe ve todas submissoes" on public.imprensa_submissoes;
create policy "equipe ve todas submissoes" on public.imprensa_submissoes
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "cliente gerencia proprias submissoes" on public.imprensa_submissoes;
create policy "cliente gerencia proprias submissoes" on public.imprensa_submissoes
  for all to authenticated
  using (cliente_id in (select id from public.clientes_imprensa where user_id = auth.uid()))
  with check (cliente_id in (select id from public.clientes_imprensa where user_id = auth.uid()));

grant all on public.imprensa_submissoes to service_role;
grant select, insert, update, delete on public.imprensa_submissoes to authenticated;

-- Rastreio de origem: liga a matéria final publicada ao cliente que a gerou.
alter table public.generated_articles
  add column if not exists origem_imprensa_cliente_id uuid references public.clientes_imprensa(id);

-- Bucket de fotos enviadas pelo cliente no Portal da Imprensa.
insert into storage.buckets (id, name, public)
values ('imprensa-imagens', 'imprensa-imagens', true)
on conflict (id) do nothing;

drop policy if exists "imprensa imagens leitura publica" on storage.objects;
create policy "imprensa imagens leitura publica" on storage.objects
  for select using (bucket_id = 'imprensa-imagens');

drop policy if exists "imprensa imagens upload cliente logado" on storage.objects;
create policy "imprensa imagens upload cliente logado" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imprensa-imagens'
    and exists (select 1 from public.clientes_imprensa where user_id = auth.uid() and ativo = true)
  );
