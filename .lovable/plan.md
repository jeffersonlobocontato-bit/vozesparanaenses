
# Plano — Paraná Total

## Decisões-chave (confirmadas)

- **Banco**: Supabase dedicado (o que você já tem), conectado por URL + chaves salvas como secrets. NÃO usar Lovable Cloud.
- **Renderização**: TanStack Start (SSR) — o template atual — para SEO e AI-search.
- **Server logic do site** (leitura pública das matérias, admin, whatsapp, classificados): **TanStack server functions** rodando no Cloudflare Worker, consultando o Supabase dedicado com a **publishable key** (para leitura pública) e a **service_role key** (só para admin, dentro do handler).
- **Pipeline de conteúdo** (scrape/cluster/extract/generate): **Supabase Edge Functions (Deno)** de verdade, geradas em `supabase/functions/*` e deployadas por você via `supabase functions deploy`. Assim aproveitamos `pg_cron` chamando URL própria do Supabase e mantemos IA/scraping fora do Worker.
- **Escopo**: entrega tudo (fundação + pipeline + WhatsApp + dashboard/classificados) em fases sequenciais dentro deste projeto.

## Fase 0 — Setup (antes de gerar código de UI)

Vou pedir estas secrets em um único formulário quando você aprovar o plano:
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `SCRAPER_API_KEY`, `CRON_SHARED_SECRET` (para `pg_cron` chamar endpoints).

Você também vai colar:
1. A lista das 10 regiões com `tema_config` (paleta, tipografia, densidade, elemento_assinatura).
2. A lista de fontes por região (nome, URL, `tipo_renderizacao`, `protecao_antibot`).
3. Categorias editoriais iniciais e regras de cota por região.

## Fase 1 — Fundação do banco e front público

**SQL (migração única em `supabase/migrations/0001_init.sql`)** — você roda no seu projeto Supabase:
- Extensões: `pgcrypto`, `vector`, `pg_cron`, `http`.
- Todas as tabelas do prompt (regioes, fontes, raw_articles, editorial_categories, quota_rules, article_clusters, cluster_articles, extracted_facts, generated_articles, whatsapp_leads, advertisers, campaigns, classificados, analytics_events).
- Coluna `embedding vector(1536)` em `raw_articles` para o clustering.
- Índices: `raw_articles(hash_conteudo)` único, `generated_articles(status, regiao_id, publicado_em)`, `analytics_events(regiao_id, timestamp)`, IVFFlat em `raw_articles.embedding`.
- **RLS habilitado em todas**. Policies:
  - `regioes`, `editorial_categories`, `generated_articles WHERE status='publicado'`, `classificados WHERE status='ativo'`: `SELECT TO anon`.
  - Todo o resto: sem acesso `anon`; apenas `service_role` (edge functions e server functions admin).
- `GRANT SELECT TO anon` explícito nas tabelas públicas; `GRANT ALL TO service_role` em tudo.
- Seed: as 10 regiões e categorias que você fornecer.

**Rotas TanStack (public)**:
- `src/routes/index.tsx` — home geral (agrega últimas de todas regiões).
- `src/routes/$regiao.tsx` (layout regional) + `.index.tsx` — home da região, aplica `tema_config` via CSS vars.
- `src/routes/$regiao.$categoria.tsx` — listagem por editoria.
- `src/routes/$regiao.$slug.tsx` — matéria (schema.org `NewsArticle`, `head()` com OG completo derivado de `loaderData`, relacionadas).
- `src/routes/$regiao.classificados.tsx` — listagem simples + form de cadastro.
- `src/routes/whatsapp.tsx` — opt-in com consentimento LGPD.

**Server functions** (`src/lib/*.functions.ts`) usando publishable key para leitura pública:
- `listHomeArticles`, `listRegionArticles`, `getArticleBySlug`, `listClassificados`, `createClassificado`, `createWhatsappLead`, `logAnalyticsEvent`.

**Tema por região**: um único componente `RegionThemeProvider` que injeta CSS vars a partir de `tema_config`. Fonts via `@fontsource/*` instalados dinamicamente conforme as tipografias que você definir.

**SEO**: `head()` por rota (título/descrição/OG específicos), `NewsArticle` JSON-LD nas matérias, `sitemap.xml` e `robots.txt` gerados dinamicamente, `llms.txt` em `/public`.

## Fase 2 — Edge Functions Deno (pipeline)

