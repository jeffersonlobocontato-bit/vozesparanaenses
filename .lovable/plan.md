## Diagnóstico

Consultei o banco e confirmei a causa raiz: **a migration `030_ad_creatives_formato.sql` nunca foi aplicada**.

- A tabela `ad_creatives` **não tem** a coluna `formato`.
- A view `ads_eligible` também **não expõe** `formato`.
- O `pickAd` (`src/lib/ads.functions.ts`) faz `select("...,formato")` — como a coluna não existe, o PostgREST retorna erro, `creatives` vira `null` e o slot cai no **mock house-ad** (Sicredi, Copel, Unimed, Renault, Sesc) — que é justamente o que aparece hoje em todos os espaços do site.

Ou seja: os 2 criativos reais da campanha "Consultoria em IA" **não estão sequer sendo servidos**; o que você vê são os placeholders internos, que ignoram tamanho e giram por hash em qualquer slot.

## Plano de correção

### 1. Aplicar a migration pendente
Rodar `supabase-external/030_ad_creatives_formato.sql` (já existe no repo, com o `drop view if exists` que ajustamos). Isso:
- adiciona `ad_creatives.formato text`
- recria `ads_eligible` incluindo a coluna `formato`

### 2. Definir o formato dos 2 criativos existentes
Depois da migration, os dois criativos ficam com `formato = NULL` (servem em qualquer slot). Vou atualizar direto no banco para os tamanhos reais das peças entregues pelo Jefferson Lobo:
- criativo 1 → `300x250` (quadrado da sidebar)
- criativo 2 → `970x90` (leaderboard do header)

*(se você me disser outro mapeamento eu ajusto; o importante é vincular cada criativo a um formato para parar a exibição indiscriminada)*

### 3. Ajuste defensivo no `AdSlot`
Enquanto o `pickAd` não devolve criativo real, o fallback é o mock. Vou adicionar uma flag `VITE_ADS_HOUSE_FALLBACK` (default `false` em produção) para que, quando não houver campanha elegível para aquele formato, o slot **colapse** em vez de exibir Sicredi/Copel/etc — que hoje passam a impressão de "anúncios fictícios" no site em produção.

### 4. Validação
Depois de aplicar (1) e (2), abrir a home e conferir:
- header (970x90) exibe apenas o criativo `970x90`
- sidebar (300x250) exibe apenas o `300x250`
- slot `300x600` fica vazio (não tem criativo desse formato ainda) — sem mock

## Detalhes técnicos

Arquivos envolvidos:
- `supabase-external/030_ad_creatives_formato.sql` (aplicar)
- `src/components/AdSlot.tsx` (fallback opt-in via env)
- `src/lib/ads.functions.ts` (nenhuma mudança — já filtra por `data.size`)

Update SQL após a migration:
```sql
update ad_creatives set formato = '300x250' where id = '6da91a6b-...';
update ad_creatives set formato = '970x90'  where id = '673ca6b7-...';
```