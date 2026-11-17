-- Apply to the EXTERNAL content database, never the managed auth/email database.
-- Prices verified 2026-11-17: https://ai.google.dev/gemini-api/docs/pricing
-- https://developers.openai.com/api/docs/pricing
create table public.ia_precos (
  modelo text primary key,
  usd_por_milhao_entrada numeric not null,
  usd_por_milhao_saida numeric not null,
  usd_por_imagem numeric not null default 0,
  atualizado_em timestamptz not null default now(),
  usd_por_milhao_audio numeric,
  usd_por_milhao_cache numeric,
  entrada_longa numeric,
  saida_longa numeric,
  limite_longo int
);
grant select, insert, update, delete on public.ia_precos to authenticated;
grant all on public.ia_precos to service_role;
alter table public.ia_precos enable row level security;
create policy ia_precos_admin on public.ia_precos for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.ia_precos (modelo, usd_por_milhao_entrada, usd_por_milhao_saida, usd_por_imagem, usd_por_milhao_audio, usd_por_milhao_cache, entrada_longa, saida_longa, limite_longo) values
('google/gemini-2.5-flash-lite', 0.10, 0.40, 0, 0.30, 0.01, null, null, null),
('google/gemini-2.5-flash', 0.30, 2.50, 0, 1.00, 0.03, null, null, null),
('google/gemini-2.5-pro', 1.25, 10.00, 0, null, 0.125, 2.50, 15.00, 200000),
('google/gemini-2.5-flash-image', 0.30, 2.50, 0.039, null, null, null, null, null),
('openai/text-embedding-3-small', 0.02, 0, 0, null, null, null, null, null),
('openai/gpt-4o-mini-transcribe', 1.25, 5.00, 0, 3.00, null, null, null, null);

create table public.ia_uso (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  etapa text not null check (etapa in ('embedding_coleta','agrupamento','crivo','fatos','redacao','criticidade','seo','duplicidade','imagem_analise','imagem_geracao','nota_cidade','instagram','coluna','imprensa','chat','outro')),
  funcao text not null,
  modelo text not null,
  tokens_entrada int,
  tokens_saida int,
  imagens int not null default 0,
  custo_usd numeric,
  cluster_id uuid,
  artigo_id uuid,
  sucesso boolean not null,
  erro text,
  duracao_ms int not null
);
grant select on public.ia_uso to authenticated;
grant all on public.ia_uso to service_role;
alter table public.ia_uso enable row level security;
create policy ia_uso_admin_le on public.ia_uso for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create index ia_uso_data_etapa on public.ia_uso (criado_em desc, etapa);
create index ia_uso_cluster on public.ia_uso (cluster_id) where cluster_id is not null;
create index ia_uso_artigo on public.ia_uso (artigo_id) where artigo_id is not null;
comment on column public.ia_uso.custo_usd is 'NULL = uso/preço desconhecido; nunca apresentar como custo zero. Custo calculado na chamada, não recalculado retroativamente.';
comment on column public.ia_uso.erro is 'Somente código seguro de erro; nunca prompt, resposta, token, URL ou mensagem do provedor.';

create view public.ia_custo_diario with (security_invoker = true) as
select (u.criado_em at time zone 'America/Sao_Paulo')::date as dia,
  u.etapa, count(*) as chamadas,
  sum(u.tokens_entrada + u.tokens_saida) as tokens,
  sum(u.custo_usd) as custo_usd,
  sum(u.custo_usd) * (select valor from public.custos_parametros where chave = 'cambio_usd_brl') as custo_brl,
  count(*) filter (where u.custo_usd is null) as chamadas_sem_custo,
  count(*) filter (where not u.sucesso) as falhas
from public.ia_uso u group by 1, 2;
grant select on public.ia_custo_diario to authenticated, service_role;

create view public.ia_custo_por_materia with (security_invoker = true) as
with publicados as (
  select (publicado_em at time zone 'America/Sao_Paulo')::date dia, count(*) materias_publicadas
  from public.generated_articles where status = 'publicado' and publicado_em is not null group by 1
), custos as (
  select dia, etapa, sum(custo_usd) custo_usd, sum(custo_brl) custo_brl, sum(chamadas_sem_custo) chamadas_sem_custo
  from public.ia_custo_diario group by dia, grouping sets ((etapa), ())
)
select c.dia, coalesce(c.etapa, 'total') etapa, coalesce(p.materias_publicadas, 0) materias_publicadas,
  c.custo_usd, c.custo_brl,
  c.custo_usd / nullif(p.materias_publicadas, 0) custo_por_materia_usd,
  c.custo_brl / nullif(p.materias_publicadas, 0) custo_por_materia_brl,
  c.chamadas_sem_custo
from custos c left join publicados p using (dia)
where public.has_role(auth.uid(), 'admin') or auth.role() = 'service_role';
grant select on public.ia_custo_por_materia to authenticated, service_role;

-- Exact date boundaries and denominators computed in PostgreSQL, not from paginated rows.
create function public.ia_custos_resumo() returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date; resultado jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select jsonb_object_agg(nome, dados) into resultado from (
    select p.nome, jsonb_build_object(
      'inicio', p.inicio, 'fim', p.fim,
      'materias_publicadas', (select count(*) from public.generated_articles a where a.status = 'publicado' and a.publicado_em >= p.inicio::timestamp at time zone 'America/Sao_Paulo' and a.publicado_em < p.fim::timestamp at time zone 'America/Sao_Paulo'),
      'etapas', coalesce((select jsonb_agg(to_jsonb(e)) from (
        select etapa, sum(chamadas) chamadas, sum(tokens) tokens, sum(custo_usd) custo_usd,
          sum(custo_brl) custo_brl, sum(chamadas_sem_custo) chamadas_sem_custo, sum(falhas) falhas
        from public.ia_custo_diario where dia >= p.inicio and dia < p.fim group by etapa
      ) e), '[]'::jsonb)
    ) dados from (values ('ontem', hoje - 1, hoje), ('sete_dias', hoje - 7, hoje)) p(nome, inicio, fim)
  ) periodos;
  return resultado;
end $$;
revoke all on function public.ia_custos_resumo() from public, anon;
grant execute on function public.ia_custos_resumo() to authenticated;