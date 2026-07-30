-- =====================================================================
-- Vozes Paranaenses — 048_corrige_metodo_del_sobre.sql
-- A migration 047 (config da página /sobre) inseriu a definição errada
-- do Método DEL — "Denso, Editorial, Local" — repetindo um erro que já
-- tinha sido corrigido antes (migration 037). O nome correto é
-- "Decomposição de Estrutura de Linguagem". Como a 047 já rodou e
-- inseriu a linha, um simples ajuste no arquivo de seed não corrige o
-- que já está no banco — precisa deste UPDATE.
--
-- Roda no Supabase EXTERNO. Idempotente (roda mesmo que já tenha corrigido).
-- =====================================================================

update public.sobre_config
set metodo_editorial = replace(
  metodo_editorial,
  'Método **DEL — Denso, Editorial, Local**',
  'Método **DEL — Decomposição de Estrutura de Linguagem**'
)
where singleton = true
  and metodo_editorial like '%Denso, Editorial, Local%';
