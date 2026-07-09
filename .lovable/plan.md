## Problema

O script `001_init.sql` foi executado parcialmente antes (as tabelas e políticas já existem no Supabase externo). Ao rodar de novo, o Postgres reclama que a policy `"profiles self read"` já existe — `CREATE POLICY` não tem `IF NOT EXISTS`.

## Solução

Tornar o script **idempotente** para poder rodar N vezes sem erro:

1. Adicionar `DROP POLICY IF EXISTS ... ON ...;` antes de cada `CREATE POLICY` (todas as ~20 políticas).
2. Trocar `CREATE TRIGGER` por `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...` (Postgres não suporta `CREATE TRIGGER IF NOT EXISTS` em versões antigas; o padrão seguro é dropar antes).
3. Manter `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING` como já estão.
4. Manter `CREATE OR REPLACE FUNCTION` como está.

Depois disso, você roda o mesmo arquivo `supabase-external/001_init.sql` de novo no SQL Editor e não dá erro, independente do que já foi criado antes.

## Alternativa mais rápida (se preferir)

Se você quer só destravar agora sem eu editar o arquivo: rode manualmente no SQL Editor apenas:

```sql
drop policy if exists "profiles self read" on public.profiles;
```

e depois execute o script inteiro de novo — mas ele vai parar no próximo `CREATE POLICY` duplicado. A opção idempotente resolve de vez.

## Recomendação

Fazer a versão idempotente (opção 1). Quando estiver em build mode, atualizo o arquivo `supabase-external/001_init.sql`, você cola no SQL Editor de novo, roda, e seguimos para o cliente Supabase externo + rotas públicas.