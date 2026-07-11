-- =====================================================================
-- Vozes Paranaenses — Pivô de schema (rodar no SQL Editor do Supabase externo)
-- Substitui as tabelas de conteúdo do 001_init.sql pelo modelo em português
-- descrito no brief do projeto. Mantém profiles, user_roles, has_role,
-- handle_new_user e set_updated_at do 001.
-- =====================================================================

-- Extensões (idempotente)
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- =====================================================================
-- 1. DROP das tabelas antigas (sem dados publicados)
-- =====================================================================
drop table if exists public.page_views cascade;
drop table if exists public.article_sources cascade;
drop table if exists public.article_versions cascade;
drop table if exists public.articles cascade;
drop table if exists public.classifieds cascade;
drop table if exists public.leads cascade;
drop table if exists public.facts cascade;
drop table if exists public.raw_items cascade;
drop table if exists public.sources cascade;
drop table if exists public.categories cascade;
drop table if exists public.regions cascade;

drop type if exists article_status cascade;
drop type if exists source_kind cascade;
drop type if exists lead_channel cascade;

-- =====================================================================
-- 2. Enums novos
-- =====================================================================
do $$ begin
  create type materia_status as enum ('rascunho','aprovado','rejeitado','publicado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_conteudo as enum ('noticia','institucional','nota_oficial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_renderizacao as enum ('estatico','spa_js');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cluster_status as enum ('novo','selecionado_cota','descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type classificado_categoria as enum ('emprego','imovel','veiculo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type canal_whatsapp as enum ('canal_nativo','lista_api');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 3. Regiões (10 macrorregiões IPARDES)
-- =====================================================================
create table public.regioes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  cidade_principal text not null,
  descricao text,
  tema_config jsonb not null default '{}'::jsonb,
  hero_image_url text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.regioes to anon, authenticated;
grant all on public.regioes to service_role;
alter table public.regioes enable row level security;
create policy "regioes public read" on public.regioes for select to anon, authenticated using (ativa = true);
create policy "regioes admin write" on public.regioes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger trg_regioes_updated before update on public.regioes for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Categorias editoriais
-- =====================================================================
create table public.editorial_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  created_at timestamptz not null default now()
);
grant select on public.editorial_categories to anon, authenticated;
grant all on public.editorial_categories to service_role;
alter table public.editorial_categories enable row level security;
create policy "cats public read" on public.editorial_categories for select to anon, authenticated using (true);
create policy "cats admin write" on public.editorial_categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- 5. Cotas editoriais (piso/teto por região × categoria)
-- =====================================================================
create table public.quota_rules (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  categoria_id uuid not null references public.editorial_categories(id) on delete cascade,
  piso_pct numeric not null default 0,
  teto_pct numeric not null default 100,
  unique (regiao_id, categoria_id)
);
grant all on public.quota_rules to service_role;
grant select on public.quota_rules to authenticated;
alter table public.quota_rules enable row level security;
create policy "quota admin all" on public.quota_rules for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- 6. Fontes monitoradas
-- =====================================================================
create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid references public.regioes(id) on delete set null,
  nome text not null,
  url_base text not null,
  tipo_renderizacao tipo_renderizacao not null default 'estatico',
  protecao_antibot boolean not null default false,
  frequencia_horas int not null default 6,
  ativo boolean not null default true,
  ultimo_scrape_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.fontes to service_role;
grant select on public.fontes to authenticated;
alter table public.fontes enable row level security;
create policy "fontes editor read" on public.fontes for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create policy "fontes admin write" on public.fontes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger trg_fontes_updated before update on public.fontes for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. Artigos brutos coletados
-- =====================================================================
create table public.raw_articles (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.fontes(id) on delete cascade,
  regiao_id uuid references public.regioes(id) on delete set null,
  url text not null,
  titulo text,
  corpo_limpo text,
  hash_conteudo text not null unique,
  data_publicacao_original timestamptz,
  embedding vector(1536),
  processado boolean not null default false,
  coletado_em timestamptz not null default now()
);
grant all on public.raw_articles to service_role;
alter table public.raw_articles enable row level security;
create policy "raw editor read" on public.raw_articles for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index raw_articles_regiao_idx on public.raw_articles(regiao_id);
create index raw_articles_embedding_idx on public.raw_articles using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =====================================================================
-- 8. Clusters (pauta = múltiplas fontes)
-- =====================================================================
create table public.article_clusters (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  categoria_id uuid references public.editorial_categories(id) on delete set null,
  prioridade_score numeric not null default 0,
  status cluster_status not null default 'novo',
  criado_em timestamptz not null default now()
);
grant all on public.article_clusters to service_role;
alter table public.article_clusters enable row level security;
create policy "clusters editor read" on public.article_clusters for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index clusters_regiao_status_idx on public.article_clusters(regiao_id, status);

create table public.cluster_articles (
  cluster_id uuid not null references public.article_clusters(id) on delete cascade,
  raw_article_id uuid not null references public.raw_articles(id) on delete cascade,
  primary key (cluster_id, raw_article_id)
);
grant all on public.cluster_articles to service_role;
alter table public.cluster_articles enable row level security;
create policy "ca editor read" on public.cluster_articles for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- =====================================================================
-- 9. Fatos extraídos (5W1H)
-- =====================================================================
create table public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.article_clusters(id) on delete cascade,
  quem text,
  o_que text,
  quando text,
  onde text,
  por_que text,
  dados jsonb default '{}'::jsonb,
  citacoes jsonb default '[]'::jsonb,
  fontes jsonb default '[]'::jsonb,
  criado_em timestamptz not null default now()
);
grant all on public.extracted_facts to service_role;
alter table public.extracted_facts enable row level security;
create policy "facts editor read" on public.extracted_facts for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- =====================================================================
-- 10. Matérias geradas (Método DEL) — a tabela pública principal
-- =====================================================================
create table public.generated_articles (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references public.article_clusters(id) on delete set null,
  regiao_id uuid not null references public.regioes(id) on delete restrict,
  categoria_id uuid references public.editorial_categories(id) on delete set null,
  slug text not null,
  titulo text not null,
  subtitulo text,
  resumo text,
  corpo text,
  imagem_capa_url text,
  tipo_conteudo tipo_conteudo not null default 'noticia',
  status materia_status not null default 'rascunho',
  seo_title text,
  seo_description text,
  og_image_url text,
  view_count int not null default 0,
  aprovado_por uuid references auth.users(id) on delete set null,
  gerado_em timestamptz not null default now(),
  publicado_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (regiao_id, slug)
);
grant select on public.generated_articles to anon;
grant select, insert, update, delete on public.generated_articles to authenticated;
grant all on public.generated_articles to service_role;
alter table public.generated_articles enable row level security;
create policy "materia public read" on public.generated_articles for select to anon, authenticated
  using (status = 'publicado');
