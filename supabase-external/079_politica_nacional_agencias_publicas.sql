-- =====================================================================
-- Vozes Paranaenses — 079_politica_nacional_agencias_publicas.sql
--
-- Editoria de POLÍTICA NACIONAL e fotos com licença livre para a primeira
-- dobra (política nacional, nacional, internacional e esportes):
--
--  1. curadoria_editoria ganha 'politica' (cluster-articles já cria a pauta
--     na editoria Política; generate-article escreve com regra de
--     neutralidade; criticidade só segura o que é eleitoral).
--  2. Fontes públicas, cujas fotos têm licença livre com crédito:
--       Agência Brasil (EBC) — política, geral, internacional, esportes
--       Agência Senado e Agência Câmara — política
--     O nome começa com a agência: o crédito publicado sai "Foto: Agência
--     Brasil" quando a coleta não lê o crédito da página.
--  3. Job de coleta de política: 8h, 14h e 20h (Brasília), janela de 1h.
--     Copia URL e chave do job vozes-curadoria-geral (076) — não há
--     marcador para preencher.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

alter table public.fontes drop constraint if exists fontes_curadoria_editoria_check;
alter table public.fontes add constraint fontes_curadoria_editoria_check
  check (curadoria_editoria = any (array['seguranca', 'esportes', 'geral', 'tecnologia', 'politica']));

insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, curadoria_editoria)
values
  ('Agência Brasil — Política',      'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml',      'veiculo', 'estatico', false, true, 'politica'),
  ('Agência Senado — Notícias',      'https://www12.senado.leg.br/noticias/feed/todasnoticias/RSS', 'veiculo', 'estatico', false, true, 'politica'),
  ('Agência Câmara — Notícias',      'https://www.camara.leg.br/noticias/rss/ultimas-noticias',     'veiculo', 'estatico', false, true, 'politica'),
  ('Agência Brasil — Geral',         'https://agenciabrasil.ebc.com.br/rss/geral/feed.xml',         'veiculo', 'estatico', false, true, 'geral'),
  ('Agência Brasil — Internacional', 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml', 'veiculo', 'estatico', false, true, 'geral'),
  ('Agência Brasil — Esportes',      'https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml',      'veiculo', 'estatico', false, true, 'esportes')
on conflict (url_base) do update
  set nome = excluded.nome, ativo = true, curadoria_editoria = excluded.curadoria_editoria;

-- Job de política: mesmo comando da curadoria geral, trocando a editoria.
do $$
declare
  v_cmd text;
begin
  select command into v_cmd from cron.job where jobname = 'vozes-curadoria-geral';
  if v_cmd is null then
    raise exception 'job vozes-curadoria-geral não encontrado — rode a 076 antes.';
  end if;
  if exists (select 1 from cron.job where jobname = 'vozes-curadoria-politica') then
    perform cron.unschedule('vozes-curadoria-politica');
  end if;
  -- 8h, 14h e 20h em Brasília = 11, 17 e 23 UTC (a curadoria coleta cada
  -- fonte no máximo 1 vez a cada 5h — as janelas ficam 6h distantes).
  perform cron.schedule(
    'vozes-curadoria-politica',
    '9-59/10 11,17,23 * * *',
    replace(v_cmd, '["geral"]', '["politica"]')
  );
end $$;

-- Conferência
select nome, curadoria_editoria, ativo from public.fontes where nome like 'Agência %' order by 1;
select jobname, schedule from cron.job where jobname = 'vozes-curadoria-politica';
