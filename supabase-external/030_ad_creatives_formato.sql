-- =====================================================================
-- 030_ad_creatives_formato.sql
-- Vincula cada criativo a um formato de exibição (tamanho do slot).
-- NULL = serve em qualquer formato (backward-compat).
-- =====================================================================

alter table public.ad_creatives
  add column if not exists formato text
  check (formato is null or formato in ('970x90','728x90','300x250','300x600','320x50'));

create index if not exists ad_creatives_formato_idx on public.ad_creatives(formato);

-- Recria a view expondo o formato para o ad server
-- (drop antes do create para permitir reordenar colunas)
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
  ca.editorias,
  ca.data_inicio,
  ca.data_fim
from public.ad_creatives cr
join public.ad_campaigns ca on ca.id = cr.campaign_id
where cr.aprovado = true
  and ca.status = 'ativa'
  and current_date between ca.data_inicio and ca.data_fim;

grant select on public.ads_eligible to anon, authenticated;
