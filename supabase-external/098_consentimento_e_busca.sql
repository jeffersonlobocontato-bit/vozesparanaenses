-- 098 — Taxa de aceite do banner de cookies (contagem anônima) e busca do site.
--
-- 1. consentimento_contagem: só CONTADORES por dia (banner exibido, aceito,
--    recusado). Nenhum identificador, IP, cookie ou página: não é dado
--    pessoal (LGPD) e por isso pode ser contado mesmo sem o aceite. Serve
--    para saber que fração dos leitores o GA4 enxerga de verdade.
--    Gravação só pela service role (server function do site).
-- 2. buscar_materias(q): busca em título/subtítulo/resumo das matérias
--    publicadas, sem diferenciar acento nem maiúscula (página /busca?q=).

create table if not exists public.consentimento_contagem (
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  evento text not null check (evento in ('exibido', 'aceito', 'recusado')),
  total integer not null default 0,
  primary key (dia, evento)
);
alter table public.consentimento_contagem enable row level security;
drop policy if exists equipe_le on public.consentimento_contagem;
create policy equipe_le on public.consentimento_contagem for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'viewer'));

create or replace function public.registrar_consentimento(p_evento text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.consentimento_contagem (dia, evento, total)
  select (now() at time zone 'America/Sao_Paulo')::date, p_evento, 1
  where p_evento in ('exibido', 'aceito', 'recusado')
  on conflict (dia, evento) do update set total = consentimento_contagem.total + 1
$$;
revoke all on function public.registrar_consentimento(text) from public, anon, authenticated;
grant execute on function public.registrar_consentimento(text) to service_role;

-- Resumo para o painel (equipe, inclusive Consulta).
create or replace function public.consentimento_resumo(p_dias integer default 30)
returns table (dia date, exibido integer, aceito integer, recusado integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'viewer')) then
    raise exception 'acesso negado';
  end if;
  return query
    select c.dia,
      coalesce(sum(c.total) filter (where c.evento = 'exibido'), 0)::int,
      coalesce(sum(c.total) filter (where c.evento = 'aceito'), 0)::int,
      coalesce(sum(c.total) filter (where c.evento = 'recusado'), 0)::int
    from public.consentimento_contagem c
    where c.dia > (now() at time zone 'America/Sao_Paulo')::date - greatest(p_dias, 1)
    group by c.dia
    order by c.dia desc;
end;
$$;
revoke all on function public.consentimento_resumo(integer) from public, anon;
grant execute on function public.consentimento_resumo(integer) to authenticated;

-- 2. Busca ----------------------------------------------------------------
create or replace function public.sem_acento(t text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

create or replace function public.buscar_materias(p_q text, p_limite integer default 30)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with termos as (
    select t from unnest(string_to_array(public.sem_acento(left(trim(p_q), 80)), ' ')) as t
    where length(t) >= 2
  )
  select g.id
  from public.generated_articles g
  where g.status = 'publicado'
    and exists (select 1 from termos)
    and not exists (
      select 1 from termos
      where position(termos.t in public.sem_acento(coalesce(g.titulo, '') || ' ' || coalesce(g.subtitulo, '') || ' ' || coalesce(g.resumo, ''))) = 0
    )
  order by (position((select string_agg(t, ' ') from termos) in public.sem_acento(g.titulo)) > 0) desc,
           g.publicado_em desc nulls last
  limit least(greatest(p_limite, 1), 60)
$$;
revoke all on function public.buscar_materias(text, integer) from public;
grant execute on function public.buscar_materias(text, integer) to anon, authenticated, service_role;
