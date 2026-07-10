-- =====================================================================
-- Vozes Paranaenses — 005_images.sql
-- Imagens de capa: coleta og:image, geração por IA (nano banana) ou upload manual.
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- 1. Coluna com a URL da imagem original detectada no scrape
alter table public.raw_articles
  add column if not exists imagem_original_url text;

-- 2. Crédito/legenda da capa gerada (ex.: "Imagem: IA (Vozes Paranaenses)")
alter table public.generated_articles
  add column if not exists imagem_credito text;

-- 3. Bucket público para as capas das matérias
insert into storage.buckets (id, name, public)
values ('article-covers', 'article-covers', true)
on conflict (id) do update set public = excluded.public;

-- 4. Políticas: leitura pública, escrita apenas admin/editor
drop policy if exists "article-covers public read" on storage.objects;
create policy "article-covers public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'article-covers');

drop policy if exists "article-covers editor write" on storage.objects;
create policy "article-covers editor write"
on storage.objects for all to authenticated
using (
  bucket_id = 'article-covers'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
)
with check (
  bucket_id = 'article-covers'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
);