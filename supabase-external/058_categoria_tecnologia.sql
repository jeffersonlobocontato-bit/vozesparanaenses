-- =====================================================================
-- 058 — Categoria editorial: Tecnologia
-- Até aqui as fontes de tecnologia só tinham a marcação
-- curadoria_editoria='tecnologia', sem categoria de destino. Esta
-- migration cria a editoria para as matérias terem onde ser publicadas.
-- =====================================================================
insert into public.editorial_categories (slug, nome)
values ('tecnologia', 'Tecnologia')
on conflict (slug) do nothing;
