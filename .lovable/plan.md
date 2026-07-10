
## Objetivo

Reformular `src/routes/admin.clusters.tsx` para que a página fique organizada em **quadros por faixa de horário de extração (scraping)**, do mais recente para o mais antigo, com ordenação interna por tendência de leitura, separação por editoria e agrupamento por cidade.

## Como a página vai ficar

```text
┌─ Faixa: Noite (18h–24h)  — extração mais recente ───────────┐
│  Editoria: Segurança                                        │
│    Cidade: Cascavel                                         │
│      • Cluster A  (interesse ●●●●)                          │
│      • Cluster B  (interesse ●●●○)                          │
│    Cidade: Toledo                                           │
│      • Cluster C  (interesse ●●●○)                          │
│  Editoria: Cidades                                          │
│    Cidade: Curitiba                                         │
│      • Cluster D                                            │
├─ Faixa: Tarde (12h–18h) ────────────────────────────────────┤
│  ...mesma lógica...                                         │
├─ Faixa: Manhã (06h–12h) ────────────────────────────────────┤
│  ...                                                        │
└─ Faixa: Madrugada (00h–06h) ────────────────────────────────┘
```

Regras de ordenação:

1. **Faixas de horário** aparecem da mais recente (contendo o `criado_em` mais novo) para a mais antiga. Faixas sem clusters ficam ocultas.
2. Dentro de cada faixa, **editorias** aparecem ordenadas pela maior tendência de leitura (soma do `interesse_score` dos clusters daquela editoria naquela faixa).
3. Dentro de cada editoria, **cidades** aparecem ordenadas pela maior tendência de leitura.
4. Dentro de cada cidade, **clusters** aparecem ordenados por `interesse_score` desc (fallback: `prioridade_score`).

## Alterações

Arquivo único: `src/routes/admin.clusters.tsx`.

1. Ampliar o select para trazer `interesse_score`, `cidade:cidades(slug, nome)` (via `raw_articles.cidade_id` se existir; caso a coluna não exista em `raw_articles`, cair para o campo `regiao.nome` como "cidade" derivada — verificar no schema antes de codar).
2. Manter a query atual (status = todos, `.order('criado_em', desc)`, limit 80) — só muda a apresentação.
3. Criar as mesmas 4 faixas usadas em `admin.pauta.tsx` (Madrugada, Manhã, Tarde, Noite) reusando `horaSaoPaulo`/`blocoDoHorario` — extrair para `src/lib/pauta-blocos.ts` para compartilhar entre `admin.clusters.tsx` e `admin.pauta.tsx`.
4. Agrupar em memória: Faixa → Editoria → Cidade → Clusters, aplicando as ordenações acima.
5. Renderizar as seções aninhadas mantendo os cards de cluster atuais (badges de região/categoria, botões "Extrair fatos" / "Gerar matéria", lista de artigos).
6. Cabeçalho de cada faixa mostra rótulo + intervalo + horário do scraping mais recente daquela faixa + contagem de clusters.
7. Preservar filtros/atualização atuais e o comportamento dos botões — nenhuma mudança de backend.

## Fora do escopo

- Alterações em edge functions, migrations ou no Painel de Pauta.
- Mudanças no cálculo de `interesse_score` (segue o que já foi definido em `013_painel_pauta.sql`).
