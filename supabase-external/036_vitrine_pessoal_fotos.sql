-- =====================================================================
-- Vozes Paranaenses — 036_vitrine_pessoal_fotos.sql
-- Permite que o cliente da Vitrine Pessoal anexe fotos ao pedido antes
-- de enviar para aprovação. Cria bucket público e coluna JSONB com a
-- lista de imagens ({url, name}). Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.vitrine_pessoal_pedidos
  add column if not exists imagens jsonb not null default '[]'::jsonb;

comment on column public.vitrine_pessoal_pedidos.imagens is
  'Lista de fotos enviadas pelo cliente: [{"url":"...","name":"..."}].';

insert into storage.buckets (id, name, public)
values ('vitrine-pessoal-fotos', 'vitrine-pessoal-fotos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "vitrine-pessoal-fotos public read" on storage.objects;
create policy "vitrine-pessoal-fotos public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'vitrine-pessoal-fotos');

drop policy if exists "vitrine-pessoal-fotos editor manage" on storage.objects;
create policy "vitrine-pessoal-fotos editor manage"
on storage.objects for all to authenticated
using (
  bucket_id = 'vitrine-pessoal-fotos'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
)
with check (
  bucket_id = 'vitrine-pessoal-fotos'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
);