-- =====================================================================
-- Vozes Paranaenses — 053_coluna_edicao_slug.sql
-- Link amigável das edições de coluna:
--   /coluna/vozes-politicas/antes-da-convencao-o-parana-ja-elegeu...
-- em vez do UUID. Idempotente.
-- =====================================================================

create extension if not exists unaccent;

alter table public.coluna_edicoes add column if not exists slug text;

create or replace function public.slugify_coluna(txt text)
returns text language sql immutable as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent(coalesce(txt, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  )
$$;

-- Backfill: slug a partir do título, com sufixo numérico em caso de choque
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select id, coluna_id, titulo from public.coluna_edicoes where slug is null or slug = '' loop
    base := left(public.slugify_coluna(r.titulo), 90);
    if base = '' then base := 'edicao'; end if;
    cand := base;
    n := 1;
    while exists (select 1 from public.coluna_edicoes e where e.coluna_id = r.coluna_id and e.slug = cand) loop
      n := n + 1;
      cand := base || '-' || n;
    end loop;
    update public.coluna_edicoes set slug = cand where id = r.id;
  end loop;
end $$;

create unique index if not exists coluna_edicoes_slug_unico
  on public.coluna_edicoes(coluna_id, slug);

-- Novas edições ganham slug automático
create or replace function public.coluna_edicoes_set_slug()
returns trigger language plpgsql as $$
declare
  base text;
  cand text;
  n int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := left(public.slugify_coluna(new.titulo), 90);
    if base = '' then base := 'edicao'; end if;
    cand := base;
    while exists (
      select 1 from public.coluna_edicoes e
      where e.coluna_id = new.coluna_id and e.slug = cand and e.id <> new.id
    ) loop
      n := n + 1;
      cand := base || '-' || n;
    end loop;
    new.slug := cand;
  end if;
  return new;
end $$;

drop trigger if exists coluna_edicoes_slug_trg on public.coluna_edicoes;
create trigger coluna_edicoes_slug_trg
  before insert or update of titulo, slug on public.coluna_edicoes
  for each row execute function public.coluna_edicoes_set_slug();
