-- =====================================================================
-- Vozes Paranaenses — 086_instagram_robo.sql
--
-- Robô do Instagram (@vozesparanaenses): escolhe as matérias de cada ciclo,
-- gera os cards (assinatura A: chapéu-balão), escreve a legenda e publica
-- pelo Zernio, um post por vez, com intervalo seguro entre eles.
--
--   instagram_config — liga/desliga, conta do Zernio, intervalos, teto do
--                      dia, janela, horário do Giro pelo Paraná.
--   instagram_posts  — a fila: planejado › agendado › publicado (ou vetado,
--                      erro, descartado), com cards, legenda e matérias.
--   bucket instagram — os cards em PNG (públicos: o Zernio baixa por URL).
--   cron             — instagram-selecionar a cada 30 min (7h–21h) e
--                      instagram-publicar a cada 5 min (7h–22h).
--
-- O robô começa DESLIGADO (ativo = false): monta a fila e as prévias no
-- painel /admin/instagram, mas só publica depois que a conta do Zernio for
-- conferida e alguém ligar.
--
-- Os agendamentos reaproveitam endereço, chave e segredo dos jobs que já
-- existem (vozes-cluster-articles): nada para preencher.
-- Roda no Supabase EXTERNO ("Rede de Portais"). Idempotente.
-- =====================================================================

create table if not exists public.instagram_config (
  id int primary key default 1 check (id = 1),
  ativo boolean not null default false,
  zernio_account_id text,
  zernio_username text not null default 'vozesparanaenses',
  intervalo_min int not null default 75 check (intervalo_min >= 30),
  intervalo_alerta_min int not null default 30 check (intervalo_alerta_min >= 15),
  teto_dia int not null default 8 check (teto_dia between 1 and 20),
  janela_inicio int not null default 7 check (janela_inicio between 0 and 23),
  janela_fim int not null default 22 check (janela_fim between 1 and 24),
  giro_hora int not null default 19 check (giro_hora between 0 and 23),
  giro_max int not null default 10 check (giro_max between 3 and 10),
  coluna_auto boolean not null default true,
  politica_auto boolean not null default false,
  atualizado_em timestamptz not null default now()
);
-- Conta @vozesparanaenses no Zernio (conferida em 25/10/2026). O robô
-- confere o usuário antes de cada post: código e nome têm de bater.
insert into public.instagram_config (id, zernio_account_id) values (1, '6ade0b01088cda11c4be1fd4')
on conflict (id) do update set zernio_account_id = coalesce(public.instagram_config.zernio_account_id, excluded.zernio_account_id);

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('foto', 'tipografico', 'alerta', 'giro', 'coluna', 'reels')),
  classe text,
  status text not null default 'agendado'
    check (status in ('planejado', 'agendado', 'publicando', 'publicado', 'erro', 'vetado', 'descartado')),
  artigos uuid[] not null default '{}',
  edicao_id uuid,
  score numeric,
  motivo text,
  card jsonb,
  legenda text not null default '',
  imagens text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  agendado_para timestamptz,
  publicado_em timestamptz,
  zernio_post_id text,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists instagram_posts_status_idx on public.instagram_posts (status, agendado_para);
create index if not exists instagram_posts_artigos_idx on public.instagram_posts using gin (artigos);
create index if not exists instagram_posts_publicado_idx on public.instagram_posts (publicado_em desc);

alter table public.instagram_config enable row level security;
alter table public.instagram_posts enable row level security;

drop policy if exists "instagram config equipe" on public.instagram_config;
create policy "instagram config equipe" on public.instagram_config for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "instagram posts equipe" on public.instagram_posts;
create policy "instagram posts equipe" on public.instagram_posts for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- Página pública /instagram (o "link da bio"): só o que já foi publicado.
drop policy if exists "instagram posts publicados leitura" on public.instagram_posts;
create policy "instagram posts publicados leitura" on public.instagram_posts for select
  using (status = 'publicado');

-- Cards em PNG: leitura pública, escrita só pelo servidor (service role).
insert into storage.buckets (id, name, public)
values ('instagram', 'instagram', true)
on conflict (id) do update set public = true;

-- Custo: cada post gerado conta uma legenda de IA (painel de custos, 084).
do $$ begin
  if to_regclass('public.custos_parametros') is not null then
    insert into public.custos_parametros (chave, valor, descricao, unidade)
    values ('ia_instagram', 0.002, 'Por post do Instagram (legenda e campos do card pela IA)', 'US$')
    on conflict (chave) do nothing;
  end if;
end $$;

-- Agendamentos: mesmo endereço, chave e segredo dos jobs que já existem.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
declare
  base text;
  v_url text;
  v_auth text;
  v_segredo text;
  headers text;
  j record;
begin
  select command into base from cron.job where jobname = 'vozes-cluster-articles';
  if base is null then
    raise exception 'Job vozes-cluster-articles não encontrado: rode antes a grade de horários (076).';
  end if;
  v_url := substring(base from 'url := ''([^'']+)/functions/v1/');
  v_auth := substring(base from '''Authorization'', ''([^'']+)''');
  v_segredo := substring(base from '''x-cron-secret'', ''([^'']+)''');
  headers := case when v_segredo is null
    then format('jsonb_build_object(''Content-Type'',''application/json'',''Authorization'', %L)', v_auth)
    else format('jsonb_build_object(''x-cron-secret'', %L, ''Content-Type'',''application/json'',''Authorization'', %L)', v_segredo, v_auth) end;

  for j in select * from (values
    -- 7h–21h de Brasília = 10h–00h UTC
    ('vozes-instagram-selecionar', '12,42 0,10-23 * * *', 'instagram-selecionar'),
    -- 7h–22h de Brasília = 10h–01h UTC
    ('vozes-instagram-publicar', '*/5 0,1,10-23 * * *', 'instagram-publicar')
  ) as t(nome, quando, funcao) loop
    if exists (select 1 from cron.job where jobname = j.nome) then perform cron.unschedule(j.nome); end if;
    perform cron.schedule(j.nome, j.quando, format(
      'select net.http_post(url := %L, headers := %s, body := ''{}''::jsonb, timeout_milliseconds := 10000);',
      v_url || '/functions/v1/' || j.funcao, headers));
  end loop;
end $$;

-- Conferência
select jobname, schedule, command like '%x-cron-secret%' as com_segredo from cron.job where jobname like 'vozes-instagram-%';
select ativo, zernio_username, intervalo_min, teto_dia from public.instagram_config;
