-- 081 — Portal da Imprensa: limite de publicações por semana, por cliente.
-- Padrão 1 matéria a cada 7 dias (o que a LP /cidadesdoparana promete);
-- a equipe aumenta por cliente em /admin/imprensa-clientes.
-- Rodar à mão no SQL editor do projeto externo.

alter table public.clientes_imprensa
  add column if not exists limite_semanal smallint not null default 1
    check (limite_semanal between 0 and 50);
