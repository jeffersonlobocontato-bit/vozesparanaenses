# Destravar o pipeline de portais

## O problema

No painel, "Rodar pipeline (portais)" chama as funções do servidor em sequência, uma etapa esperando a outra. Nenhuma dessas chamadas tem tempo limite no navegador: se uma função demora (é o que os registros recentes mostram — o Firecrawl devolvendo tempo esgotado e erro de todos os motores em fontes como Tarobá e Jornal de Ponta Grossa), a tela fica parada no mesmo passo, sem novo texto no log e sem jeito de cancelar. É exatamente o "fica travado".

Um segundo agravante: hoje qualquer erro no meio da clusterização/escrita interrompe o pipeline inteiro, então uma fonte problemática derruba a rodada toda.

## O que vou fazer

1. **Tempo limite por chamada.** Cada chamada ao servidor ganha um limite (scrape 90s, demais 60s). Estourou, o log escreve "lote X demorou demais — seguindo" e o pipeline avança em vez de congelar.
2. **Botão Cancelar.** Enquanto o pipeline roda, um botão interrompe a rodada de forma limpa (o log registra "cancelado pelo usuário").
3. **Relógio de progresso.** Cada linha do log passa a mostrar o tempo decorrido e a etapa atual, para ficar visível se algo está apenas lento ou realmente parado.
4. **Tolerância a falhas por lote.** Erros de clusterização/classificação/escrita passam a ser registrados como aviso e o pipeline segue para o próximo lote; só interrompe se todos os lotes de uma etapa falharem. O resumo final lista quantos lotes falharam.
5. **Aplicar o mesmo tratamento** aos outros botões que usam a mesma sequência (prefeituras e curadorias), para não repetir o travamento por lá.

## Detalhes técnicos

- Arquivo principal: `src/routes/admin.painel.tsx`.
- Criar um utilitário local `invokeComTimeout(nome, body, ms, signal)` sobre `supabase.functions.invoke`, usando `AbortController` (a opção de sinal já é suportada pelo cliente) e um `Promise.race` de segurança.
- Um `AbortController` por rodada, guardado em `useRef`, abortado pelo botão Cancelar; o `catch` distingue "abortado" de erro real.
- Trocar os `throw r.error` dentro dos laços por contagem de falhas + linha de aviso no log; manter o `throw` apenas quando a etapa inteira falhar.
- Sem mudanças nas funções do servidor nem no banco nesta etapa.

## Fora do escopo (posso fazer depois, se quiser)

- Investigar por que algumas fontes vivem estourando no Firecrawl e definir uma lista de fontes com coleta direta por HTML.
- Verificar se o agendamento automático (cron) do banco externo está de fato instalado, já que o arquivo `003_pipeline_cron.sql` precisa ser rodado manualmente com URL e chave preenchidas.
