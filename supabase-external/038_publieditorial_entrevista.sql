-- =====================================================================
-- Vozes Paranaenses — 038_publieditorial_entrevista.sql
-- Recria `publieditorial_briefings` (nunca havia sido aplicada) com
-- CAMPOS ESTRUTURADOS em vez de um texto livre só — cada campo mapeia
-- direto numa etapa do Método DEL (Tese → Contexto → Expansão →
-- Evidências → Impacto → Fechamento), garantindo que o agente receba
-- a entrada já organizada do jeito que foi treinado pra escrever.
--
-- Fluxo: admin cria a "casca" do briefing (campanha + região) → gera um
-- link único → cliente preenche a entrevista estruturada por esse link
-- (sem login) → geração acontece automaticamente ao final.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.publieditorial_briefings (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  regiao_id uuid not null references public.regioes(id),
  categoria_id uuid references public.editorial_categories(id),

  -- Entrevista estruturada — cada campo é uma etapa do Método DEL
  nome_anunciante text,      -- identificação
  o_que_faz text,            -- 1. Tese
  contexto_mercado text,     -- 2. Contexto
  diferenciais text,         -- 3. Expansão
  evidencias text,           -- 4. Evidências (só o que puder comprovar)
  impacto_leitor text,       -- 5. Impacto
  cta_texto text,            -- 6. Fechamento — chamada
  link_destino text,         -- 6. Fechamento — link/contato

  status text not null default 'aguardando_preenchimento' check (status in (
    'aguardando_preenchimento','preenchido','gerado','erro'
  )),
  generated_article_id uuid references public.generated_articles(id),
  erro_detalhe text,
  criado_em timestamptz not null default now(),
  preenchido_em timestamptz,
  criado_por uuid references auth.users(id)
);

create index if not exists publieditorial_briefings_token_idx on public.publieditorial_briefings(token);

-- Sem login pro cliente — controle de acesso vive nas Edge Functions
-- (validam o token), não em RLS de usuário anônimo.
grant select, insert on public.publieditorial_briefings to authenticated;
grant all on public.publieditorial_briefings to service_role;
alter table public.publieditorial_briefings enable row level security;

drop policy if exists "equipe cria e le briefings" on public.publieditorial_briefings;
create policy "equipe cria e le briefings" on public.publieditorial_briefings
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