Sob `supabase/functions/`, cada uma com `deno.json` e chamando Claude/ScraperAPI via `fetch`. Todas leem secrets do próprio Supabase (`supabase secrets set ...`) — não do Worker.

- `scrape-source/index.ts` — input `{fonte_id}`; se `protecao_antibot`, ScraperAPI; senão fetch direto. Limpa HTML (Readability equivalente), calcula `sha256` do corpo, upsert em `raw_articles` (ignora duplicata por hash).
- `cluster-articles/index.ts` — gera embedding (Claude/OpenAI-compatível ou `bge-small` via API) para novos `raw_articles`, faz `pg_vector` cosine matching contra clusters ativos das últimas 72h da mesma região; cria cluster novo ou anexa.
- `classify-and-quota/index.ts` — Claude classifica cluster em categoria; aplica `quota_rules` (piso/teto por categoria/região no dia), marca `status='selecionado_cota'` ou `'descartado'`.
- `extract-facts/index.ts` — Claude extrai 5W1H + dados/citações/fontes → `extracted_facts`.
- `generate-article/index.ts` — Claude gera matéria com o prompt "Método DEL" do briefing → `generated_articles` como `rascunho`.
- `whatsapp-capture/index.ts` — opcional; ou fica na server function do Worker (mais simples). Vou pela server function.

**Jobs (`pg_cron`)** criados na migração:
- Um `cron.schedule` por região disparando `net.http_post` para `scrape-source` de cada fonte ativa, com a frequência que você definir por região.
- Um job diário que chama, em ordem, `cluster-articles` → `classify-and-quota` → `extract-facts` → `generate-article` por região.

Deploy: entrego `README-supabase.md` com os comandos (`supabase link`, `supabase db push`, `supabase functions deploy <name>`, `supabase secrets set ...`).

## Fase 3 — Admin (aprovação + dashboard)

- Auth: **Supabase Auth email/password** com uma tabela `user_roles` (`admin`, `editor`) + função `has_role()` SECURITY DEFINER (padrão de roles do sistema — evita escalada).
- Layout autenticado `src/routes/_authenticated/` — o gate managed do template protege tudo.
- `/admin/aprovacao` — lista `generated_articles WHERE status='rascunho'`, mostra fatos ao lado, botões aprovar (grava `aprovado_por`, `publicado_em`, muda status), editar (rich text simples), rejeitar. Server function usa `requireSupabaseAuth` + checagem `has_role('editor'|'admin')`.
- `/admin/dashboard` — agrega `analytics_events` por região (pageviews, funil → whatsapp_leads), receita de `campaigns` por região; gráficos com Recharts.

## Fase 4 — Analytics + monetização + polimento

- Beacon leve em `__root.tsx` que envia `analytics_events` via server function (`tipo_evento`, `pagina`, `origem_trafego` derivado de `document.referrer`/UTM).
- Slots de anúncio nas páginas regionais lendo `campaigns` ativos por região/tipo.
- `llms.txt`, sitemap dinâmico (todas matérias publicadas), OG image derivada da matéria (URL absoluta em `head()`).
- Rodar security scan e SEO scan do Lovable ao final e corrigir o que aparecer.

## Detalhes técnicos importantes

- **Nunca** importar `client.server` (service_role) no topo de um `.functions.ts`; sempre `await import(...)` dentro do handler admin.
- Leitura pública usa **publishable key** em cliente Supabase criado dentro do handler da server function — não a service_role (evita `Expected 3 parts in JWT`).
- `pg_cron` autentica nas Edge Functions passando `Authorization: Bearer <SUPABASE_ANON_KEY>` + header `x-cron-secret: <CRON_SHARED_SECRET>` que cada função valida.
- Consentimento LGPD: `whatsapp_leads.consentimento_lgpd=true` + timestamp gravados **antes** do redirect; texto do opt-in fica visível e versionado no form.
- Nenhum texto bruto de fonte é reproduzido — `generate-article` recebe apenas o JSON de `extracted_facts`.

## O que você precisa fazer depois que eu terminar cada fase

- Fase 1: rodar `supabase db push` no seu projeto; colar seed real de regiões/fontes.
- Fase 2: `supabase functions deploy` de cada função; `supabase secrets set ANTHROPIC_API_KEY=... SCRAPER_API_KEY=... CRON_SHARED_SECRET=...` no seu projeto Supabase.
- Fase 3: criar seu primeiro usuário admin e rodar o INSERT em `user_roles`.

Aprova para eu começar pela Fase 1 (fundação + rotas públicas + seed)?
