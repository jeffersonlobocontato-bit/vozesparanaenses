## Cross-linking automático na página da matéria

Objetivo: quando o leitor abre uma matéria, o corpo e a barra lateral passam a linkar automaticamente para outras páginas internas relevantes — reforçando SEO (profundidade de rastreamento, PageRank interno, âncoras semânticas) e GEO (dá a LLMs mais caminhos para citar o portal).

### O que será implementado

**1. Linkagem automática de menções no corpo da matéria**
- Ao renderizar o `corpo` em `src/routes/$region.$slug.tsx`, detectar menções a:
  - **Cidades** conhecidas (via `cidade_principal` + `cidades_mencionadas` de outras matérias e da tabela `regioes`) → link para `/{regiao}/cidade/{slug}`.
  - **Regiões** (nomes das 10 macrorregiões) → link para `/{regiao}`.
  - **Editorias/categorias** mencionadas → link para `/{regiao}/editoria/{categoria}`.
- Regras: no máximo 1 link por termo por matéria, primeira ocorrência apenas, nunca dentro de heading (`#`, `##`) ou dentro de link já existente. Evita over-linking (penalizado pelo Google).
- Implementado como utilitário puro `src/lib/auto-link.ts` chamado antes do parse Markdown.

**2. Bloco "Leia também" (in-content, meio da matéria)**
- Inserido programaticamente após ~50% do corpo (ou depois do 3º parágrafo).
- 2–3 matérias relacionadas priorizadas por: mesma cidade → mesma região+categoria → mesma categoria.
- Card compacto (título + região + data), com `<a>` real (não JS) para os crawlers seguirem.

**3. Bloco "Mais de {Cidade}" e "Mais de {Região}" no rodapé da matéria**
- Já existe conceito na landing de cidade; trazer para o rodapé da matéria.
- 4 matérias da mesma cidade + 4 da mesma região (excluindo a atual e a de cima).
- Links absolutos, âncora = título completo.

**4. Breadcrumb visível (não só JSON-LD)**
- Renderizar o `BreadcrumbList` que hoje só existe como schema também como UI no topo: Início › Região › Cidade › Matéria.
- Cada nível é `<Link>` real → 3 links internos garantidos por matéria.

**5. Tags/entidades como links**
- Se `cidades_mencionadas` tiver itens, renderizar chips no fim da matéria linkando para cada landing de cidade.
- Categoria vira link para `/{regiao}/editoria/{categoria}`.

**6. `<link rel="alternate">` matéria ↔ página-cidade**
- Adicionar no `head()`: `<link rel="alternate" href="/{regiao}/cidade/{cidade}">` quando houver `cidade_principal`. Sinaliza a relação hierárquica para crawlers.

### Onde entra cada peça

```text
src/lib/auto-link.ts              (novo)  utilitário puro de linkificação
src/lib/content.functions.ts      +listRelatedArticles({articleId, cidade, region, categoria, limit})
src/routes/$region.$slug.tsx      breadcrumb UI, injeção do "Leia também",
                                  rodapé "Mais de Cidade/Região", chips, rel=alternate
```

### Guard-rails de SEO

- Máx. ~1 link a cada 120 palavras no corpo (evita spam).
- Nunca auto-linkar o próprio slug/cidade da matéria atual.
- Slugificação idêntica à já usada em `listAllCityLandings` (acentos removidos).
- Todos os links usam `<Link to>` com `params` tipados (regra TanStack) — nada de `<a href>` interpolado.
- Fallback silencioso: se `listRelatedArticles` falhar, a matéria continua renderizando sem os blocos.

### Fora de escopo (fica para depois)

- Reescrever o pipeline de geração para embutir links já no `corpo` salvo (mantemos runtime).
- Sistema de tags manuais/curadoria editorial de "relacionados".
- Widget "trending" cross-região.

Quer que eu inclua algum item extra (ex.: "matérias da mesma editoria em outras regiões" para fortalecer editorias transversais), ou sigo com esse escopo?
