-- Editor manual da página /sobre. Singleton (uma linha só).
-- Roda no SQL Editor do Supabase EXTERNO.

create table if not exists public.sobre_config (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  hero_title text,
  intro text,
  quem_somos text,
  missao text,
  metodo_editorial text,
  transparencia_ia text,
  correcoes text,
  email_redacao text,
  email_comercial text,
  founder_name text,
  atualizado_em timestamptz not null default now()
);

create unique index if not exists sobre_config_singleton_uidx
  on public.sobre_config (singleton) where singleton = true;

grant select on public.sobre_config to anon;
grant select, insert, update on public.sobre_config to authenticated;
grant all on public.sobre_config to service_role;

alter table public.sobre_config enable row level security;

drop policy if exists "sobre_config leitura pública" on public.sobre_config;
create policy "sobre_config leitura pública"
  on public.sobre_config for select
  to anon, authenticated
  using (true);

drop policy if exists "sobre_config edição admins" on public.sobre_config;
create policy "sobre_config edição admins"
  on public.sobre_config for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- Seed inicial com o texto atual da página /sobre (ignora se já existe).
insert into public.sobre_config (
  singleton, hero_title, intro, quem_somos, missao, metodo_editorial,
  transparencia_ia, correcoes, email_redacao, email_comercial, founder_name
) values (
  true,
  'Sobre o Vozes Paranaenses',
  'Somos um portal regional que cobre as 10 macrorregiões do Paraná (recorte IPARDES) com foco no impacto local. Cada matéria é organizada por região e por cidade principal, de forma que o leitor encontre primeiro o que acontece perto de casa.',
  'O Vozes Paranaenses foi fundado por **Jefferson Lobo**, responsável editorial pelo projeto. A formalização da empresa (razão social e CNPJ) está em andamento — atualizaremos esta seção assim que estiver concluída.',
  'Ampliar as vozes das regiões paranaenses e garantir que informação de qualidade sobre política, economia, cultura, esporte, segurança e cotidiano chegue a quem mora nas cidades cobertas.',
  'Trabalhamos com o Método **DEL — Denso, Editorial, Local**. A partir da coleta de fontes públicas (portais oficiais, RSS, veículos regionais), aplicamos reescrita editorial com verificação factual pelo padrão jornalístico **5W1H** (o quê, quem, quando, onde, por quê e como). Nenhuma matéria vai ao ar sem passar por editoria humana.',
  'Usamos assistência de inteligência artificial para consolidar informações de múltiplas fontes públicas, extrair 5W1H e sugerir estruturas de matéria. A decisão editorial, titulação e publicação são sempre humanas.',
  'Erros acontecem — e devem ser corrigidos rapidamente. Se você identificou um erro em alguma matéria, envie o link e o que deve ser corrigido para o email da redação. Toda correção material é sinalizada no próprio texto com data.',
  'redacao@vozesparanaenses.com.br',
  'comercial@vozesparanaenses.com.br',
  'Jefferson Lobo'
) on conflict do nothing;