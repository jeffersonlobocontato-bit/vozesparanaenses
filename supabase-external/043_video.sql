-- =====================================================================
-- Vozes Paranaenses — 043_video.sql
-- Adiciona vídeo (embed URL ou upload) por matéria.
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.generated_articles
  add column if not exists video_embed_url text;

comment on column public.generated_articles.video_embed_url is
  'URL do vídeo da matéria. Aceita YouTube/Vimeo (será embedado como iframe) ou arquivo MP4/WebM (bucket article-videos, renderizado com <video>).';

-- Bucket público para uploads de vídeo da redação
insert into storage.buckets (id, name, public)
values ('article-videos', 'article-videos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "article-videos public read" on storage.objects;
create policy "article-videos public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'article-videos');

drop policy if exists "article-videos editor write" on storage.objects;
create policy "article-videos editor write"
on storage.objects for all to authenticated
using (
  bucket_id = 'article-videos'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
)
with check (
  bucket_id = 'article-videos'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
);