# Revisão da estratégia de SEO + GEO

Objetivo duplo:
1. **SEO geo-taxonômico** — cada matéria é indexada e priorizada pelo lugar (cidade, microrregião, macrorregião, estado), casando com o público local que faz a busca.
2. **GEO (Generative Engine Optimization)** — o site é lido, citado e recomendado por motores de resposta de IA (Google AI Overviews, ChatGPT Search, Perplexity, Claude, Gemini, Copilot).

---

## Parte 1 — SEO geo-taxonômico

### 1.1 Hierarquia de URLs geográficas (indexáveis)
Hoje temos `/` → `/{regiao}` → `/{regiao}/{slug}`. Adicionar camada de **cidade** aproveitando `cidade_principal` já existente na tabela `generated_articles`:

- `/{regiao}/cidade/{cidade-slug}` — landing por município com últimas matérias
- `/{regiao}/editoria/{categoria}` (já existe) mantém-se
- Breadcrumb JSON-LD: `Paraná › Oeste › Cascavel › Matéria`

### 1.2 JSON-LD `NewsArticle` enriquecido geograficamente
No `head()` de `/$region/$slug` adicionar:
- `contentLocation`: `{ @type: "City", name, containedInPlace: { Region, State: "Paraná" } }` a partir de `cidade_principal`
- `spatialCoverage`: array de `Place` a partir de `cidades_mencionadas`
- `about` / `mentions`: entidades detectadas (pessoas, órgãos, locais) — extensível
- `dateModified`, `wordCount`, `articleBody`, `inLanguage: "pt-BR"`, `isAccessibleForFree: true`
- `publisher` com `NewsMediaOrganization` + `areaServed` (Paraná)

### 1.3 Meta tags geo específicas
Por matéria e por página de cidade/região:
- `<meta name="geo.region" content="BR-PR">`
- `<meta name="geo.placename" content="{cidade}, Paraná">`
- `<meta name="geo.position" content="{lat};{lng}">` (quando cidade tiver coordenadas)
- `<meta name="ICBM" content="{lat}, {lng}">`
- `<meta name="news_keywords" content="{cidade}, {região}, {categoria}, {tags}">`

### 1.4 Sitemap segmentado + Google News
Substituir o `sitemap.xml` monolítico atual por **índice + shards**:
- `/api/public/sitemap.xml` → `<sitemapindex>`
- `/api/public/sitemap-news.xml` → últimas 48h com namespace `news:` (obrigatório p/ Google News)
- `/api/public/sitemap-regiao-{slug}.xml` por macrorregião
- `/api/public/sitemap-cidades.xml` com todas as landings de cidade

Cada URL de matéria carrega `<news:news>` com `<news:publication_date>`, `<news:title>`, `<news:keywords>` (cidade + categoria).

### 1.5 Landing page por cidade
Nova rota `/$region/cidade/$cidade` com:
- H1 "Notícias de {Cidade}"
- Últimas N matérias com `cidade_principal = cidade`
- JSON-LD `CollectionPage` + `Place`
- Link cruzado no rodapé de cada matéria: "Mais de {Cidade}"

### 1.6 Sinais internos de proximidade
Já existe `listRankedArticles` com score geo. Complementar com:
- Bloco "Nas cidades vizinhas" na página de cidade
- `<link rel="alternate">` entre matéria e sua página-cidade
- Internal linking automático: quando uma cidade é mencionada no corpo, virar link para `/{regiao}/cidade/{cidade}`

---

## Parte 2 — GEO (indexação por motores de IA)

### 2.1 `robots.txt` — liberar explicitamente crawlers de IA
Substituir o `robots.txt` atual por regras nomeadas permitindo **GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Amazonbot, Bytespider, CCBot, Meta-ExternalAgent, DuckAssistBot, cohere-ai, YouBot**. Manter `Disallow: /api/` e `Disallow: /admin/`. Adicionar linha `Sitemap:`.

### 2.2 `/llms.txt` e `/llms-full.txt`
Servir via server route (já existe `public/llms.txt` — vamos torná-lo dinâmico):
- `/llms.txt`: descrição curta do portal, regiões cobertas, links canônicos
- `/llms-full.txt`: índice completo de matérias recentes com título + resumo + URL, otimizado para ingestão por LLM

