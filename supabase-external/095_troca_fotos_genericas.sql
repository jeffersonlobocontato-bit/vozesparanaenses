-- 095 — Recoloca foto neutra do banco novo nas matérias que ficaram sem capa
-- pela 096 (fotos de frota/fachada reprovadas em 29/10/2026), seguindo as
-- regras de 30/10/2026:
--   * duas matérias de assuntos diferentes nunca com a mesma foto: cada foto
--     vai para UMA matéria só (a mais recente do grupo), e não entra foto que
--     outra matéria publicada nos últimos 7 dias já usa. Quem sobrar fica só
--     com texto;
--   * polícia nunca com imagem de IA: a matéria da PRF que saiu com
--     ilustração de IA perde a imagem e entra na distribuição;
--   * PRF / rodovia federal ganha as fotos da galeria oficial da PRF (prf-*).
--
-- RODAR SÓ DEPOIS de publicar o site com os arquivos novos de
-- public/fotos-genericas/ (confira: /fotos-genericas/prf-1.jpg e
-- /fotos-genericas/pm-2.jpg respondem 200).

-- 1. Tira as capas que ferem as regras novas (ficam elegíveis abaixo).
update generated_articles g
set imagem_capa_url = null, og_image_url = null, imagem_credito = null, imagem_legenda = null,
    foto_origem = 'generica_institucional'
