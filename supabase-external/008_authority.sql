-- Vozes Paranaenses — 008_authority.sql
-- Autoridade / E-E-A-T: editor responsável por matéria + registro de correções.
-- Idempotente.

alter table public.generated_articles
  add column if not exists editor_responsavel text;

comment on column public.generated_articles.editor_responsavel is
  'Nome do jornalista/editor responsável pela revisão final. Emitido como Person no NewsArticle JSON-LD.';

-- Tabela pública de correções (política de correções — sinal de confiabilidade
-- para Google News e motores de IA).
create table if not exists public.correcoes (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid references public.generated_articles(id) on delete cascade,
  materia_slug text,
  descricao text not null,
  contato text,
  status text not null default 'pendente' check (status in ('pendente','em_analise','aplicada','rejeitada')),
  resposta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.correcoes to anon;
grant select, insert, update, delete on public.correcoes to authenticated;
grant all on public.correcoes to service_role;

alter table public.correcoes enable row level security;

drop policy if exists "leitor pode registrar correcao" on public.correcoes;
create policy "leitor pode registrar correcao"
  on public.correcoes for insert
  to anon, authenticated
  with check (char_length(descricao) between 10 and 4000);

drop policy if exists "equipe le e edita correcoes" on public.correcoes;
create policy "equipe le e edita correcoes"
  on public.correcoes for all
  to authenticated
  using (true) with check (true);

create or replace function public.correcoes_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists correcoes_touch_updated_at on public.correcoes;
create trigger correcoes_touch_updated_at
  before update on public.correcoes
  for each row execute function public.correcoes_touch_updated_at();