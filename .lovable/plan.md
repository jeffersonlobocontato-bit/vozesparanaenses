## Diagnóstico (não confirmado em produção, precisa validação)

O módulo `Mais Lidas` da home é montado em `src/routes/index.tsx` chamando `listMostReadArticles({ days: 7, limit: 5 })` de `src/lib/content.functions.ts`. A função lê `analytics_events` no Supabase externo, agrega por `pagina` e retorna as 5 mais frequentes. A lógica está tecnicamente correta (agrega pageviews reais, cruza `region/slug`), mas há três fragilidades que podem explicar um ranking "estranho" ou estagnado:

1. **Amostragem sem ordenação** — a consulta usa `.limit(20000)` sem `.order("ts", …)`. Se houver mais de 20k pageviews na janela, o Postgres devolve linhas em ordem indeterminada e o ranking passa a refletir uma amostra arbitrária (potencialmente antiga), não os últimos 7 dias.
2. **Não separa tráfego admin/interno** — a mesma correção que apliquei no painel de Analytics (segmento "Leitores" vs "Admin") não existe aqui. Toda visita minha às matérias publicadas dentro/fora do `/admin` conta como pageview e infla o ranking com o que EU li recentemente. O filtro atual só descarta URLs que começam com `/admin`, não pageviews de leitor admin em URLs públicas.
3. **`staleTime` de 5 min + loader SSR** — se o cache do TanStack Query estiver quente, a home serve o ranking anterior por até 5 minutos, o que pode dar sensação de "não está atualizando".

Além disso, o fallback silencioso (`return []` em qualquer erro) esconde falhas de leitura da tabela externa — hoje não há como saber se a lista está vazia por falta de dados ou por erro.

## Plano

### 1. Verificar antes de corrigir
- Abrir a home logada e rodar no console: `await window.__vozesDebugMostRead?.()` — vou expor temporariamente um helper que chama `listMostReadArticles` e devolve `{ total_events_lidos, top_paginas_com_contagem, itens_retornados }`. Isso confirma se o problema é (a) amostragem, (b) tráfego admin dominando, ou (c) simplesmente pouco pageview por matéria.
- Só depois de ver o retorno decidimos quais dos itens abaixo aplicar.

### 2. Corrigir amostragem em `listMostReadArticles`
- Adicionar `.order("ts", { ascending: false })` antes do `.limit(20000)` para garantir que, se cortar, corte pelo mais antigo.
- Trocar o cap fixo por paginação em lotes de 1000 até esgotar a janela de dias (mesmo padrão que usei no painel de Analytics), com teto de segurança de 50k.

### 3. Excluir tráfego admin do ranking
- Filtrar pageviews cuja `pagina` começa com `/admin` (já feito) **e** cujo evento veio de sessão admin. Como `analytics_events` não marca "é admin", a opção prática é registrar isso no `track-pageview`: quando `pagina` começar com `/admin`, gravar `origem_trafego = "interno"`; em `listMostReadArticles`, ignorar `origem_trafego = "interno"`. Isso não separa o admin lendo uma matéria pública, mas remove a maior parte do ruído.
- Alternativa mais completa (opcional, discutir): passar um flag `admin_session` do cliente para o `track-pageview` quando houver sessão logada com role admin, e gravar em coluna nova `interno boolean`. Requer migration no Supabase externo.

### 4. Observabilidade
- Trocar o `catch { return [] }` por log estruturado (retornar `[]` continua, mas registrar o erro no console do servidor) para não mascarar falha de leitura futura.
- Manter `staleTime` de 5 min (é razoável para ranking), mas documentar isso em comentário.

### 5. Validar
- Após o deploy, chamar de novo o helper do passo 1 e comparar top 5 com o painel `/admin/analytics` filtrando "Leitores". As duas listas devem convergir.

## Detalhes técnicos

- Arquivos a editar: `src/lib/content.functions.ts` (função `listMostReadArticles`), possivelmente `supabase/functions/track-pageview/index.ts` (marcar interno) e `src/lib/analytics.ts` (passar flag). O helper de debug entra em `src/routes/__root.tsx` atrás de `if (import.meta.env.DEV || pathname.startsWith("/admin"))`.
- Sem migration nova a menos que se opte pela coluna `interno` (passo 3, alternativa).
- Nenhum componente de UI muda.
