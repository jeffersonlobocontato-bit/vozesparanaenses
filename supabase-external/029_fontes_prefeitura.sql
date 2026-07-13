-- =====================================================================
-- Vozes Paranaenses — 024_fontes_prefeitura.sql
-- Suporte a fontes do tipo "prefeitura" (assessoria de imprensa oficial),
-- tratadas separadas dos veículos de comunicação — scraping próprio,
-- módulo próprio no painel, e elegibilidade diferente no pipeline (fonte
-- oficial não precisa de cruzamento com outra fonte pra ser relevante).
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

do $$ begin
  create type fonte_tipo as enum ('veiculo', 'prefeitura');
exception when duplicate_object then null; end $$;

alter table public.fontes
  add column if not exists tipo fonte_tipo not null default 'veiculo',
  add column if not exists email_imprensa text;

comment on column public.fontes.email_imprensa is
  'E-mail de contato da assessoria de imprensa — usado para avisar quando uma matéria baseada no release oficial é publicada.';

create index if not exists fontes_tipo_idx on public.fontes (tipo);

alter table public.article_clusters
  add column if not exists fonte_oficial boolean not null default false;

comment on column public.article_clusters.fonte_oficial is
  'true quando o cluster nasceu de uma fonte tipo=prefeitura — elegível sozinho, sem precisar de outra fonte cobrindo o mesmo fato (ver cluster-articles e classify-and-quota).';

do $$ begin
  alter table public.fontes add constraint fontes_url_base_key unique (url_base);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Seed: as 18 prefeituras com confirmação completa (domínio + seção de
-- notícias verificados). O restante entra manualmente pelo painel
-- (/admin/fontes → aba Prefeituras) conforme forem confirmadas.
-- ---------------------------------------------------------------------
insert into public.fontes (regiao_id, nome, url_base, tipo, tipo_renderizacao, ativo)
select r.id, v.nome, v.url_base, 'prefeitura', 'estatico', true
from (values
  ('metropolitana', 'Prefeitura de Curitiba',              'https://comunicacao.curitiba.pr.gov.br/'),
  ('metropolitana', 'Prefeitura de São José dos Pinhais',  'https://www.sjp.pr.gov.br/noticias/'),
  ('metropolitana', 'Prefeitura de Colombo',               'https://prefeitura.colombo.pr.gov.br/'),
  ('norte-central', 'Prefeitura de Londrina',              'https://blog.londrina.pr.gov.br/'),
  ('norte-central', 'Prefeitura de Maringá',               'https://www.maringa.pr.gov.br/'),
  ('norte-central', 'Prefeitura de Apucarana',              'https://www.apucarana.pr.gov.br/site/noticias/'),
  ('oeste',         'Prefeitura de Cascavel',               'https://prefa.cascavel.pr.gov.br/cidadao/noticia'),
  ('oeste',         'Prefeitura de Foz do Iguaçu',          'https://www.foz.pr.gov.br/noticias/'),
  ('oeste',         'Prefeitura de Toledo',                 'https://www.toledo.pr.gov.br/noticias'),
  ('sudoeste',      'Prefeitura de Francisco Beltrão',      'https://franciscobeltrao.pr.gov.br/noticias/'),
  ('sudoeste',      'Prefeitura de Pato Branco',            'https://patobranco.pr.gov.br/'),
  ('campos-gerais', 'Prefeitura de Ponta Grossa',           'https://www.pontagrossa.pr.gov.br/noticias/'),
  ('campos-gerais', 'Prefeitura de Telêmaco Borba',         'https://www.telemacoborba.pr.gov.br/imprensa/noticias.html'),
  ('centro-sul',    'Prefeitura de Guarapuava',             'https://guarapuava.pr.gov.br/noticias/'),
  ('litoral',       'Prefeitura de Guaratuba',              'http://portal.guaratuba.pr.gov.br/lista-noticias'),
  ('litoral',       'Prefeitura de Matinhos',               'https://matinhos.atende.net/cidadao/noticia'),
  ('noroeste',      'Prefeitura de Paranavaí',              'https://www.paranavai.pr.gov.br/'),
  ('noroeste',      'Prefeitura de Cianorte',               'https://www.cianorte.pr.gov.br/site/')
) as v(regiao_slug, nome, url_base)
join public.regioes r on r.slug = v.regiao_slug
on conflict (url_base) do nothing;
