# vozesparanaenses

Portal de notícias locais do Paraná com pipeline de conteúdo por IA: raspa fontes, agrupa/deduplica em clusters, e uma LLM escreve os artigos publicáveis, com curadoria humana via painel admin. No mesmo app rodam dois outros produtos monetizáveis: **Publieditorial** (conteúdo patrocinado, com um chat de IA que entrevista o cliente) e **Vitrine Pessoal** (páginas de assessoria/marca pessoal, também via chat de IA). Público: (a) você/colaboradores administrando o pipeline via `/admin.*`, (b) clientes pagantes de imprensa/publieditorial/vitrine, (c) público lendo artigos/colunas/classificados. Parte do ecossistema da Agência Vozes (ver `voz-agencia-premium`). Gerenciado via Lovable.

## ⚠️ Arquitetura: dois bancos Supabase diferentes
- **Projeto principal** (`supabase/`, env `SUPABASE_URL`/`VITE_SUPABASE_*`) — só infraestrutura de auth/e-mail. Poucas migrations.
- **Projeto "externo"** (env `EXTERNAL_SUPABASE_URL`/`EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, schema em `supabase-external/*.sql`, 66 migrations) — **é onde vive o conteúdo de verdade** (artigos, clusters, colunas, anúncios, clientes). Não é aplicado via Supabase CLI — as migrations aí são manuais.
- **Antes de mexer em qualquer feature, confirme se ela fala com o banco principal ou o externo** — misturar os dois é o erro mais fácil de cometer aqui.

## Stack
TanStack Start (React 19, rotas por arquivo em `src/routes/` — **não crie `src/pages/`**, ver `src/routes/README.md`) + Vite + Tailwind v4 + shadcn/ui + TanStack Query + Supabase JS + Bun. IA via Lovable AI Gateway (`LOVABLE_API_KEY`, modelos tipo `google/gemini-2.5-flash-lite`).

## Modelo de dados (banco externo)
- **Pipeline editorial**: `fontes`/`sources` → `raw_articles` (raspado) → `article_clusters` (dedup) → `extracted_facts` → `generated_articles`/`article_versions` (texto final da IA + histórico de edição)
- **Regras**: `quota_rules` (limite de publicação por região×categoria numa janela de 7 dias — `classify-and-quota` aplica isso), `agentes_redatores` (personas de redator IA), `memoria_editorial` (contexto editorial persistente pra IA)
- **Conteúdo extra**: `colunas`/`coluna_edicoes`/`coluna_comentarios` (colunistas + comentários), `classificados`
- **Publicidade**: `advertisers`, `ad_campaigns`, `ad_creatives`, `ad_impressions`/`ad_clicks`, tabelas de catálogo/preço (`catalogo_*`)
- **Produtos de cliente**: `clientes_imprensa`; `publieditorial_briefings`/`publieditorial_chat_messages`; `vitrine_pessoal_pedidos`/`vitrine_pessoal_chat_messages`
- **Segurança**: `user_roles` + `has_role()` (admin/editor/reviewer) gateando RLS em quase toda tabela — teste local precisa de um `user_roles` semeado. `form_rate_limit` guarda só **hash de IP** (nunca IP cru) pra anti-spam — preserve esse hashing ao mexer em formulários públicos (contato, Vitrine, Publieditorial, sales-chat).

## Edge functions (agrupadas por área)
- **Pipeline**: `scrape-source`, `scrape-prefeitura` → `cluster-articles`, `process-pending-clusters` → `classify-and-quota` → `extract-facts` → `generate-article`, `generate-article-image`, `publish-article`, `expire-drafts`
- **Publieditorial**: `generate-publieditorial`, `publieditorial-chat`, `-obter`, `-preencher`, `-transcrever`
- **Imprensa**: `imprensa-criar-cliente`, `imprensa-gerar-rascunho`, `imprensa-publicar`
- **Vitrine Pessoal**: `vitrine-pessoal-chat`, `-criar`, `-obter`, `-publicar`, `-salvar`, `-upload`, `-transcrever`
- **Ops**: `track-pageview`, `sales-chat`

## Rotas públicas relevantes
`$region.tsx` / `$region.$slug.tsx` (artigos por região), `editoria.$categoria`, `coluna.$slug.*`, `vitrine.$token` / `publieditorial.$token` (páginas do cliente), `imprensa.entrar`/`imprensa.painel`, feeds/SEO em `routes/api/public/` (sitemap, rss, llms.txt)

## Cuidados conhecidos
- **Raspagem tem janelas fixas** (7h/12h/15h/19h horário de Brasília) por fonte, com override por fonte (`frequencia_horas`) e dedup por hash de conteúdo. Algumas fontes usam Firecrawl (páginas com JS/anti-bot).
- **Cron do banco externo é manual** — `003_pipeline_cron.sql` precisa ser rodado à mão com URL/key preenchidos. Não assuma que o pipeline roda sozinho sem checar isso.
- **Bug conhecido (ver `.lovable/plan/destravar-o-pipeline-de-portais-2026-08-27.md`)**: o botão "Rodar pipeline" no admin chama as edge functions em sequência sem timeout — uma fonte lenta (ex: Firecrawl travando) trava a UI inteira sem botão de cancelar, e uma falha aborta o lote todo. Verificar se isso já foi corrigido antes de mexer em `admin.painel.tsx`.
