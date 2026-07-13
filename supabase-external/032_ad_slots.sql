-- =====================================================================
-- 032_ad_slots.sql
-- Novo modelo de espaços de anúncio: cada criativo é vinculado a um SLOT
-- (nome do espaço no site) + VARIANTE (desktop/mobile). O pickAd escolhe
-- pelo par (slot, variante) — sem mais decisão por pixels.
--
-- Slots iniciais (ver src/lib/ad-slots.ts):
--   home_topo               (970x90 / 320x50)
--   home_sidebar_hero       (300x250 / 300x250)
--   home_sidebar_quadrado   (300x250 / 300x250)
--   home_sidebar_alto       (300x600 / 300x250)
--   materia_topo            (728x90 / 320x50)
--   materia_meio            (300x250 / 300x250)
--   materia_rodape          (970x90 / 320x50)
-- =====================================================================

-- 1. Zera criativos legados (decisão do produto: recomeçar cadastros no
--    novo fluxo). Impressões/cliques históricos são preservados.
delete from public.ad_creatives;

-- 2. Novas colunas
alter table public.ad_creatives
  add column if not exists slot text,
  add column if not exists variante text
    check (variante is null or variante in ('desktop','mobile'));

create index if not exists ad_creatives_slot_variante_idx
  on public.ad_creatives(slot, variante);

-- 3. Recria a view expondo slot/variante para o ad server
drop view if exists public.ads_eligible;
create view public.ads_eligible as
select
  cr.id            as creative_id,
  cr.campaign_id,
  cr.imagem_url,
  cr.headline,
  cr.cta_texto,
  cr.destino_url,
  cr.peso,
  cr.formato,
  cr.slot,
  cr.variante,
  ca.editorias,
  ca.data_inicio,
  ca.data_fim
from public.ad_creatives cr
join public.ad_campaigns ca on ca.id = cr.campaign_id
where cr.aprovado = true
  and ca.status = 'ativa'
  and current_date between ca.data_inicio and ca.data_fim;

grant select on public.ads_eligible to anon, authenticated;