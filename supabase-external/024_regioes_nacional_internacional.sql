-- =====================================================================
-- Vozes Paranaenses — 024_regioes_nacional_internacional.sql
-- Adiciona "Nacional" e "Internacional" também como REGIÕES (taxonomia),
-- para que matérias sem vínculo com o Paraná possam ser corrigidas
-- manualmente no editor (o select de Região no ArticleEditor lê a tabela
-- public.regioes). Também cria cotas mínimas para evitar dominância.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

insert into public.regioes (slug, nome, cidade_principal, descricao, ativa)
values
  ('nacional',      'Nacional',      'Brasil', 'Notícias com escopo nacional (Brasil) sem vínculo direto com o Paraná.', true),
  ('internacional', 'Internacional', 'Mundo',  'Notícias com escopo internacional sem vínculo direto com o Paraná.',     true)
on conflict (slug) do update set
  nome = excluded.nome,
  cidade_principal = excluded.cidade_principal,
  descricao = excluded.descricao,
  ativa = true;

-- Cria linhas de cota para as novas regiões contra todas as categorias já
-- existentes, mantendo teto padrão (100) e piso 0. Sem isso, a rotina de
-- cotas pode reclamar por ausência de regra.
insert into public.quota_rules (regiao_id, categoria_id, piso_pct, teto_pct)
select r.id, c.id, 0, 100
from public.regioes r
cross join public.editorial_categories c
where r.slug in ('nacional','internacional')
on conflict (regiao_id, categoria_id) do nothing;