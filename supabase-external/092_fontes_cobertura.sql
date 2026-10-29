-- 092 — Fontes: mais prefeituras, Norte Central, agro e endereços corrigidos.
--
-- Base: diagnóstico de 28-29/10/2026 (scripts/diag-prefeituras, GitHub
-- Actions, mesmo leitor do robô). Só entra o que o diagnóstico confirmou:
-- lista de notícias com itens datados e notícia recente.
-- Idempotente: não duplica fonte que já existe (mesma cidade ou mesma URL).

-- 1. Prefeituras que não estavam no robô (15 cidades) -------------------------
insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, cidade_slug, regiao_id, abrangencia)
select 'Prefeitura de ' || c.nome, v.url, 'prefeitura', 'estatico', false, true, c.slug, c.regiao_id, 'municipal'
from (values
  ('cambe',                     'https://www.cambe.pr.gov.br/index.php/secretarias/secretarias/comunicacao/'),
  ('catanduvas',                'https://www.catanduvas.pr.gov.br/noticias_site'),
  ('campo-magro',               'https://www.campomagro.pr.gov.br/noticias_site'),
  ('faxinal',                   'https://www.faxinal.pr.gov.br/secretarias/3703'),
  ('marechal-candido-rondon',   'https://marechalcandidorondon.atende.net/cidadao/noticia'),
  ('nova-esperanca',            'https://www.novaesperanca.pr.gov.br/noticias_site'),
  ('rondon',                    'https://www.rondon.pr.gov.br/noticias/'),
  ('sao-manoel-do-parana',      'https://www.saomanoeldoparana.pr.gov.br/noticias/'),
  ('antonio-olinto',            'https://antonioolinto.pr.gov.br/portal/noticias/3'),
  ('santana-do-itarare',        'https://santanadoitarare.pr.gov.br/portal/noticias/'),
  ('senges',                    'https://www.senges.pr.gov.br/portal/noticias/'),
  ('tamboara',                  'https://tamboara.pr.gov.br/category/noticias/'),
  ('umuarama',                  'https://www.umuarama.pr.gov.br/'),
  ('santa-tereza-do-oeste',     'https://www.santatereza.pr.gov.br/noticias'),
  ('santa-terezinha-de-itaipu', 'https://www.stitaipu.pr.gov.br/feed/')
) as v(slug, url)
join public.cidades c on c.slug = v.slug
where not exists (select 1 from public.fontes f where f.tipo = 'prefeitura' and f.cidade_slug = v.slug);

-- 2. Prefeituras com endereço errado (página de UMA matéria, feed vazio) -------
update public.fontes f set url_base = v.url, ativo = true, updated_at = now()
from (values
  ('astorga',       'https://astorga.pr.gov.br/noticias/'),
  ('japira',        'https://www.japira.pr.gov.br/feed/'),
  ('jardim-alegre', 'https://www.jardimalegre.pr.gov.br/todas_noticias'),
  ('grandes-rios',  'https://www.grandesrios.pr.gov.br/todas_noticias'),
  ('guaira',        'https://www.guaira.pr.gov.br/feed/'),
  ('figueira',      'https://www.figueira.pr.gov.br/feed/'),
  ('lupionopolis',  'https://lupionopolis.pr.gov.br/noticias'),
  ('rio-azul',      'https://rioazul.pr.gov.br/noticias/'),
  ('cruzmaltina',   'https://www.cruzmaltina.pr.gov.br/todas-noticias'),
  ('quatro-pontes', 'https://www.quatropontes.pr.gov.br/noticias_site')
) as v(slug, url)
where f.tipo = 'prefeitura' and f.cidade_slug = v.slug;

-- 3. Norte Central ------------------------------------------------------------
-- Os dois portais de Maringá estavam cadastrados como Noroeste.
update public.fontes set regiao_id = (select id from public.regioes where slug = 'norte-central'), cidade_slug = 'maringa', updated_at = now()
where tipo = 'veiculo' and nome in ('O Diário de Maringá', 'O Maringá');

-- G Mais Notícias: o feed é /feed (o /rss cadastrado não respondia).
update public.fontes set url_base = 'https://gmaisnoticias.com/feed', updated_at = now()
where tipo = 'veiculo' and nome = 'G Mais Notícias - Guarapuava';

insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, cidade_slug, regiao_id, abrangencia)
select v.nome, v.url, 'veiculo', 'estatico', false, true, v.cidade, (select id from public.regioes where slug = 'norte-central'), 'regional'
from (values
  ('GMC Online — Maringá',  'https://gmconline.com.br/',      'maringa'),
  ('Maringá Post',          'https://maringapost.com.br/',    'maringa'),
  ('CBN Maringá',           'https://www.cbnmaringa.com.br/', 'maringa'),
  ('Paiquerê — Londrina',   'https://www.paiquere.com.br/',   'londrina'),
  ('TN Online — Apucarana', 'https://tnonline.uol.com.br/',   'apucarana')
) as v(nome, url, cidade)
where not exists (select 1 from public.fontes f where f.url_base = v.url);

-- 4. Agro e Governo do Estado (fonte oficial, abrangência estadual) -----------
-- Entram como fonte oficial (tipo 'prefeitura'): release institucional não é
-- descartado pelo crivo de portal e a foto vem liberada (agência pública). A
-- região sai da cidade citada; sem cidade, fica na Metropolitana só para
-- agrupamento.
insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, cidade_slug, regiao_id, abrangencia)
select v.nome, v.url, 'prefeitura', 'estatico', false, true, null, (select id from public.regioes where slug = 'metropolitana'), 'estadual'
from (values
  ('IDR-Paraná',                            'https://www.idrparana.pr.gov.br/Noticias'),
  ('Adapar — Defesa Agropecuária',          'https://www.adapar.pr.gov.br/Noticias'),
  ('AEN — Agência Estadual de Notícias',    'https://www.parana.pr.gov.br/aen/noticias')
) as v(nome, url)
where not exists (select 1 from public.fontes f where f.url_base = v.url);
