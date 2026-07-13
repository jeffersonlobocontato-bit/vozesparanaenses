# Redator manual na Fila editorial

Adicionar, no topo de `/admin` (módulo Fila), uma caixa "Redator manual" com:
- Seletor de **agente redator** (carregado de `agentes_redatores` + `editorial_categories`).
- Seletor de **região** (padrão: Estado / Paraná).
- Campo **URL da notícia-fonte**.
- Campo opcional **observações para o redator** (ex.: "focar no impacto em Maringá").
- Botão **Gerar rascunho**.

Ao enviar, o sistema busca o conteúdo da URL, extrai os fatos e gera a matéria usando o agente escolhido — sem depender de scraping agendado, clusters ou pipeline. O rascunho aparece na própria Fila logo abaixo, pronto para editar/publicar como qualquer outra matéria.

## Como funciona por baixo

1. **Nova edge function `manual-article`** (`supabase/functions/manual-article/index.ts`):
   - Recebe `{ url, categoria_id, regiao_id, observacoes? }`.
   - Faz scrape da URL via **Firecrawl** (`FIRECRAWL_API_KEY` já configurado — mesma chamada usada em `scrape-source`), pegando `markdown`, `title`, `ogImage` e `author`.
   - Cria uma linha em `raw_articles` marcada como `origem = 'manual'` e um `article_clusters` de 1 item com `categoria_id` + `regiao_id` escolhidos e status `fatos_extraidos`.
   - Chama a lógica de `extract-facts` e depois `generate-article` reutilizando o pipeline atual (mesmos prompts DEL + 5W1H, mesmo agente por categoria). Se `observacoes` for preenchido, é anexado como bloco `INSTRUÇÕES ADICIONAIS DO EDITOR` ao prompt do redator.
   - Copia a imagem original (og:image) para `imagem_original_url` — o editor decide depois se usa a original ou gera com IA (fluxo já existente).
   - Retorna `{ generated_article_id }`.

2. **UI em `src/routes/admin.index.tsx`**:
   - Componente `ManualWriterBox` acima da lista da fila.
   - `useQuery` carrega agentes ativos agrupados por editoria + lista de regiões.
   - Ao submeter, mostra spinner "Lendo fonte…" → "Extraindo fatos…" → "Redigindo com [Agente]…" e, ao concluir, invalida a query da fila (rascunho aparece automaticamente) e abre o editor da matéria criada.
   - Validação: URL http(s) obrigatória, agente obrigatório.

3. **Segurança / limites**:
   - Rate-limit simples: bloquear a mesma URL em menos de 60s (evita duplo clique).
   - Marcar `raw_articles.origem = 'manual'` para o painel de analytics distinguir matérias manuais das do pipeline.

## Observações
- Reaproveita 100% dos prompts DEL + memória editorial + agentes por categoria já existentes; nenhum novo prompt de IA.
- Não altera o pipeline automático nem o painel de clusters.
- Não requer nova migration (usa tabelas atuais). Se quisermos rastrear "origem manual" formalmente, posso adicionar depois uma coluna `origem text default 'pipeline'` em `raw_articles` — avise se quer já incluir.
