## Pivô: Paraná Total → Vozes Paranaenses

Rebranding + refazer o schema do Supabase externo com o modelo em português do brief. Frontend passa a ler as tabelas novas e ganha rotas de categoria, classificados e WhatsApp. Pipeline (edge functions) fica preparado como próxima fase.

---

### 1. Novo schema SQL (arquivo `supabase-external/002_vozes.sql`)

Você roda no SQL Editor do seu Supabase externo. Substitui o modelo anterior (drop das tabelas atuais `regions/articles/leads/classifieds/sources` e recria em português). Tabelas:

- `regioes` (com `tema_config jsonb` — paleta/tipografia/densidade por região)
- `fontes` (fontes monitoradas, tipo de renderização, antibot)
- `raw_articles` (coletados, hash único)
- `editorial_categories` + seed (Política, Economia, Agro, Segurança, Educação, Esportes, Cultura, Saúde, Cidades)
- `quota_rules` (piso/teto % por região×categoria)
- `article_clusters` + `cluster_articles` (pauta agrupada por similaridade)
- `extracted_facts` (5W1H)
- `generated_articles` (rascunho/aprovado/rejeitado/publicado, Método DEL)
- `whatsapp_leads` (com consentimento LGPD)
- `advertisers` + `campaigns`
- `classificados` (emprego/imóvel/veículo)
- `analytics_events`

Extensões: `vector`, `pg_cron`, `pg_net` (mantém das anteriores).
RLS: leitura pública só para `regioes` e `generated_articles WHERE status='publicado'`; escrita/admin via `has_role(auth.uid(),'admin')`. `whatsapp_leads`, `raw_articles`, `extracted_facts`, `analytics_events` ficam bloqueados para anon.

Seed das **10 regiões IPARDES** com `tema_config` por região:
Metropolitana, Litoral, Campos Gerais, Norte Pioneiro, Norte Central, Noroeste, **Centro Ocidental**, Oeste, Sudoeste, Centro-Sul.

Seed de `quota_rules` padrão (ex.: Política 15/25, Economia 10/20, Cidades 15/30…).

### 2. Frontend — rebranding + rotas

Renomear "Paraná Total" → **Vozes Paranaenses** em todo lugar (header, footer, meta tags, `__root.tsx`).

Atualizar `src/lib/content.functions.ts` para as novas tabelas:
- `listRegioes()` — lê `regioes` (ordenada), retorna `tema_config` tipado
- `getRegiaoBySlug(slug)`
- `listLatestPublicados(limit)` — de `generated_articles` join `regioes` join `editorial_categories`
- `listPorRegiao(slug, limit)`
- `listPorCategoria(regiaoSlug, categoriaSlug, limit)` — nova
- `getMateria(regiaoSlug, slug)`

Rotas novas em `src/routes/`:
- `/` — home nacional (mantém layout Portal Denso; passa a ler tabelas novas)
- `/$regiao` — home regional (aplica `tema_config` via CSS variables)
- `/$regiao/$categoria` — listagem por editoria (nova)
- `/$regiao/$slug` — matéria com schema.org NewsArticle
- `/$regiao/classificados` — listagem por categoria + form de cadastro
- `/whatsapp` — form de opt-in LGPD
- `/admin/aprovacao` — placeholder autenticado (fica pra próxima fase)
- `/admin/dashboard` — placeholder autenticado

Regra: `/$regiao/$slug` e `/$regiao/$categoria` são caminhos ambíguos — resolvo priorizando categoria (lista fixa vinda do banco) e caindo pra matéria se não bater.

Tema por região: componente `RegionLayout` lê `tema_config` da rota atual e injeta `--color-primary`, `--font-display` etc. via CSS variables no `<div>` raiz. Sem componente por região.

### 3. SEO

- `head()` de cada rota com título/descrição próprios
- `/$regiao/$slug` adiciona `<script type="application/ld+json">` com schema.org `NewsArticle`
- `src/routes/api/public/llms.ts` — endpoint gerando `llms.txt`
- `src/routes/api/public/sitemap.ts` — sitemap dinâmico das matérias publicadas
- `src/routes/api/public/robots.ts` — robots com link pro sitemap

### 4. Edge Functions (fica pra próxima fase — só marco os stubs)

Depois que confirmar que o schema rodou e o front está OK, crio:
`scrape-source`, `cluster-articles`, `classify-and-quota`, `extract-facts`, `generate-article`, `whatsapp-capture` — cada uma como Supabase Edge Function no projeto externo. Prompt de sistema DEL fica embutido em `generate-article`.

---

### O que NÃO vou fazer nesta rodada

- Não implemento o pipeline de scraping/IA ainda (fase seguinte, quando o schema estiver no ar)
- Não construo dashboards admin funcionais (só stubs autenticados)
- Não migro dados das tabelas antigas — você disse que não publicou nada real

### O que você precisa fazer

1. Aprovar este plano
2. Depois que eu gerar o `002_vozes.sql`, rodar no SQL Editor do Supabase externo
3. Me confirmar "rodou" — aí eu troco o frontend pras tabelas novas e verifico o build

Confirma pra eu executar?