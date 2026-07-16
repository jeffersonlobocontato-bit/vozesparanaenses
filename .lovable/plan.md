## Diagnóstico

Rodei os endpoints direto para isolar o culpado:

- `cluster-articles` com `{limit:5, fonte_tipo:"veiculo"}` → **OK** (processou 5, criou 5 clusters).
- `classify-and-quota` com `{sync:true}` → **502 Bad Gateway** (gateway derruba a conexão antes de terminar).

É esse 502 que quebra o pipeline dos portais. Como no último ajuste eu passei o `sync:true` obrigatório no `classify-and-quota` (pra esperar a classificação antes de chamar o writer), agora o pipeline sempre aborta no passo 3/4 com erro de gateway → o passo 4/4 (`process-pending-clusters`) nem roda → nenhuma matéria é escrita.

A causa raiz é `classify-and-quota` pegar `.limit(50)` num único lote e fazer, para cada cluster: 1 chamada de LLM + várias leituras/escritas no banco + lookup de grupo estadual. Sequencial, isso passa dos ~60 s do gateway. Não dá pra segurar 50 sync numa chamada só.

## Correção

### 1. `supabase/functions/classify-and-quota/index.ts`
- Aceitar `limit` no body (default 15, teto 50) e substituir o `.limit(50)` hardcoded por esse valor.
- Sem outras mudanças de lógica — a função continua idempotente (`.is("categoria_id", null)`), então dá pra chamar em loop sem duplicar.

### 2. `src/routes/admin.painel.tsx`
Trocar cada chamada de `classify-and-quota` de "1 shot sync" para "loop de lotes até drenar", igualzinho ao que já fazemos com `cluster-articles`:

```ts
setPipelineLog((l) => [...l, "3/4 Classificação + cotas (em lotes)…"]);
for (let i = 1; i <= 20; i++) {
  const r = await supabase.functions.invoke("classify-and-quota", { body: { sync: true, limit: 15 } });
  if (r.error) throw r.error;
  const d = (r.data ?? {}) as { classified?: number; selected?: number };
  setPipelineLog((l) => [...l, `  lote ${i}: classificados=${d.classified ?? 0} selecionados=${d.selected ?? 0}`]);
  if (!d.classified) break;
}
```

Aplicar a mesma coisa nas 3 funções que chamam `classify-and-quota`: `runPipeline` (Portais), `runPrefeituras` e `runCuradoriaNacional`.

### 3. Reduzir lote do `process-pending-clusters` (defensivo)
`process-pending-clusters` com `limit:15, sync:true` também faz LLM por cluster (extract-facts + generate-article) e pode encostar no timeout. Baixar para `limit:8` em `runPipeline` e `runPrefeituras`. Sem mudança no edge function.

## Como validar
Clicar em **Rodar portais** e no log deve aparecer:
- `3/4 Classificação + cotas (em lotes)… lote 1: classificados=15 selecionados=N` (sem 502)
- `4/4 Extrair fatos + escrever… lote 1: pendentes=8 escritas=8`
- KPI "Rascunhos" sobe e `/admin` mostra as pautas novas.
