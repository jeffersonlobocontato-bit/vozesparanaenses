# Método DEL nos agentes redatores — versão ajustada

## Impacto (respondendo sua pergunta anterior)

- **Custo por matéria**: +15% a +25% no `generate-article` (prompt cresce de ~1.500 → ~4.500 tokens de input; output não muda). Camadas vazias não entram no prompt, então enquanto o editor não preencher, o custo fica **igual ao atual**.
- **Automação**: intocada. Scraping → cluster → extract-facts → generate-article → auto-publica (score ≥ 3.5, sem foto real) → cron / painel / fila / pinagem / RSS: tudo igual. Só muda **como o prompt é montado dentro** do `generate-article`.

## O que será implementado

### 1. `supabase-external/026_agentes_del.sql`

Adiciona em `agentes_redatores` 4 colunas JSONB (nullable, default `{}`):

- `dna_sintatico` — arquitetura (padrão de título, ordem dos blocos, tamanho médio, ritmo, uso de listas/intertítulos)
- `dna_semantico` — eixo narrativo, 10 perguntas obrigatórias, ênfases
- `dna_lexical` — palavras preferidas / proibidas, verbos, expressões, tom, formalidade
- `matriz_editorial` — objetivo, público, fontes prioritárias / proibidas, CTA

Cria tabela `memoria_editorial` (singleton) com missão, valores, manual de estilo, glossário, siglas, pessoas, instituições — em JSONB editáveis. Seeded com identidade do Vozes + 14 siglas do PR (Sesa, Seed-PR, IAT, Deral, Ipardes, Copel, Sanepar, DER-PR, Alep, TCE-PR, MP-PR, TJ-PR, UBS, PSS) + regras do Método DEL.

GRANTs + RLS herdando as policies de `025` (admin gerencia, editor lê).

Retrocompatível: `instrucoes_base` e `exemplo_texto` continuam funcionando como override.

### 2. `src/routes/admin.agentes.tsx` — reescrito com abas

Editor de cada editoria ganha 6 abas:
- **Sintático** — campos estruturados (padrão de título, textarea de ordem dos blocos, sliders de tamanho, checkboxes de ritmo)
- **Semântico** — radio de eixo narrativo, textarea das perguntas obrigatórias, chips de ênfases
- **Lexical** — chips editáveis (preferidas / proibidas / verbos / expressões), radio de tom
- **Matriz** — objetivo, público, fontes prioritárias, fontes proibidas, CTA
- **Prompt livre** — o `instrucoes_base` atual (override total quando preenchido)
- **Exemplo** — mantém `exemplo_texto`

Sem drag-and-drop, sem preview de prompt gerado nesta fase (economiza tempo — dá pra adicionar depois).

### 3. `src/routes/admin.memoria-editorial.tsx` — novo

Editor da memória global (missão, valores, manual, glossário, siglas, pessoas, instituições) — cada JSONB vira uma lista editável com botão "+ adicionar".

### 4. `src/routes/admin.tsx`

Adiciona link **"Memória"** na nav do admin (entre "Agentes IA" e "Senha").

### 5. `supabase/functions/generate-article/index.ts`

Substitui a concatenação atual por `buildDelPrompt(agente, memoria)` que serializa em ordem:

```
[Memória Editorial global (missão + siglas + glossário)]
[Matriz Editorial da editoria]
[DNA Sintático]
[DNA Semântico]
[DNA Lexical]
[Prompt livre / instrucoes_base] ← override
[Exemplo de lide]
[BASE_SYSTEM_PROMPT + Prompt Mental (10 perguntas do documento)]
```

Camadas vazias são omitidas — economiza tokens e mantém o comportamento atual quando o editor ainda não preencheu nada.

## Fora de escopo

Cadeia multi-agente (Editor-Chefe → Fact Checker → SEO → Títulos → Revisor). Multiplica custo por ~5x — fica registrado como próximo passo.

## Ação manual sua depois do build

Rodar `supabase-external/026_agentes_del.sql` no SQL editor do backend externo.
