-- =====================================================================
-- Vozes Paranaenses — 042_curadoria_nacional_geral.sql
-- Reorganização dos 4 cards do painel: separa "Segurança & Esporte
-- nacional" (card 3) de "Nacional geral" (card 4) — G1, Metrópoles, R7 e
-- CNN Brasil cobrem TUDO, não só crime, então deixam de ter editoria fixa
-- e passam a ser classificadas pela IA de verdade (mesma que já classifica
-- o Paraná). As fontes de esporte continuam pré-classificadas, sem
-- precisar de IA — são inequivocamente esporte.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.fontes drop constraint if exists fontes_curadoria_editoria_check;
alter table public.fontes add constraint fontes_curadoria_editoria_check
  check (curadoria_editoria in ('seguranca', 'esportes', 'geral'));

update public.fontes
set curadoria_editoria = 'geral'
where curadoria_editoria = 'seguranca'
  and url_base in (
    'https://g1.globo.com/',
    'https://www.metropoles.com/',
    'https://www.r7.com/',
    'https://www.cnnbrasil.com.br/'
  );
