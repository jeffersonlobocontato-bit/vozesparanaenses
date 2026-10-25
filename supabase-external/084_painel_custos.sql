-- 084 — Painel de custos (/admin/custos).
--
-- Custo VARIÁVEL (IA) é estimado pelo que o pipeline fez em cada período
-- (coletas, crivo, fichas de fatos, matérias, imagens…) × custo unitário em
-- custos_parametros — editável no painel para calibrar com a fatura real.
-- Custo FIXO vem das assinaturas cadastradas, rateado por dia.
-- A tabela assinaturas também alimenta os alertas de saldo e vencimento.

create table if not exists public.custos_parametros (
  chave text primary key,
  valor numeric not null,
  descricao text not null,
  unidade text not null default 'US$',
  atualizado_em timestamptz not null default now()
);

insert into public.custos_parametros (chave, valor, descricao, unidade) values
  ('cambio_usd_brl', 5.50, 'Câmbio US$ → R$', 'R$'),
  ('ia_coleta',      0.00002, 'Por notícia coletada (embedding)', 'US$'),
  ('ia_crivo',       0.0015,  'Por agrupamento avaliado no crivo', 'US$'),
  ('ia_fatos',       0.0032,  'Por ficha de fatos extraída', 'US$'),
  ('ia_materia',     0.0105,  'Por matéria redigida (redação, criticidade, SEO, duplicidade)', 'US$'),
  ('ia_imagem',      0.04,    'Por imagem gerada por IA', 'US$'),
  ('ia_nota',        0.003,   'Por nota de coluna das cidades', 'US$'),
  ('ia_imprensa',    0.008,   'Por rascunho do Portal da Imprensa', 'US$'),
  ('ia_coluna',      0.06,    'Por edição da Vozes Políticas escrita pela IA (modelo pro, com leitura dos links)', 'US$'),
  ('ia_instagram',   0.002,   'Por post do Instagram (legenda e campos do card pela IA)', 'US$')
on conflict (chave) do nothing;

-- Escritas da coluna Vozes Políticas pela IA (função coluna-escrever, 085).
create table if not exists public.coluna_escritas_ia (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid references public.colunas(id) on delete cascade,
  pautas int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.coluna_escritas_ia enable row level security;

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fornecedor text,
  finalidade text,
  valor numeric not null default 0,
  moeda text not null default 'USD' check (moeda in ('USD', 'BRL')),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'anual', 'uso')),
  inicio date not null default '2026-07-09',
  vencimento date,
  saldo numeric,
  saldo_unidade text,
  saldo_alerta numeric,
  link text,
  observacao text,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into public.assinaturas (nome, fornecedor, finalidade, valor, moeda, periodicidade, saldo_unidade, saldo_alerta, link, observacao)
select * from (values
  ('Lovable (assinatura)', 'Lovable', 'Editar e publicar o site', 25, 'USD', 'mensal', null, null, 'https://lovable.dev/settings', 'Confira o plano e a data de renovação'),
  ('Lovable AI (créditos de IA)', 'Lovable', 'Redação, crivo, fatos, imagens, chats', 0, 'USD', 'uso', 'US$', 20, 'https://lovable.dev/settings', 'Sem saldo o pipeline para de redigir. Custo entra pelo cálculo de IA'),
  ('Lovable Cloud', 'Lovable', 'Hospedagem e funções do servidor', 0, 'USD', 'uso', 'US$', 5, 'https://lovable.dev/settings', 'Franquia mensal incluída; acima dela, por uso'),
  ('Supabase Pro (Rede de Portais)', 'Supabase', 'Banco, imagens, login, cron', 25, 'USD', 'mensal', null, null, 'https://supabase.com/dashboard/org/kaautefkgawyqfcjcyxj/billing', 'Acompanhe Usage (tráfego de imagens: 250 GB/mês incluídos)'),
  ('Firecrawl Hobby', 'Firecrawl', 'Coleta dos 27 portais com proteção anti-robô', 16, 'USD', 'mensal', 'créditos', 800, 'https://www.firecrawl.dev/app', '5.000 créditos/mês; acima de ~4.000/mês, subir para Standard'),
  ('Domínio vozesparanaenses.com.br', 'Registro.br', 'Endereço do site', 40, 'BRL', 'anual', null, null, 'https://registro.br/painel/', 'Vencimento do domínio derruba o site')
) as v(nome, fornecedor, finalidade, valor, moeda, periodicidade, saldo_unidade, saldo_alerta, link, observacao)
where not exists (select 1 from public.assinaturas);

alter table public.custos_parametros enable row level security;
alter table public.assinaturas enable row level security;

drop policy if exists "equipe gerencia custos_parametros" on public.custos_parametros;
create policy "equipe gerencia custos_parametros" on public.custos_parametros
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "equipe le custos_parametros" on public.custos_parametros;
create policy "equipe le custos_parametros" on public.custos_parametros
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "admin gerencia assinaturas" on public.assinaturas;
create policy "admin gerencia assinaturas" on public.assinaturas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "equipe le assinaturas" on public.assinaturas;
create policy "equipe le assinaturas" on public.assinaturas
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

