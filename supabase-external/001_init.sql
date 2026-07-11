-- =====================================================================
-- Paraná Total — Schema inicial (rodar no SQL Editor do Supabase externo)
-- Projeto: flcgtpzfnsrxawvyzzgh
-- =====================================================================

-- Extensões necessárias
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- =====================================================================
-- Enums
-- =====================================================================
do $$ begin
  create type article_status as enum ('draft','pending_review','approved','published','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_kind as enum ('rss','html','api','manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_channel as enum ('whatsapp','form','classified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','editor','reviewer','viewer');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Utilitário: updated_at
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- Perfis + roles (nunca em profiles)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "roles self read" on public.user_roles;
drop policy if exists "roles admin all" on public.user_roles;
create policy "roles self read" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "roles admin all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- Regiões (10 regiões do PR)
-- =====================================================================
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  main_city text not null,
  description text,
  primary_color text default '#0EA5E9',
  accent_color  text default '#F59E0B',
  hero_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.regions to anon, authenticated;
grant all on public.regions to service_role;
alter table public.regions enable row level security;
drop policy if exists "regions public read" on public.regions;
drop policy if exists "regions admin write" on public.regions;
create policy "regions public read" on public.regions for select to anon, authenticated using (active = true);
create policy "regions admin write" on public.regions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop trigger if exists trg_regions_updated on public.regions;
create trigger trg_regions_updated before update on public.regions for each row execute function public.set_updated_at();

-- =====================================================================
-- Categorias
-- =====================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
drop policy if exists "categories public read" on public.categories;
drop policy if exists "categories admin write" on public.categories;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "categories admin write" on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- Fontes (RSS/HTML/API)
-- =====================================================================
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id) on delete set null,
  name text not null,
  url text not null,
  kind source_kind not null default 'rss',
  active boolean not null default true,
  last_fetched_at timestamptz,
  fetch_interval_minutes int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sources to authenticated;
grant all on public.sources to service_role;
alter table public.sources enable row level security;
drop policy if exists "sources editors read" on public.sources;
drop policy if exists "sources admin write" on public.sources;
create policy "sources editors read" on public.sources for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'reviewer'));
create policy "sources admin write" on public.sources for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop trigger if exists trg_sources_updated on public.sources;
create trigger trg_sources_updated before update on public.sources for each row execute function public.set_updated_at();

-- =====================================================================
-- Itens brutos capturados
-- =====================================================================
create table if not exists public.raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  region_id uuid references public.regions(id) on delete set null,
  external_id text,
  url text not null,
  title text,
  raw_html text,
  raw_text text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  embedding vector(1536),
  cluster_id uuid,
  processed boolean not null default false,
  unique (source_id, url)
);
grant all on public.raw_items to service_role;
alter table public.raw_items enable row level security;
drop policy if exists "raw_items editors read" on public.raw_items;
create policy "raw_items editors read" on public.raw_items for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index if not exists raw_items_region_idx on public.raw_items(region_id);
create index if not exists raw_items_cluster_idx on public.raw_items(cluster_id);
create index if not exists raw_items_embedding_idx on public.raw_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =====================================================================
-- Fatos extraídos (Claude fase 1)
-- =====================================================================
create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  cluster_id uuid,
  payload jsonb not null,
  confidence numeric,
  created_at timestamptz not null default now()
);
grant all on public.facts to service_role;
alter table public.facts enable row level security;
drop policy if exists "facts editors read" on public.facts;
create policy "facts editors read" on public.facts for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index if not exists facts_cluster_idx on public.facts(cluster_id);

-- =====================================================================
-- Artigos + versões
-- =====================================================================
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  slug text not null,
  title text not null,
  subtitle text,
  summary text,
  body_md text,
  cover_image_url text,
  status article_status not null default 'draft',
  cluster_id uuid,
  author_user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  og_image_url text,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, slug)
);
grant select on public.articles to anon;
grant select, insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
alter table public.articles enable row level security;
drop policy if exists "articles public read published" on public.articles;
drop policy if exists "articles editors read all" on public.articles;
drop policy if exists "articles editors write" on public.articles;
create policy "articles public read published" on public.articles for select to anon, authenticated
  using (status = 'published');
create policy "articles editors read all" on public.articles for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'reviewer'));
create policy "articles editors write" on public.articles for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index if not exists articles_region_status_idx on public.articles(region_id, status, published_at desc);
drop trigger if exists trg_articles_updated on public.articles;
create trigger trg_articles_updated before update on public.articles for each row execute function public.set_updated_at();

create table if not exists public.article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  version int not null,
  title text,
  body_md text,
  generated_by text,
  prompt jsonb,
  created_at timestamptz not null default now(),
  unique (article_id, version)
);
grant all on public.article_versions to service_role;
grant select on public.article_versions to authenticated;
alter table public.article_versions enable row level security;
drop policy if exists "versions editors read" on public.article_versions;
create policy "versions editors read" on public.article_versions for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'reviewer'));

create table if not exists public.article_sources (
  article_id uuid not null references public.articles(id) on delete cascade,
  raw_item_id uuid not null references public.raw_items(id) on delete cascade,
  primary key (article_id, raw_item_id)
);
grant all on public.article_sources to service_role;
grant select on public.article_sources to anon, authenticated;
alter table public.article_sources enable row level security;
drop policy if exists "article_sources public read" on public.article_sources;
create policy "article_sources public read" on public.article_sources for select to anon, authenticated using (true);

