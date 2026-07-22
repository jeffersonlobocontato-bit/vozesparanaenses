## Correções a aplicar (do files_33-2.zip)

**1. `src/routes/$region.classificados.tsx`** — loader passa `items` pro `head()` e adiciona `<meta robots="noindex, follow">` quando a região ainda não tem classificados publicados.

**2. `src/routes/$region.index.tsx`** — loader passa `articles` pro `head()` e adiciona `<meta robots="noindex, follow">` quando a região ainda não tem matérias (útil pra Nacional/Internacional recém-criadas).

**3. `supabase/functions/generate-article/index.ts`** — trava anti-duplicata antes de auto-publicar:
- Consulta títulos publicados na mesma categoria+região nas últimas 48h.
- Compara via similaridade de Jaccard (palavras relevantes, ignorando stopwords) com limiar 0.5.
- Se detectar duplicata provável, força fila manual em vez de publicar automaticamente.

**4. `supabase-external/046_consulta_duplicatas.sql`** (novo) — query de leitura (não altera nada) para o SQL Editor do Supabase externo listar prováveis duplicatas já publicadas (mesma categoria+região+dia), pra revisão manual.

Nenhuma dependência nova, nenhuma migração destrutiva, sem mudanças de UI pública além dos meta tags.