-- =====================================================================
-- Vozes Paranaenses — 041_curadoria_seguranca_esportes.sql
-- Transforma o "Diagnóstico do pipeline" em ferramenta de curadoria
-- dedicada a Segurança e Esportes — as 2 editorias que mais puxam
-- tráfego. Paraná já é coberto pelo pipeline normal (fontes regionais
-- que já temos); isto aqui adiciona a camada NACIONAL/INTERNACIONAL,
-- via fontes abertas (sem paywall), rankeada por quantos portais
-- cobriram o mesmo fato — e sempre com escrita SOB DEMANDA (nunca
-- automática), por um botão "Escrever agora" no painel.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.fontes
  add column if not exists curadoria_editoria text check (curadoria_editoria in ('seguranca','esportes'));

comment on column public.fontes.regiao_id is
  'Nulo para fontes de curadoria nacional (curadoria_editoria preenchido) — essas fontes não são de uma região específica do Paraná.';

insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, ativo, curadoria_editoria) values
  ('ge (Globo Esporte)',    'https://ge.globo.com/',                 'veiculo', 'estatico', true, 'esportes'),
  ('Lance!',                'https://www.lance.com.br/',             'veiculo', 'estatico', true, 'esportes'),
  ('ESPN Brasil',           'https://www.espn.com.br/',              'veiculo', 'estatico', true, 'esportes'),
  ('Gazeta Esportiva',      'https://www.gazetaesportiva.com/',      'veiculo', 'estatico', true, 'esportes'),
  ('CNN Brasil Esportes',   'https://www.cnnbrasil.com.br/esportes/','veiculo', 'estatico', true, 'esportes'),
  ('G1',                    'https://g1.globo.com/',                 'veiculo', 'estatico', true, 'seguranca'),
  ('Metrópoles',            'https://www.metropoles.com/',           'veiculo', 'estatico', true, 'seguranca'),
  ('R7',                    'https://www.r7.com/',                   'veiculo', 'estatico', true, 'seguranca'),
  ('CNN Brasil',            'https://www.cnnbrasil.com.br/',         'veiculo', 'estatico', true, 'seguranca')
on conflict (url_base) do nothing;

-- Marca o cluster como "curadoria nacional" — formado sem exigência de
-- detecção de cidade paranaense (ver cluster-articles), nunca entra na
-- seleção automática por cota (ver classify-and-quota, que já ignora
-- clusters com categoria_id preenchido) e nunca escreve sozinho — só
-- quando o admin clicar "Escrever agora" no painel de curadoria.
alter table public.article_clusters
  add column if not exists curadoria_nacional boolean not null default false;

create index if not exists article_clusters_curadoria_idx on public.article_clusters(curadoria_nacional) where curadoria_nacional = true;

-- IMPORTANTE: esta migration depende de "nacional" já existir em
-- public.regioes — se a migration 024_regioes_nacional_internacional.sql
-- ainda não foi rodada, rode ela ANTES desta (o cluster-articles busca
-- essa região pra vincular os clusters de curadoria).
