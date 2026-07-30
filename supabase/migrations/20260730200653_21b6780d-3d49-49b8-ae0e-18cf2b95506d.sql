create table if not exists public.form_rate_limit (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  endpoint text not null,
  criado_em timestamptz not null default now()
);
create index if not exists form_rate_limit_lookup_idx on public.form_rate_limit(endpoint, ip_hash, criado_em);
create index if not exists form_rate_limit_criado_em_idx on public.form_rate_limit(criado_em);
grant all on public.form_rate_limit to service_role;
alter table public.form_rate_limit enable row level security;