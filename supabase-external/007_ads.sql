-- =====================================================================
-- Vozes Paranaenses — 007_ads.sql
-- Sistema de anúncios: anunciantes, campanhas, criativos, targeting geo
-- (cidade individual / região / estado), caps por localização,
-- impressões e cliques (redirect /r/:id).
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- 1. Anunciantes
create table if not exists public.advertisers (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text,
  email         text,
  telefone      text,
  cidade        text,
  regiao_slug   text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.advertisers to authenticated;
grant all on public.advertisers to service_role;
alter table public.advertisers enable row level security;

drop policy if exists "advertisers editor manage" on public.advertisers;
create policy "advertisers editor manage"
on public.advertisers for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 2. Campanhas (janela + orçamento diário por localização)
create table if not exists public.ad_campaigns (
  id             uuid primary key default gen_random_uuid(),
  advertiser_id  uuid not null references public.advertisers(id) on delete cascade,
  nome           text not null,
  status         text not null default 'rascunho'
                 check (status in ('rascunho','ativa','pausada','encerrada')),
  data_inicio    date not null,
  data_fim       date not null,
  -- editorias-alvo (array de slugs); vazio = todas
  editorias      text[] not null default '{}',
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index if not exists ad_campaigns_status_idx on public.ad_campaigns(status);
create index if not exists ad_campaigns_janela_idx on public.ad_campaigns(data_inicio, data_fim);

grant select, insert, update, delete on public.ad_campaigns to authenticated;
grant all on public.ad_campaigns to service_role;
alter table public.ad_campaigns enable row level security;

drop policy if exists "ad_campaigns editor manage" on public.ad_campaigns;
create policy "ad_campaigns editor manage"
on public.ad_campaigns for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 3. Criativos (imagem + headline + CTA + link destino)
create table if not exists public.ad_creatives (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.ad_campaigns(id) on delete cascade,
  imagem_url     text not null,      -- URL do storage bucket 'ad-creatives'
  imagem_storage_path text,          -- caminho no bucket, para poder apagar
  headline       text not null,
  cta_texto      text not null default 'Saiba mais',
  destino_url    text not null,
  peso           int  not null default 1 check (peso between 1 and 10),
  aprovado       boolean not null default false,
  aprovado_por   uuid,
  aprovado_em    timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists ad_creatives_campaign_idx on public.ad_creatives(campaign_id);
create index if not exists ad_creatives_aprovado_idx on public.ad_creatives(aprovado);

grant select, insert, update, delete on public.ad_creatives to authenticated;
grant all on public.ad_creatives to service_role;
-- leitura pública SÓ dos aprovados vem via view abaixo; RLS bloqueia acesso direto anon
alter table public.ad_creatives enable row level security;

drop policy if exists "ad_creatives editor manage" on public.ad_creatives;
create policy "ad_creatives editor manage"
on public.ad_creatives for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 4. Targeting geográfico (cap por localização individual)
-- Uma linha por (campanha, escopo). Escopo pode ser cidade, regiao ou estado.
create table if not exists public.ad_targets (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.ad_campaigns(id) on delete cascade,
  escopo            text not null check (escopo in ('cidade','regiao','estado')),
  -- para 'cidade': nome (será slugificado); para 'regiao': slug; para 'estado': 'pr'
  valor             text not null,
  regiao_slug       text,                            -- redundante para cidades (facilita queries)
  cap_impressoes_dia int not null default 500 check (cap_impressoes_dia > 0),
  criado_em         timestamptz not null default now(),
  unique (campaign_id, escopo, valor)
);

create index if not exists ad_targets_escopo_valor_idx on public.ad_targets(escopo, valor);
create index if not exists ad_targets_campaign_idx on public.ad_targets(campaign_id);

grant select, insert, update, delete on public.ad_targets to authenticated;
grant all on public.ad_targets to service_role;
alter table public.ad_targets enable row level security;

drop policy if exists "ad_targets editor manage" on public.ad_targets;
create policy "ad_targets editor manage"
on public.ad_targets for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 5. Impressões (append-only). Anon insert liberado pelo ad server.
create table if not exists public.ad_impressions (
  id            bigserial primary key,
  creative_id   uuid not null references public.ad_creatives(id) on delete cascade,
  campaign_id   uuid not null references public.ad_campaigns(id) on delete cascade,
  target_id     uuid references public.ad_targets(id) on delete set null,
  escopo        text not null,       -- 'cidade' | 'regiao' | 'estado'
  valor         text not null,       -- valor do target atendido
  editoria      text,                -- editoria da matéria em que apareceu (se aplicável)
  ip_hash       text,                -- hash truncado, LGPD-friendly
  user_agent    text,
  servido_em    timestamptz not null default now()
);

create index if not exists ad_impressions_dia_idx on public.ad_impressions(target_id, servido_em);
create index if not exists ad_impressions_creative_idx on public.ad_impressions(creative_id, servido_em);

grant select on public.ad_impressions to authenticated;
grant insert on public.ad_impressions to anon, authenticated;
grant usage, select on sequence public.ad_impressions_id_seq to anon, authenticated;
grant all on public.ad_impressions to service_role;
alter table public.ad_impressions enable row level security;

drop policy if exists "ad_impressions anon insert" on public.ad_impressions;
create policy "ad_impressions anon insert"
on public.ad_impressions for insert to anon, authenticated
with check (true);

drop policy if exists "ad_impressions editor read" on public.ad_impressions;
create policy "ad_impressions editor read"
on public.ad_impressions for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 6. Cliques (append-only). Rota /r/:id registra e redireciona.
create table if not exists public.ad_clicks (
  id            bigserial primary key,
  creative_id   uuid not null references public.ad_creatives(id) on delete cascade,
  campaign_id   uuid not null references public.ad_campaigns(id) on delete cascade,
  impression_id bigint references public.ad_impressions(id) on delete set null,
  escopo        text,
  valor         text,
  ip_hash       text,
  user_agent    text,
  referer       text,
  clicado_em    timestamptz not null default now()
);

create index if not exists ad_clicks_creative_idx on public.ad_clicks(creative_id, clicado_em);

grant select on public.ad_clicks to authenticated;
grant insert on public.ad_clicks to anon, authenticated;
grant usage, select on sequence public.ad_clicks_id_seq to anon, authenticated;
grant all on public.ad_clicks to service_role;
alter table public.ad_clicks enable row level security;

drop policy if exists "ad_clicks anon insert" on public.ad_clicks;
create policy "ad_clicks anon insert"
on public.ad_clicks for insert to anon, authenticated
with check (true);

drop policy if exists "ad_clicks editor read" on public.ad_clicks;
create policy "ad_clicks editor read"
on public.ad_clicks for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- 7. View pública somente-leitura dos criativos elegíveis para servir.
-- O ad server anon consome esta view (sem expor toda a tabela).
create or replace view public.ads_eligible as
select
  cr.id            as creative_id,
  cr.campaign_id,
  cr.imagem_url,
  cr.headline,
  cr.cta_texto,
  cr.destino_url,
  cr.peso,
  ca.editorias,
  ca.data_inicio,
  ca.data_fim
from public.ad_creatives cr
join public.ad_campaigns ca on ca.id = cr.campaign_id
where cr.aprovado = true
  and ca.status = 'ativa'
  and current_date between ca.data_inicio and ca.data_fim;

grant select on public.ads_eligible to anon, authenticated;

-- 8. Bucket público para os criativos
insert into storage.buckets (id, name, public)
values ('ad-creatives', 'ad-creatives', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "ad-creatives public read" on storage.objects;
create policy "ad-creatives public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'ad-creatives');

drop policy if exists "ad-creatives editor write" on storage.objects;
create policy "ad-creatives editor write"
on storage.objects for all to authenticated
using (
  bucket_id = 'ad-creatives'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
)
with check (
  bucket_id = 'ad-creatives'
  and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
);

-- 9. Triggers de updated_at
create or replace function public.tg_ads_touch_updated_at()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end;
$$;

drop trigger if exists trg_advertisers_touch on public.advertisers;
create trigger trg_advertisers_touch before update on public.advertisers
for each row execute function public.tg_ads_touch_updated_at();

drop trigger if exists trg_ad_campaigns_touch on public.ad_campaigns;
create trigger trg_ad_campaigns_touch before update on public.ad_campaigns
for each row execute function public.tg_ads_touch_updated_at();

drop trigger if exists trg_ad_creatives_touch on public.ad_creatives;
create trigger trg_ad_creatives_touch before update on public.ad_creatives
for each row execute function public.tg_ads_touch_updated_at();