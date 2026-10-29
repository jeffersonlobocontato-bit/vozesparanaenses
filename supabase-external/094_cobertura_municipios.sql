-- 094 — Cobertura por município: Vozes × veículos que acompanhamos.
--
-- Alimenta /admin/cobertura (mapa das 399 cidades, comparativo e prospecção
-- do Portal da Imprensa). Uma linha por município, na janela de p_dias:
--   vozes_materias / vozes_notas: o que o Vozes publicou sobre a cidade
--     (matéria pela cidade_principal; nota da coluna regional pela cidade);
--   conc_*: notícias dos veículos regionais monitorados (fontes tipo
--     'veiculo', sem curadoria nacional) cuja cidade detectada é a cidade —
--     total, quantos veículos distintos, o maior veículo e os 5 maiores;
--   prefeitura_*: situação da prefeitura no robô e o que ela produziu;
--   cliente: status no Portal da Imprensa.
-- Só equipe (admin/editor). Leitura apenas.

create or replace function public.cobertura_municipios(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  desde timestamptz := now() - make_interval(days => greatest(1, least(p_dias, 180)));
  res jsonb;
begin
  if not (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'editor')) then
    raise exception 'acesso negado';
  end if;

  with conc as (
    select r.cidade_detectada_slug slug, f.nome veiculo, count(*) n
    from raw_articles r
    join fontes f on f.id = r.fonte_id
    where f.tipo = 'veiculo' and f.curadoria_editoria is null
      and r.cidade_detectada_slug is not null and r.coletado_em >= desde
    group by 1, 2
  ),
  conc_c as (
    select slug, sum(n)::int total, count(*)::int veiculos, max(n)::int maior,
      (array_agg(veiculo order by n desc))[1] lider,
      jsonb_agg(jsonb_build_object('nome', veiculo, 'n', n) order by n desc) filter (where true) lista
    from conc group by slug
  ),
  mat as (
    select lower(cidade_principal) nome, count(*)::int n
    from generated_articles
    where status = 'publicado' and publicado_em >= desde and cidade_principal is not null
    group by 1
  ),
  nt as (
    select cidade_slug slug, count(*)::int n
    from coluna_cidade_notas
    where status = 'publicado' and coalesce(publicado_em, criado_em) >= desde and cidade_slug is not null
    group by 1
  ),
  pf as (
    select distinct on (cidade_slug) cidade_slug, ativo
    from fontes where tipo = 'prefeitura' and cidade_slug is not null
    order by cidade_slug, ativo desc
  ),
  pn as (
    select f.cidade_slug slug, count(*)::int n
    from raw_articles r join fontes f on f.id = r.fonte_id
    where f.tipo = 'prefeitura' and f.cidade_slug is not null and r.coletado_em >= desde
    group by 1
  ),
  cl as (
    select c2.slug, ci.status from clientes_imprensa ci join cidades c2 on c2.id = ci.cidade_id
  )
  select jsonb_agg(jsonb_build_object(
    'slug', c.slug,
    'nome', c.nome,
    'regiao', rg.slug,
    'regiao_nome', rg.nome,
    'maior', coalesce(c.destaque_home, false),
    'vozes_materias', coalesce(mat.n, 0),
    'vozes_notas', coalesce(nt.n, 0),
    'conc_total', coalesce(cc.total, 0),
    'conc_veiculos', coalesce(cc.veiculos, 0),
    'conc_maior', coalesce(cc.maior, 0),
    'conc_lider', cc.lider,
    'conc_lista', coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(cc.lista) x limit 5) t), '[]'::jsonb),
    'prefeitura', case when pf.cidade_slug is null then 'nao_cadastrada' when pf.ativo then 'monitorada' else 'inativa' end,
    'prefeitura_noticias', coalesce(pn.n, 0),
    'cliente', cl.status
  ) order by c.nome)
  into res
  from cidades c
  join regioes rg on rg.id = c.regiao_id
  left join conc_c cc on cc.slug = c.slug
  left join mat on mat.nome = lower(c.nome)
  left join nt on nt.slug = c.slug
  left join pf on pf.cidade_slug = c.slug
  left join pn on pn.slug = c.slug
  left join cl on cl.slug = c.slug;

  return jsonb_build_object(
    'dias', greatest(1, least(p_dias, 180)),
    'gerado_em', now(),
    'veiculos_monitorados', (select count(*) from fontes where tipo = 'veiculo' and ativo and curadoria_editoria is null),
    'municipios', coalesce(res, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.cobertura_municipios(int) from public, anon;
grant execute on function public.cobertura_municipios(int) to authenticated;
