-- =====================================================================
-- Vozes Paranaenses — 052_coluna_comentarios.sql
-- Comentários dos leitores nas edições das colunas + avatar do colunista.
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- avatar/foto da coluna (já existe em 051, garantido aqui)
alter table public.colunas add column if not exists foto_colunista_url text;

create table if not exists public.coluna_comentarios (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.coluna_edicoes(id) on delete cascade,
  nome text not null,
  comentario text not null,
  aprovado boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists coluna_comentarios_edicao_idx
  on public.coluna_comentarios(edicao_id, criado_em desc);

alter table public.coluna_comentarios enable row level security;

grant select on public.coluna_comentarios to anon, authenticated;
grant insert, update, delete on public.coluna_comentarios to authenticated;

drop policy if exists "comentarios leitura publica" on public.coluna_comentarios;
create policy "comentarios leitura publica" on public.coluna_comentarios
  for select to anon, authenticated using (aprovado = true);

drop policy if exists "comentarios leitura equipe" on public.coluna_comentarios;
create policy "comentarios leitura equipe" on public.coluna_comentarios
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "comentarios moderacao equipe" on public.coluna_comentarios;
create policy "comentarios moderacao equipe" on public.coluna_comentarios
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));
