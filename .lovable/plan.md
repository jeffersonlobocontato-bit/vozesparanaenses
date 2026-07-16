## Diagnóstico

O botão "Scrape prefeituras" (e por tabela os cards de Curadoria) diz que terminou, mas grava zero clusters. Causa raiz está em `supabase/functions/cluster-articles/index.ts`:

1. A query busca `raw_articles` com `.limit(limit)` (25) **antes** de aplicar o filtro `fonte_tipo`.
2. O filtro `fonte_tipo === "prefeitura"` é aplicado em memória, **depois** do limite.
3. Como existe um backlog gigante de raws de veículos com `processado=false` (foi resetado nas últimas correções), os 25 mais recentes quase sempre são de veículos → o filtro esvazia o array → retorna `processed:0` → o loop no `admin.painel.tsx` sai no primeiro lote e nenhum cluster é criado.

Efeito colateral igual nos outros 3 módulos:

- **Portais (Paraná)**: funciona por sorte — como não há filtro, drena o backlog. Mas está drenando raws antigas de veículos junto com as recém-coletadas.
- **Curadoria (Segurança/Esporte)** e **Nacional Geral**: ambos chamam `cluster-articles` **sem filtro** e **sem lote** (`{ sync: true }` só). Se o backlog é grande, estoura o timeout do browser (60s) → o log mostra "erro" ou fica pendurado. Mesmo quando conclui, mistura raws de curadoria com o backlog do PR.

## Correções

### 1. `supabase/functions/cluster-articles/index.ts`
Aplicar o filtro `fonte_tipo` **na query SQL**, não em memória:

- Se `body.fonte_tipo === "prefeitura"`: usar `.eq("fontes.tipo", "prefeitura")` via join filtrado ou pré-buscar os `fonte_id` do tipo pedido e usar `.in("fonte_id", ids)`.
- Se `body.fonte_tipo === "veiculo"`: mesma coisa, mas ainda separando `curadoria_editoria IS NULL` vs `NOT NULL` (para os cards de curadoria).
- Aceitar também `apenas_curadoria: boolean` (novo) para os botões de curadoria filtrarem só as fontes de curadoria na SQL.

Remover o `raws.filter(...)` em memória (fica só como defesa).

### 2. `src/routes/admin.painel.tsx` — `runCuradoriaNacional`
Passar a rodar em lotes iguais ao `runPipeline`, com `{ limit: 25, apenas_curadoria: true }`, para não estourar 60s. Sem escrever automaticamente (mantém o comportamento atual: só coleta + classifica).

### 3. `runPipeline` (portais)
Adicionar `fonte_tipo: "veiculo"` + `apenas_curadoria: false` (Paraná) no `cluster-articles` para não misturar backlog de curadoria nesse fluxo.

## Como validar
Depois de aplicar, clicar em "Scrape prefeituras" e observar no log:
- lote 1: `processado=N clusters=M` com N > 0 quando há releases novos;
- ao final, KPI "Pautas novas" e "Selecionadas por cota" sobem;
- em `/admin` aparecem rascunhos das prefeituras.
