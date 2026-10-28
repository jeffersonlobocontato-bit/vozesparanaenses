-- 091 — Logomarca / nome da prefeitura nunca é capa: a matéria sai só com texto.
--
-- Em 28/10/2026 a matéria "Inscrições para a 12ª edição dos Jogos dos
-- Idosos…" saiu com o logo da Prefeitura de Toledo como capa — o site da
-- prefeitura usa o logo como og:image quando a notícia não tem foto. Outras
-- 6 de Toledo e 1 de Palmeira (logo horizontal) estavam assim.
--
-- Daqui para a frente o pipeline barra isso (ehLogomarcaPorUrl em
-- _shared/coleta.ts, imagem repetida da prefeitura e IA de visão
-- `ehLogomarca` em generate-article). Esta migração limpa o que já saiu.
-- Como a capa é copiada para o storage (original.png), o filtro olha a
-- imagem da notícia de origem (raw_articles.imagem_original_url).

with alvo as (
  select distinct g.id
  from generated_articles g
  join cluster_articles ca on ca.cluster_id = g.cluster_id
  join raw_articles r on r.id = ca.raw_article_id
  join fontes f on f.id = r.fonte_id
  where g.foto_origem = 'fonte_autorizada'
    and g.imagem_capa_url is not null
    and f.tipo = 'prefeitura'
    and lower(regexp_replace(regexp_replace(r.imagem_original_url, '[?#].*$', ''), '^.*/', ''))
        ~ '(logo|logotipo|logomarca|prefeitura[-_ ]?municipal|municipio[-_ ]de|_h_(preto|branco|cor)|^pref-[a-z]+horizontal)'
)
update generated_articles g set
  imagem_capa_url = null,
  og_image_url = null,
  imagem_original_url = null,
  imagem_credito = null,
  imagem_legenda = null,
  foto_origem = 'nenhuma'
from alvo where alvo.id = g.id;