grant select, insert, update, delete on public.custos_parametros, public.assinaturas to authenticated;
grant all on public.custos_parametros, public.assinaturas to service_role;

-- Custo de um período [p_inicio, p_fim): itens variáveis + fixo rateado.
create or replace function public.custos_periodo(p_inicio timestamptz, p_fim timestamptz)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  par jsonb;
  cambio numeric;
  q jsonb;
  itens jsonb;
  var_usd numeric := 0;
  fixo_usd numeric := 0;
  k text;
  dias numeric;
begin
  select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) into par from public.custos_parametros;
  cambio := coalesce((par->>'cambio_usd_brl')::numeric, 5.5);

  q := jsonb_build_object(
    'ia_coleta',   (select count(*) from public.raw_articles where coletado_em >= p_inicio and coletado_em < p_fim),
    'ia_crivo',    (select count(*) from public.article_clusters where criado_em >= p_inicio and criado_em < p_fim),
    'ia_fatos',    (select count(*) from public.extracted_facts where criado_em >= p_inicio and criado_em < p_fim),
    'ia_materia',  (select count(*) from public.generated_articles where gerado_em >= p_inicio and gerado_em < p_fim),
    'ia_imagem',   (select count(*) from public.generated_articles where gerado_em >= p_inicio and gerado_em < p_fim and imagem_credito ilike '%gerada por IA%'),
    'ia_nota',     (select count(*) from public.coluna_cidade_notas where criado_em >= p_inicio and criado_em < p_fim),
    'ia_imprensa', (select count(*) from public.imprensa_submissoes where criado_em >= p_inicio and criado_em < p_fim),
    'ia_coluna',   (select count(*) from public.coluna_escritas_ia where criado_em >= p_inicio and criado_em < p_fim),
    -- Robô do Instagram (086): só os posts que ele mesmo gerou (os manuais não passam pela IA).
    'ia_instagram', case when to_regclass('public.instagram_posts') is null then 0 else
      (select count(*) from public.instagram_posts where criado_em >= p_inicio and criado_em < p_fim and coalesce(motivo, '') not like 'primeiro ciclo%') end
  );

  itens := '[]'::jsonb;
  for k in select jsonb_object_keys(q) loop
    var_usd := var_usd + (q->>k)::numeric * coalesce((par->>k)::numeric, 0);
    itens := itens || jsonb_build_object(
      'chave', k,
      'descricao', (select descricao from public.custos_parametros where chave = k),
      'quantidade', (q->>k)::numeric,
      'usd', round((q->>k)::numeric * coalesce((par->>k)::numeric, 0), 4)
    );
  end loop;

  -- Fixo: cada assinatura mensal/anual rateada pelos dias do período em que estava ativa.
  select coalesce(sum(
    (case when a.moeda = 'BRL' then a.valor / cambio else a.valor end)
    / (case a.periodicidade when 'anual' then 365.0 else 30.0 end)
    * greatest(0, extract(epoch from (p_fim - greatest(p_inicio, a.inicio::timestamptz))) / 86400.0)
  ), 0) into fixo_usd
  from public.assinaturas a
  where a.ativo and a.periodicidade in ('mensal', 'anual');

  dias := extract(epoch from (p_fim - p_inicio)) / 86400.0;
  return jsonb_build_object(
    'variavel_usd', round(var_usd, 2),
    'fixo_usd', round(fixo_usd, 2),
    'total_usd', round(var_usd + fixo_usd, 2),
    'total_brl', round((var_usd + fixo_usd) * cambio, 2),
    'cambio', cambio,
    'dias', round(dias, 2),
    'itens', itens
  );
end $$;

-- Resumo do painel: hoje, mês corrente, total desde o início e os últimos 30 dias.
create or replace function public.custos_resumo()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  agora timestamptz := now();
  hoje timestamptz := date_trunc('day', agora at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  mes timestamptz := date_trunc('month', agora at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  inicio timestamptz;
  serie jsonb;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')) then
    raise exception 'sem_permissao';
  end if;
  select least(
    coalesce((select min(coletado_em) from public.raw_articles), agora),
    coalesce((select min(inicio)::timestamptz from public.assinaturas where ativo), agora)
  ) into inicio;

  select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'total_brl', (public.custos_periodo(d, d + interval '1 day')->>'total_brl')::numeric) order by d), '[]'::jsonb)
  into serie
  from generate_series(hoje - interval '29 days', hoje, interval '1 day') as d;

  return jsonb_build_object(
    'hoje', public.custos_periodo(hoje, agora) || jsonb_build_object('fixo_dia_usd', (public.custos_periodo(hoje, hoje + interval '1 day')->>'fixo_usd')::numeric),
    'mes', public.custos_periodo(mes, agora),
    'total', public.custos_periodo(inicio, agora),
    'inicio', inicio,
    'dias_no_mes', extract(day from (mes + interval '1 month' - interval '1 day')),
    'dia_do_mes', extract(day from agora at time zone 'America/Sao_Paulo'),
    'serie_30d', serie
  );
end $$;

revoke all on function public.custos_periodo(timestamptz, timestamptz) from public, anon;
revoke all on function public.custos_resumo() from public, anon;
grant execute on function public.custos_resumo() to authenticated;