where g.status = 'publicado'
  and g.gerado_em > now() - interval '7 days'
  and (
    -- IA em tema policial
    (g.foto_origem = 'ilustracao_ia'
      and lower(translate(g.titulo || ' ' || coalesce(g.resumo, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) ~ '(polici|\mprf\M|\mpm\M|apreen|pres[oa]\M|prisao|trafic|contrabando|crime|fiscaliza|acidente|colisao)')
    -- foto de arquivo repetida: fica com a matéria mais antiga, as outras saem
    or (g.foto_origem = 'generica_institucional' and exists (
      select 1 from generated_articles o
      where o.id <> g.id and o.status = 'publicado' and o.imagem_capa_url = g.imagem_capa_url
        and o.gerado_em > now() - interval '7 days' and o.gerado_em < g.gerado_em))
  );

-- 2. Distribui as fotos: uma por matéria, sem repetir.
with novas(grupo, ordem, id, credito, legenda) as (values
  ('prf', 0, 'prf-1', 'Foto: André Filgueira/PRF', 'Policial rodoviária federal em fiscalização na rodovia (imagem de arquivo)'),
  ('prf', 1, 'prf-2', 'Foto: André Filgueira/PRF', 'Policial rodoviária federal em fiscalização de veículo (imagem de arquivo)'),
  ('prf', 2, 'prf-3', 'Foto: André Filgueira/PRF', 'Abordagem da PRF em rodovia federal (imagem de arquivo)'),
  ('prf', 3, 'prf-4', 'Foto: André Filgueira/PRF', 'Policial rodoviária federal acompanha o fluxo na rodovia (imagem de arquivo)'),
  ('prf', 4, 'prf-5', 'Foto: PRF', 'Fiscalização de carga pela PRF (imagem de arquivo)'),
  ('prf', 5, 'prf-6', 'Foto: André Filgueira/PRF', 'Policial rodoviário federal orienta o trânsito (imagem de arquivo)'),
  ('prf', 6, 'prf-7', 'Foto: PRF', 'Motopoliciamento da PRF em rodovia federal (imagem de arquivo)'),
  ('pm', 0, 'pm-2', 'Foto: Cb Ismael Ponchio/PMPR', 'Policiais militares em patrulhamento (imagem de arquivo)'),
  ('pm', 1, 'pm-3', 'Foto: PMPR', 'Viatura e motocicleta da Polícia Militar (imagem de arquivo)'),
  ('civil', 0, 'pcpr-1', 'Foto: PCPR', 'Policiais civis em operação (imagem de arquivo)'),
  ('civil', 1, 'pcpr-3', 'Foto: PCPR', 'Viatura do canil da Polícia Civil (imagem de arquivo)'),
  ('civil', 2, 'pcpr-4', 'Foto: PCPR', 'Policiais civis em operação (imagem de arquivo)'),
  ('bombeiros', 0, 'cbm-1', 'Foto: Sesp', 'Viatura do Corpo de Bombeiros (imagem de arquivo)'),
  ('bombeiros', 1, 'cbm-2', 'Foto: Corpo de Bombeiros do Paraná', 'Equipe de resgate do Corpo de Bombeiros (imagem de arquivo)'),
  ('bombeiros', 2, 'cbm-3', 'Foto: Corpo de Bombeiros do Paraná', 'Equipe de resgate do Corpo de Bombeiros (imagem de arquivo)'),
  ('samu', 0, 'samu-1', 'Foto: Sesa', 'Atendimento do Samu (imagem de arquivo)'),
  ('samu', 1, 'samu-2', 'Foto: Sesa', 'Ambulância do Samu (imagem de arquivo)'),
  ('samu', 2, 'samu-3', 'Foto: Secom', 'Ambulância do Samu (imagem de arquivo)'),
  ('penal', 0, 'ppen-1', 'Foto: Paulo Henrique/Sesp', 'Viatura da Polícia Penal (imagem de arquivo)'),
  ('penal', 1, 'ppen-2', 'Foto: Ricardo Almeida/Sesp', 'Policial penal em unidade prisional (imagem de arquivo)'),
  ('penal', 2, 'ppen-3', 'Foto: Polícia Penal do Paraná', 'Treinamento da Polícia Penal (imagem de arquivo)'),
  ('cientifica', 0, 'pci-1', 'Foto: Paulo Henrique/Sesp', 'Laboratório da Polícia Científica (imagem de arquivo)'),
  ('cientifica', 1, 'pci-2', 'Foto: Paulo Henrique/Sesp', 'Análise pericial em laboratório da Polícia Científica (imagem de arquivo)'),
  ('cientifica', 2, 'pci-3', 'Foto: Polícia Científica do Paraná', 'Perícia da Polícia Científica (imagem de arquivo)')
),
-- fotos que outra matéria publicada nos últimos 7 dias já usa
em_uso as (
  select distinct imagem_capa_url as url from generated_articles
  where status = 'publicado' and imagem_capa_url is not null and gerado_em > now() - interval '7 days'
),
livres as (
  select n.*, row_number() over (partition by n.grupo order by n.ordem) - 1 as pos
  from novas n
  where 'https://vozesparanaenses.com.br/fotos-genericas/' || n.id || '.jpg' not in (select url from em_uso)
),
base as (
  select g.id, g.gerado_em, lower(translate(coalesce(g.titulo, '') || ' ' || coalesce(g.resumo, ''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) as t
  from generated_articles g
  where g.foto_origem = 'generica_institucional' and g.imagem_capa_url is null and g.status = 'publicado'
),
alvo as (
  select b.id, b.gerado_em,
    case
      when b.t ~ '(\mprf\M|policia rodoviaria federal|rodovias? federa|\mbr-?[0-9]{3})' then 'prf'
      when b.t ~ '(incendio|pegou fogo|chamas|bombeir|siate|resgat|soterr|desab|afoga)' then 'bombeiros'
      when b.t ~ '(acidente de transito|colisao|colidi|capot|atropel|tomba|motociclista|motoboy)' then 'samu'
      when b.t ~ '(pericia|perito|\miml\M|necropsia|cientifica|corpo (e |foi )?encontrado|ossada|cadaver)' then 'cientifica'
      when b.t ~ '(presidio|penitenciar|cadeia publica|detento|policia penal|depen|rebeliao|sistema prisional)' then 'penal'
      when b.t ~ '(policia federal|\mpf\M|receita federal|gaeco)' then null  -- caso federal: sem foto
      when b.t ~ '(estupr|abuso sexual|infantojuvenil|pedofil|maus-tratos|vulneravel)' then null
      when b.t ~ '(delegacia|delegad|inquerito|policia civil|pcpr|investigac|indiciad|mandado de prisao|golpe|estelionat)' then 'civil'
      else 'pm'
    end as grupo
  from base b
),
fila as (
  -- a matéria mais recente de cada grupo fica com a 1ª foto livre, e assim por diante
  select a.id, a.grupo, row_number() over (partition by a.grupo order by a.gerado_em desc) - 1 as pos
  from alvo a where a.grupo is not null
)
update generated_articles g
set imagem_capa_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || l.id || '.jpg',
    og_image_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || l.id || '.jpg',
    imagem_credito = l.credito,
    imagem_legenda = l.legenda
from fila f join livres l on l.grupo = f.grupo and l.pos = f.pos
where g.id = f.id;