-- =====================================================================
-- Leads (WhatsApp + formulários)
-- =====================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id) on delete set null,
  channel lead_channel not null,
  name text,
  phone text,
  email text,
  message text,
  consent_lgpd boolean not null default false,
  consent_at timestamptz,
  source_url text,
  created_at timestamptz not null default now()
);
grant insert on public.leads to anon, authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
drop policy if exists "leads public insert" on public.leads;
drop policy if exists "leads admin read" on public.leads;
create policy "leads public insert" on public.leads for insert to anon, authenticated with check (consent_lgpd = true);
create policy "leads admin read" on public.leads for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- =====================================================================
-- Classificados
-- =====================================================================
create table if not exists public.classifieds (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  price_cents int,
  contact_phone text,
  contact_email text,
  images jsonb default '[]'::jsonb,
  status article_status not null default 'pending_review',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.classifieds to anon;
grant select, insert, update, delete on public.classifieds to authenticated;
grant all on public.classifieds to service_role;
alter table public.classifieds enable row level security;
drop policy if exists "classifieds public read" on public.classifieds;
drop policy if exists "classifieds owner read" on public.classifieds;
drop policy if exists "classifieds owner insert" on public.classifieds;
drop policy if exists "classifieds owner update" on public.classifieds;
drop policy if exists "classifieds admin all" on public.classifieds;
create policy "classifieds public read" on public.classifieds for select to anon, authenticated using (status = 'published');
create policy "classifieds owner read" on public.classifieds for select to authenticated using (auth.uid() = user_id);
create policy "classifieds owner insert" on public.classifieds for insert to authenticated with check (auth.uid() = user_id);
create policy "classifieds owner update" on public.classifieds for update to authenticated using (auth.uid() = user_id);
create policy "classifieds admin all" on public.classifieds for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop trigger if exists trg_classifieds_updated on public.classifieds;
create trigger trg_classifieds_updated before update on public.classifieds for each row execute function public.set_updated_at();

-- =====================================================================
-- Analytics (beacon)
-- =====================================================================
create table if not exists public.page_views (
  id bigserial primary key,
  article_id uuid references public.articles(id) on delete set null,
  region_id uuid references public.regions(id) on delete set null,
  path text not null,
  referrer text,
  user_agent text,
  session_hash text,
  created_at timestamptz not null default now()
);
grant insert on public.page_views to anon, authenticated;
grant usage, select on sequence public.page_views_id_seq to anon, authenticated;
grant all on public.page_views to service_role;
alter table public.page_views enable row level security;
drop policy if exists "pageviews public insert" on public.page_views;
drop policy if exists "pageviews admin read" on public.page_views;
create policy "pageviews public insert" on public.page_views for insert to anon, authenticated with check (true);
create policy "pageviews admin read" on public.page_views for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index if not exists page_views_created_idx on public.page_views(created_at desc);
create index if not exists page_views_article_idx on public.page_views(article_id);

-- =====================================================================
-- Handle novo usuário → profile
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Seed: 10 regiões do Paraná
-- =====================================================================
insert into public.regions (slug, name, main_city, description, primary_color, accent_color) values
  ('curitiba',       'Curitiba',        'Curitiba',        'Capital do Paraná',            '#1E3A8A', '#F59E0B'),
  ('rmc',            'RMC',             'São José dos Pinhais', 'Região Metropolitana de Curitiba', '#0F766E', '#FBBF24'),
  ('litoral',        'Litoral',         'Paranaguá',       'Litoral do Paraná',            '#0891B2', '#F97316'),
  ('campos-gerais',  'Campos Gerais',   'Ponta Grossa',    'Campos Gerais',                '#65A30D', '#DC2626'),
  ('norte-pioneiro', 'Norte Pioneiro',  'Jacarezinho',     'Norte Pioneiro',               '#B45309', '#0EA5E9'),
  ('norte-central',  'Norte',           'Londrina',        'Norte Paranaense',             '#7C3AED', '#F59E0B'),
  ('noroeste',       'Noroeste',        'Maringá',         'Noroeste do Paraná',           '#DB2777', '#22C55E'),
  ('oeste',          'Oeste',           'Cascavel',        'Oeste do Paraná',              '#DC2626', '#FACC15'),
  ('sudoeste',       'Sudoeste',        'Francisco Beltrão','Sudoeste do Paraná',          '#16A34A', '#F97316'),
  ('centro-sul',     'Centro-Sul',      'Guarapuava',      'Centro-Sul do Paraná',         '#0EA5E9', '#F43F5E')
on conflict (slug) do nothing;

-- =====================================================================
-- Categorias iniciais
-- =====================================================================
insert into public.categories (slug, name) values
  ('politica','Política'),
  ('economia','Economia'),
  ('policial','Polícia'),
  ('esportes','Esportes'),
  ('cultura','Cultura'),
  ('agro','Agronegócio'),
  ('cidades','Cidades'),
  ('educacao','Educação'),
  ('saude','Saúde'),
  ('meio-ambiente','Meio Ambiente')
on conflict (slug) do nothing;

-- =====================================================================
-- FIM. Após rodar: crie o primeiro admin manualmente:
--   insert into public.user_roles (user_id, role)
--   values ('<uuid do usuário em auth.users>', 'admin');
-- =====================================================================