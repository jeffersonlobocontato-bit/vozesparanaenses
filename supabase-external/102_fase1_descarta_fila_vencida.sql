-- Fase 1 da redução de custo de IA (20/11/2026). JÁ APLICADA no banco Rede de Portais.
-- 7.158 pautas presas em selecionado_cota/fatos_extraidos com coleta de mais de 24h.
-- O generate-article automático já as descartaria como "fora_do_dia", mas só depois
-- de extrair fatos; duas delas (9 e 10/11) passaram ~500 vezes cada pela extração.
-- Status anterior guardado em fase1_backup_clusters (para desfazer:
-- update article_clusters c set status = b.status_anterior::cluster_status
--   from fase1_backup_clusters b where b.cluster_id = c.id;).
create table if not exists public.fase1_backup_clusters (
  cluster_id uuid primary key, status_anterior text not null, encerrado_em timestamptz not null default now()
);
alter table public.fase1_backup_clusters enable row level security;
revoke all on public.fase1_backup_clusters from anon, authenticated;

with alvo as (
  select c.id, c.status::text st from public.article_clusters c
  where c.status in ('selecionado_cota','fatos_extraidos')
    and (select max(r.coletado_em) from public.cluster_articles ca join public.raw_articles r on r.id = ca.raw_article_id where ca.cluster_id = c.id) < now() - interval '24 hours'
), bk as (
  insert into public.fase1_backup_clusters (cluster_id, status_anterior) select id, st from alvo on conflict do nothing returning cluster_id
), upd as (
  update public.article_clusters set status = 'descartado' where id in (select cluster_id from bk) returning id
)
update public.raw_articles set processado = true
where id in (select ca.raw_article_id from public.cluster_articles ca where ca.cluster_id in (select id from upd));
