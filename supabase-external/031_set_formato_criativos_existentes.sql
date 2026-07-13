-- =====================================================================
-- 031_set_formato_criativos_existentes.sql
-- Vincula os 2 criativos existentes da campanha "Consultoria em IA"
-- aos formatos corretos, para que o pickAd pare de exibi-los em
-- qualquer slot. Ajuste os UUIDs conforme os criativos reais.
-- =====================================================================

update public.ad_creatives set formato = '300x250'
  where id = '6da91a6b-7349-47ab-98b4-2a753cf2832d';

update public.ad_creatives set formato = '970x90'
  where id = '673ca6b7-9cbc-42f3-9b72-4cf039bc5ecf';
