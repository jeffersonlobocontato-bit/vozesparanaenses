-- =====================================================================
-- Vozes Paranaenses — 014_scraping_priorizado.sql
-- Suporte ao novo modelo de scraping: 4 ciclos fixos por dia, 1 notícia
-- por fonte por ciclo (a mais destacada ainda não vista), detecção de
-- cidade/região por menção no texto, e vínculo entre clusters de
-- regiões diferentes quando é a mesma notícia estadual.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- 1. Tabela de cidades → região (base para detecção de cidade no texto)
create table if not exists public.cidades (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.cidades enable row level security;
drop policy if exists "cidades leitura publica" on public.cidades;
create policy "cidades leitura publica" on public.cidades for select to anon, authenticated using (true);
drop policy if exists "cidades equipe gerencia" on public.cidades;
create policy "cidades equipe gerencia" on public.cidades for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Seed inicial (principais cidades por região — expandir depois com a base
-- completa dos 399 municípios já usada no Malha Logística do Politiza IA).
insert into public.cidades (slug, nome, regiao_id)
select v.slug, v.nome, r.id
from (values
  ('curitiba','Curitiba','metropolitana'), ('sao-jose-dos-pinhais','São José dos Pinhais','metropolitana'),
  ('colombo','Colombo','metropolitana'), ('pinhais','Pinhais','metropolitana'),
  ('araucaria','Araucária','metropolitana'), ('campo-largo','Campo Largo','metropolitana'),
  ('fazenda-rio-grande','Fazenda Rio Grande','metropolitana'), ('piraquara','Piraquara','metropolitana'),
  ('almirante-tamandare','Almirante Tamandaré','metropolitana'),
  ('londrina','Londrina','norte-central'), ('maringa','Maringá','norte-central'),
  ('apucarana','Apucarana','norte-central'), ('arapongas','Arapongas','norte-central'),
  ('cambe','Cambé','norte-central'), ('sarandi','Sarandi','norte-central'), ('rolandia','Rolândia','norte-central'),
  ('cascavel','Cascavel','oeste'), ('foz-do-iguacu','Foz do Iguaçu','oeste'),
  ('toledo','Toledo','oeste'), ('marechal-candido-rondon','Marechal Cândido Rondon','oeste'),
  ('francisco-beltrao','Francisco Beltrão','sudoeste'), ('pato-branco','Pato Branco','sudoeste'),
  ('dois-vizinhos','Dois Vizinhos','sudoeste'),
  ('ponta-grossa','Ponta Grossa','campos-gerais'), ('castro','Castro','campos-gerais'),
  ('telemaco-borba','Telêmaco Borba','campos-gerais'),
  ('cornelio-procopio','Cornélio Procópio','norte-pioneiro'), ('jacarezinho','Jacarezinho','norte-pioneiro'),
  ('santo-antonio-da-platina','Santo Antônio da Platina','norte-pioneiro'),
  ('guarapuava','Guarapuava','centro-sul'), ('pitanga','Pitanga','centro-sul'),
  ('ivaipora','Ivaiporã','centro-sul'), ('uniao-da-vitoria','União da Vitória','centro-sul'),
  ('sao-mateus-do-sul','São Mateus do Sul','centro-sul'),
  ('paranagua','Paranaguá','litoral'), ('matinhos','Matinhos','litoral'),
  ('guaratuba','Guaratuba','litoral'), ('pontal-do-parana','Pontal do Paraná','litoral'),
  ('umuarama','Umuarama','noroeste'), ('paranavai','Paranavaí','noroeste'),
  ('campo-mourao','Campo Mourão','centro-ocidental')
) as v(slug, nome, regiao_slug_tmp)
join public.regioes r on r.slug = v.regiao_slug_tmp
on conflict (slug) do nothing;

-- 2. raw_articles: cidade/região detectadas por menção no texto
alter table public.raw_articles
  add column if not exists cidade_detectada_slug text,
  add column if not exists regiao_detectada_id uuid references public.regioes(id);

-- 3. fontes.frequencia_horas passa a ser exceção, não regra geral.
--    NULL = segue o ciclo fixo padrão (7h, 12h, 15h, 19h, horário de Brasília).
--    Um número = exceção pontual (mantém o comportamento antigo de
--    "a cada N horas desde a última coleta") para uma fonte específica.
alter table public.fontes alter column frequencia_horas drop not null;
alter table public.fontes alter column frequencia_horas drop default;
update public.fontes set frequencia_horas = null;

-- 4. article_clusters: vínculo entre regiões (mesma notícia, cobertura estadual)
alter table public.article_clusters
  add column if not exists grupo_estadual_id uuid,
  add column if not exists embedding_centroide vector(1536);

create index if not exists article_clusters_grupo_estadual_idx on public.article_clusters (grupo_estadual_id);
