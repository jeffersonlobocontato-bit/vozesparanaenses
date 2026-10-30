-- 095 — Recoloca foto neutra do banco novo nas matérias que ficaram sem capa
-- pela 096 (fotos de frota/fachada reprovadas em 29/10/2026).
--
-- RODAR SÓ DEPOIS de publicar o site com os arquivos novos de
-- public/fotos-genericas/ (confira: /fotos-genericas/pm-2.jpg responde 200).
--
-- Alvo: matérias com foto_origem = 'generica_institucional' e sem capa.
-- O grupo sai do título + resumo (mesma lógica de _shared/foto-generica.ts,
-- resumida): bombeiros › Samu (trânsito) › perícia › prisional › Polícia
-- Civil › PM. Rodovia já tinha foto aprovada e não foi apagada. Alterna as
-- fotos do grupo pelo id da matéria.

with novas(grupo, ordem, id, credito, legenda) as (values
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
base as (
  select g.id,
    lower(translate(coalesce(g.titulo, '') || ' ' || coalesce(g.resumo, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) as t
  from generated_articles g
  where g.foto_origem = 'generica_institucional' and g.imagem_capa_url is null
),
alvo as (
  select b.id,
    case
      when b.t ~ '(incendio|pegou fogo|chamas|bombeir|siate|resgat|soterr|desab|afoga)' then 'bombeiros'
      when b.t ~ '(acidente de transito|colisao|colidi|capot|atropel|tomba|motociclista|motoboy)' then 'samu'
      when b.t ~ '(pericia|perito|iml|necropsia|cientifica|corpo (e |foi )?encontrado|ossada|cadaver)' then 'cientifica'
      when b.t ~ '(presidio|penitenciar|cadeia publica|detento|policia penal|depen|rebeliao|sistema prisional)' then 'penal'
      when b.t ~ '(delegacia|delegad|inquerito|policia civil|pcpr|investigac|indiciad|mandado de prisao|golpe|estelionat)' then 'civil'
      else 'pm'
    end as grupo
  from base b
),
escolha as (
  select a.id, a.grupo,
    abs(hashtext(a.id::text)) % (select count(*) from novas n where n.grupo = a.grupo) as ordem
  from alvo a
)
update generated_articles g
set imagem_capa_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || n.id || '.jpg',
    og_image_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || n.id || '.jpg',
    imagem_credito = n.credito,
    imagem_legenda = n.legenda
from escolha e join novas n on n.grupo = e.grupo and n.ordem = e.ordem
where g.id = e.id;
