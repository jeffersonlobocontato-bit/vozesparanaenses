## Objetivo

Hoje a foto de capa aceita apenas **crédito** (`imagem_credito`) e o vídeo não tem nenhum campo descritivo. Vamos permitir **legenda + crédito** tanto para foto quanto para vídeo, editáveis na fila editorial e exibidos na matéria pública.

## Migração no Supabase externo

Novo arquivo `supabase-external/044_legendas_creditos.sql`:

- `alter table public.generated_articles add column if not exists imagem_legenda text;`
- `alter table public.generated_articles add column if not exists video_legenda text;`
- `alter table public.generated_articles add column if not exists video_credito text;`

(mantém `imagem_credito` já existente).

## Editor (admin)

- `src/components/admin/ArticleImageEditor.tsx`: adicionar campo **Legenda da foto** (`imagem_legenda`) ao lado do campo de crédito já existente, salvando no mesmo update.
- `src/components/admin/ArticleVideoEditor.tsx`: adicionar dois campos — **Legenda do vídeo** (`video_legenda`) e **Crédito do vídeo** (`video_credito`) — salvos junto com `video_embed_url`. Tratar erro "column does not exist" apontando para migração `044`.
- `src/routes/admin.index.tsx`: incluir os 3 novos campos no `fullSelect`/`midSelect`/`pinBasicSelect`, no tipo local, e propagar via props para os editores.

## Renderização pública

- `src/lib/content.functions.ts`: adicionar `imagem_legenda`, `video_legenda`, `video_credito` ao tipo `ArticleFull`, ao `select` e ao mapeamento (com fallback `null` se a coluna ainda não existir).
- `src/routes/$region.$slug.tsx`:
  - Abaixo da foto de capa, renderizar `<figcaption>` com **legenda** (texto principal) e **crédito** (menor, em itálico) quando existirem.
  - Abaixo do vídeo, renderizar bloco equivalente com `video_legenda` + `video_credito`.
  - Usar `<figure>` semântico para foto e vídeo (bom para SEO/acessibilidade).

## Fora do escopo

- Legenda/crédito em imagens dentro do corpo da matéria (só capa e vídeo principal).
- Alteração no pipeline de scraping para extrair legenda automaticamente (o campo `imagem_credito` já é preenchido pelo scraping; os novos campos ficam manuais no editor).