### 2.3 Estrutura "answer-first" no corpo
Instruir o pipeline `generate-article` a começar toda matéria com:
- **TL;DR** de 2–3 frases (renderizado como `<p class="tldr">` + `speakable-schema`)
- Bloco **5W1H** já extraído em campos separados, renderizado como `<dl>` estruturado
- **FAQ** ao final (3–5 perguntas frequentes) quando aplicável

### 2.4 Schemas extras que motores de IA priorizam
- `FAQPage` embutido na matéria quando houver bloco de perguntas
- `SpeakableSpecification` apontando para TL;DR e H1 (Google Assistant / Nano-banana / AI Overviews)
- `ClaimReview` opcional quando a matéria for verificação de fato
- `BreadcrumbList` com hierarquia geográfica

### 2.5 Autoridade e citabilidade
- Página `/sobre` com `NewsMediaOrganization`, editor responsável, endereço, e-mail de correções, política editorial
- Cada matéria expõe `author` (Redação Vozes Paranaenses ou humano), `dateModified`, e link "Corrigir esta matéria"
- `sameAs` do publisher apontando para perfis oficiais (quando existirem)

### 2.6 Feed RSS + JSON Feed
- `/api/public/rss.xml` (RSS 2.0 com `content:encoded` completo)
- `/api/public/feed.json` (JSON Feed 1.1) — ChatGPT/Perplexity ingerem bem
- Um feed geral + um por macrorregião

### 2.7 Meta e headers pró-IA
- `<meta name="ai-content-declaration" content="human-edited, AI-assisted">` (transparência)
- Header HTTP `X-Robots-Tag: index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` nas rotas públicas
- `<link rel="canonical">` absoluto em toda matéria

---

## Parte 3 — Ordem de execução sugerida

1. **Fundação (rápido, alto impacto)**
   - `robots.txt` com crawlers de IA + `X-Robots-Tag`
   - Sitemap-index + `sitemap-news.xml` com namespace News
   - JSON-LD `NewsArticle` enriquecido (contentLocation, spatialCoverage, dateModified, inLanguage)
   - Meta `geo.*` e `news_keywords` por matéria

2. **Camada de cidade**
   - Nova rota `/$region/cidade/$cidade` + JSON-LD `CollectionPage`
   - Bloco "Mais de {Cidade}" e "Cidades vizinhas"
   - Sitemap `sitemap-cidades.xml`
   - Internal linking automático de menções a cidades

3. **GEO — camada de IA**
   - `/llms.txt` e `/llms-full.txt` dinâmicos
   - Ajustar prompt do `generate-article` para produzir TL;DR + FAQ + 5W1H
   - Schemas `FAQPage`, `SpeakableSpecification`, `BreadcrumbList`
   - Feeds RSS + JSON Feed (geral + por região)

4. **Autoridade editorial**
   - Página `/sobre` com `NewsMediaOrganization` completa
   - Autoria e política de correções nas matérias

---

## Detalhes técnicos (referência)

- **Onde entra o JSON-LD:** `head().scripts` dos arquivos `src/routes/$region.$slug.tsx`, `src/routes/$region.index.tsx`, nova `src/routes/$region.cidade.$cidade.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx` (WebSite + NewsMediaOrganization sitewide).
- **Onde entram as meta geo:** mesmo `head()` das rotas acima, condicional à existência de `cidade_principal`/coordenadas.
- **Sitemap:** dividir `src/routes/api/public/sitemap[.]xml.ts` em índice + shards; adicionar `src/routes/api/public/sitemap-news[.]xml.ts` com namespace `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`.
- **robots.txt:** editar `public/robots.txt` diretamente (arquivo estático).
- **llms.txt dinâmicos:** trocar `public/llms.txt` estático por server routes `src/routes/api/public/llms[.]txt.ts` e `llms-full[.]txt.ts` usando `listLatestArticles` e `listRegions`.
- **Coordenadas de cidade:** requer coluna `lat/lng` em `regioes` ou nova tabela `cidades` (migração externa). Sem coordenadas, `geo.position`/`ICBM` são omitidos e o restante funciona igual.
- **Feeds:** novos server routes `src/routes/api/public/rss[.]xml.ts` e `feed[.]json.ts`.
- **Prompt do gerador:** ajuste em `supabase/functions/generate-article/index.ts` para retornar campos `tldr` + `faq[]` + preservar `5w1h`; migração opcional para persistir esses campos em `generated_articles`.