create policy "materia editor read all" on public.generated_articles for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'reviewer'));
create policy "materia editor write" on public.generated_articles for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index materias_regiao_status_idx on public.generated_articles(regiao_id, status, publicado_em desc);
create index materias_categoria_idx on public.generated_articles(categoria_id, status, publicado_em desc);
create trigger trg_materias_updated before update on public.generated_articles for each row execute function public.set_updated_at();

-- =====================================================================
-- 11. Leads WhatsApp (LGPD)
-- =====================================================================
create table public.whatsapp_leads (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  nome text,
  regiao_id uuid references public.regioes(id) on delete set null,
  fonte_captura text,
  consentimento_lgpd boolean not null default false,
  consentimento_timestamp timestamptz,
  canal_ou_lista canal_whatsapp,
  created_at timestamptz not null default now()
);
grant insert on public.whatsapp_leads to anon, authenticated;
grant all on public.whatsapp_leads to service_role;
alter table public.whatsapp_leads enable row level security;
create policy "wa public insert" on public.whatsapp_leads for insert to anon, authenticated
  with check (consentimento_lgpd = true);
create policy "wa admin read" on public.whatsapp_leads for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- =====================================================================
-- 12. Anunciantes e campanhas
-- =====================================================================
create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  regiao_id uuid references public.regioes(id) on delete set null,
  contato text,
  plano text,
  created_at timestamptz not null default now()
);
grant all on public.advertisers to service_role;
grant select on public.advertisers to authenticated;
alter table public.advertisers enable row level security;
create policy "adv admin all" on public.advertisers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete cascade,
  tipo text,
  inicio date,
  fim date,
  valor numeric,
  created_at timestamptz not null default now()
);
grant all on public.campaigns to service_role;
grant select on public.campaigns to authenticated;
alter table public.campaigns enable row level security;
create policy "camp admin all" on public.campaigns for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- 13. Classificados
-- =====================================================================
create table public.classificados (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete restrict,
  categoria classificado_categoria not null,
  titulo text not null,
  descricao text,
  contato text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.classificados to anon, authenticated;
grant insert on public.classificados to anon, authenticated;
grant update, delete on public.classificados to authenticated;
grant all on public.classificados to service_role;
alter table public.classificados enable row level security;
create policy "clf public read" on public.classificados for select to anon, authenticated using (ativo = true);
create policy "clf public insert" on public.classificados for insert to anon, authenticated with check (true);
create policy "clf admin all" on public.classificados for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create trigger trg_classificados_updated before update on public.classificados for each row execute function public.set_updated_at();

-- =====================================================================
-- 14. Analytics events
-- =====================================================================
create table public.analytics_events (
  id bigserial primary key,
  regiao_id uuid references public.regioes(id) on delete set null,
  tipo_evento text not null,
  pagina text,
  origem_trafego text,
  ts timestamptz not null default now()
);
grant insert on public.analytics_events to anon, authenticated;
grant usage, select on sequence public.analytics_events_id_seq to anon, authenticated;
grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;
create policy "analytics public insert" on public.analytics_events for insert to anon, authenticated with check (true);
create policy "analytics admin read" on public.analytics_events for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create index analytics_ts_idx on public.analytics_events(ts desc);

-- =====================================================================
-- 15. Seed: 10 macrorregiões IPARDES + tema_config por região
-- =====================================================================
insert into public.regioes (slug, nome, cidade_principal, descricao, tema_config) values
  ('metropolitana',    'Metropolitana',    'Curitiba',          'Região Metropolitana de Curitiba',
    '{"paleta":{"primaria":"#0A2540","acento":"#0066CC","fundo":"#FFFFFF"},"tipografia_destaque":"Bebas Neue","tipografia_corpo":"Barlow","densidade":"alta","elemento_assinatura":"barra_horizontal_topo"}'::jsonb),
  ('litoral',          'Litoral',          'Paranaguá',         'Litoral do Paraná',
    '{"paleta":{"primaria":"#0E4C5C","acento":"#F4A261","fundo":"#F7FAFC"},"tipografia_destaque":"Playfair Display","tipografia_corpo":"Source Sans 3","densidade":"media","elemento_assinatura":"onda_sob_masthead"}'::jsonb),
  ('campos-gerais',    'Campos Gerais',    'Ponta Grossa',      'Campos Gerais',
    '{"paleta":{"primaria":"#173404","acento":"#BA7517","fundo":"#FAF7F0"},"tipografia_destaque":"Bitter","tipografia_corpo":"IBM Plex Sans","densidade":"compacta","elemento_assinatura":"barra_dupla_sob_masthead"}'::jsonb),
  ('norte-pioneiro',   'Norte Pioneiro',   'Jacarezinho',       'Norte Pioneiro',
    '{"paleta":{"primaria":"#7A2E0E","acento":"#E9B44C","fundo":"#FFF9F0"},"tipografia_destaque":"Merriweather","tipografia_corpo":"Nunito Sans","densidade":"media","elemento_assinatura":"filete_serifado"}'::jsonb),
  ('norte-central',    'Norte',              'Londrina',          'Norte Paranaense',
    '{"paleta":{"primaria":"#1B3A57","acento":"#E63946","fundo":"#F8F9FA"},"tipografia_destaque":"Oswald","tipografia_corpo":"Roboto","densidade":"alta","elemento_assinatura":"barra_horizontal_topo"}'::jsonb),
  ('noroeste',         'Noroeste',           'Umuarama',          'Noroeste do Paraná',
    '{"paleta":{"primaria":"#5B2A86","acento":"#F2C14E","fundo":"#FDFAF6"},"tipografia_destaque":"Poppins","tipografia_corpo":"Inter","densidade":"media","elemento_assinatura":"faixa_gradiente"}'::jsonb),
  ('centro-ocidental', 'Centro Oeste',       'Campo Mourão',      'Centro-Oeste Paranaense',
    '{"paleta":{"primaria":"#264653","acento":"#2A9D8F","fundo":"#F5F7F6"},"tipografia_destaque":"Rubik","tipografia_corpo":"Rubik","densidade":"media","elemento_assinatura":"linha_dupla"}'::jsonb),
  ('oeste',            'Oeste',            'Cascavel',          'Oeste do Paraná',
    '{"paleta":{"primaria":"#4C1D2E","acento":"#D4A017","fundo":"#FFFCF5"},"tipografia_destaque":"Playfair Display","tipografia_corpo":"Lora","densidade":"compacta","elemento_assinatura":"selo_editorial"}'::jsonb),
  ('sudoeste',         'Sudoeste',         'Francisco Beltrão', 'Sudoeste do Paraná',
    '{"paleta":{"primaria":"#0F5132","acento":"#F97316","fundo":"#F7FBF8"},"tipografia_destaque":"Archivo","tipografia_corpo":"Archivo","densidade":"media","elemento_assinatura":"barra_verde"}'::jsonb),
  ('centro-sul',       'Centro-Sul',       'Guarapuava',        'Centro-Sul do Paraná',
    '{"paleta":{"primaria":"#1F3A5F","acento":"#E76F51","fundo":"#F7F7F5"},"tipografia_destaque":"Space Grotesk","tipografia_corpo":"Inter","densidade":"alta","elemento_assinatura":"filete_topo"}'::jsonb)
on conflict (slug) do nothing;

-- =====================================================================
-- 16. Seed: categorias editoriais
-- =====================================================================
insert into public.editorial_categories (slug, nome) values
  ('politica','Política'),
  ('economia','Economia'),
  ('agro','Agronegócio'),
  ('seguranca','Segurança'),
  ('educacao','Educação'),
  ('esportes','Esportes'),
  ('cultura','Cultura'),
  ('saude','Saúde'),
  ('cidades','Cidades'),
  ('meio-ambiente','Meio Ambiente')
on conflict (slug) do nothing;

-- =====================================================================
-- 17. Seed: cotas padrão por região × categoria (piso/teto %)
-- =====================================================================
insert into public.quota_rules (regiao_id, categoria_id, piso_pct, teto_pct)
select r.id, c.id, q.piso, q.teto
from public.regioes r
cross join public.editorial_categories c
join (values
  ('politica',    15, 25),
  ('economia',    10, 20),
  ('agro',        10, 25),
  ('seguranca',    5, 15),
  ('educacao',     5, 15),
  ('esportes',     5, 15),
  ('cultura',      5, 10),
  ('saude',        5, 15),
  ('cidades',     15, 30),
  ('meio-ambiente',5, 10)
) as q(slug, piso, teto) on q.slug = c.slug
on conflict (regiao_id, categoria_id) do nothing;

-- =====================================================================
-- FIM. Após rodar:
--   1. Confirme com um SELECT count(*) from public.regioes; (deve retornar 10)
--   2. O usuário admin do 001_init.sql permanece — não precisa refazer.
-- =====================================================================