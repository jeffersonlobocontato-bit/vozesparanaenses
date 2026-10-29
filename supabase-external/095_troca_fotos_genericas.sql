-- 095 — Troca as fotos genéricas antigas pelas do banco novo (29/10/2026).
--
-- O editor reprovou as fotos de arquivo antigas: frota de viaturas
-- enfileirada na frente do Palácio Iguaçu (pm-viatura-1/2/3), fachadas de
-- delegacia com nome de cidade (civil-1/2) e entregas de frota/evento
-- (bombeiros-1, cientifica-1, penal-1). O banco novo (_shared/foto-generica.ts)
-- só tem cena neutra. Esta migração troca a capa, o og:image, o crédito e a
-- legenda das matérias que usam as antigas, alternando entre as fotos novas
-- do mesmo grupo (pelo id da matéria, para não repetir a mesma foto).
-- Os arquivos antigos continuam em public/fotos-genericas/ até esta rodar.

with novas(grupo, ordem, id, credito, legenda) as (values
  ('pm', 0, 'pm-1', 'Foto: Paulo Henrique/Sesp', 'Viaturas da Polícia Militar em patrulhamento (imagem de arquivo)'),
  ('pm', 1, 'pm-2', 'Foto: Cb Ismael Ponchio/PMPR', 'Policiais militares em patrulhamento (imagem de arquivo)'),
  ('pm', 2, 'pm-3', 'Foto: PMPR', 'Viatura e motocicleta da Polícia Militar (imagem de arquivo)'),
  ('pm', 3, 'pm-4', 'Foto: Gabriel Rosa/AEN', 'Viaturas policiais com sinalizador ligado (imagem de arquivo)'),
  ('civil', 0, 'pcpr-1', 'Foto: PCPR', 'Policiais civis em operação (imagem de arquivo)'),
  ('civil', 1, 'pcpr-2', 'Foto: PCPR', 'Viaturas da Polícia Civil em operação (imagem de arquivo)'),
  ('civil', 2, 'pcpr-3', 'Foto: PCPR', 'Viatura do canil da Polícia Civil (imagem de arquivo)'),
  ('bombeiros', 0, 'cbm-1', 'Foto: Sesp', 'Viatura do Corpo de Bombeiros (imagem de arquivo)'),
  ('bombeiros', 1, 'cbm-2', 'Foto: Corpo de Bombeiros do Paraná', 'Equipe de resgate do Corpo de Bombeiros (imagem de arquivo)'),
  ('bombeiros', 2, 'cbm-3', 'Foto: Corpo de Bombeiros do Paraná', 'Equipe de resgate do Corpo de Bombeiros (imagem de arquivo)'),
  ('penal', 0, 'ppen-1', 'Foto: Paulo Henrique/Sesp', 'Viatura da Polícia Penal (imagem de arquivo)'),
  ('penal', 1, 'ppen-2', 'Foto: Ricardo Almeida/Sesp', 'Policial penal em unidade prisional (imagem de arquivo)'),
  ('penal', 2, 'ppen-3', 'Foto: Polícia Penal do Paraná', 'Treinamento da Polícia Penal (imagem de arquivo)'),
  ('cientifica', 0, 'pci-1', 'Foto: Paulo Henrique/Sesp', 'Laboratório da Polícia Científica (imagem de arquivo)'),
  ('cientifica', 1, 'pci-2', 'Foto: Paulo Henrique/Sesp', 'Análise pericial em laboratório da Polícia Científica (imagem de arquivo)'),
  ('cientifica', 2, 'pci-3', 'Foto: Polícia Científica do Paraná', 'Perícia da Polícia Científica (imagem de arquivo)')
),
antigas(antiga, grupo) as (values
  ('pm-viatura-1', 'pm'), ('pm-viatura-2', 'pm'), ('pm-viatura-3', 'pm'),
  ('civil-1', 'civil'), ('civil-2', 'civil'),
  ('bombeiros-1', 'bombeiros'), ('penal-1', 'penal'), ('cientifica-1', 'cientifica')
),
alvo as (
  select g.id, a.grupo,
    abs(hashtext(g.id::text)) % (select count(*) from novas n where n.grupo = a.grupo) as ordem
  from generated_articles g
  join antigas a on g.imagem_capa_url like '%/fotos-genericas/' || a.antiga || '.jpg'
)
update generated_articles g
set imagem_capa_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || n.id || '.jpg',
    og_image_url = 'https://vozesparanaenses.com.br/fotos-genericas/' || n.id || '.jpg',
    imagem_credito = n.credito,
    imagem_legenda = n.legenda
from alvo t join novas n on n.grupo = t.grupo and n.ordem = t.ordem
where g.id = t.id;
