-- =====================================================================
-- Vozes Paranaenses — 034_catalogo_precos_chatbot.sql
-- Traz a tabela de preços comercial (antes só na planilha) pro banco —
-- é a fonte da verdade que o chatbot de vendas (e o painel) vão consultar,
-- pra nunca inventar valor. Também cria a tabela de pedidos do chatbot
-- (o "carrinho" — registra a intenção de compra e o status de pagamento
-- manual, até termos o Mercado Pago configurado).
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.catalogo_espacos (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique,
  nome text not null,
  preco_mensal_base numeric not null,
  ativo boolean not null default true
);
insert into public.catalogo_espacos (slot, nome, preco_mensal_base) values
  ('home_topo', 'Home — Topo', 600),
  ('home_sidebar_hero', 'Home — Sidebar hero', 400),
  ('home_sidebar_quadrado', 'Home — Sidebar quadrado', 350),
  ('home_sidebar_alto', 'Home — Sidebar alto', 450),
  ('materia_topo', 'Matéria — Topo', 500),
  ('materia_meio', 'Matéria — Meio', 400),
  ('materia_rodape', 'Matéria — Rodapé', 350)
on conflict (slot) do nothing;

create table if not exists public.catalogo_abrangencia (
  id uuid primary key default gen_random_uuid(),
  abrangencia text not null unique check (abrangencia in ('cidade','regiao','estado')),
  multiplicador numeric not null,
  descricao text
);
insert into public.catalogo_abrangencia (abrangencia, multiplicador, descricao) values
  ('cidade', 0.6, 'Recorte dentro de uma região — comércio hiperlocal'),
  ('regiao', 1.0, 'Cobertura de 1 macrorregião — o padrão'),
  ('estado', 8.0, 'As 10 regiões — desconto de ~20% vs. comprar avulso')
on conflict (abrangencia) do nothing;

create table if not exists public.catalogo_periodicidade (
  id uuid primary key default gen_random_uuid(),
  periodicidade text not null unique check (periodicidade in ('semanal','quinzenal','mensal','semestral','anual')),
  meses_equivalentes numeric not null,
  ajuste numeric not null,
  descricao text
);
insert into public.catalogo_periodicidade (periodicidade, meses_equivalentes, ajuste, descricao) values
  ('semanal', 0.25, 1.15, 'Curto prazo paga um pouco mais por semana'),
  ('quinzenal', 0.5, 1.08, null),
  ('mensal', 1.0, 1.00, 'Referência — sem ajuste'),
  ('semestral', 6.0, 0.85, '15% de desconto por fechar 6 meses'),
  ('anual', 12.0, 0.75, '25% de desconto por fechar o ano')
on conflict (periodicidade) do nothing;

create table if not exists public.catalogo_combos_anuncio (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  espacos_incluidos text not null,
  preco_mensal numeric not null,
  ativo boolean not null default true
);
insert into public.catalogo_combos_anuncio (nome, espacos_incluidos, preco_mensal) values
  ('Combo Básico', 'Matéria — Meio + Home — Sidebar quadrado', 600),
  ('Combo Completo', 'Home — Topo + Matéria — Topo + Matéria — Meio + Home — Sidebar hero', 1450),
  ('Combo Domínio Total', 'Todos os 7 espaços da região', 2200)
on conflict (nome) do nothing;

create table if not exists public.catalogo_publieditorial (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text not null,
  preco numeric not null,
  ativo boolean not null default true
);
insert into public.catalogo_publieditorial (nome, descricao, preco) values
  ('Publieditorial avulso', '1 matéria patrocinada, publicada 1x no mês', 450),
  ('Pacote Presença', '4 matérias/mês — 1 por semana', 1500),
  ('Pacote Autoridade', '8 matérias/mês — 2 por semana', 2600)
on conflict (nome) do nothing;

create table if not exists public.catalogo_combos_mistos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text not null,
  preco_mensal numeric not null,
  ativo boolean not null default true
);
insert into public.catalogo_combos_mistos (nome, descricao, preco_mensal) values
  ('Presença Completa', 'Combo Básico (anúncio) + Publieditorial avulso', 900),
  ('Autoridade Máxima', 'Combo Completo (anúncio) + Pacote Autoridade (8 matérias/mês)', 3400)
on conflict (nome) do nothing;

do $$
declare t text;
begin
  for t in select unnest(array[
    'catalogo_espacos','catalogo_abrangencia','catalogo_periodicidade',
    'catalogo_combos_anuncio','catalogo_publieditorial','catalogo_combos_mistos'
  ])
  loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin gerencia" on public.%I', t);
    execute format('create policy "admin gerencia" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

-- Pedidos do chatbot — o "carrinho". status de pagamento é MANUAL por
-- enquanto (admin confirma o Pix recebido) — quando o Mercado Pago for
-- configurado, os mesmos status continuam valendo, só passam a ser
-- setados por webhook em vez de clique humano.
create table if not exists public.pedidos_chatbot (
  id uuid primary key default gen_random_uuid(),
  sessao_id text not null,
  tipo_produto text not null check (tipo_produto in ('espaco_individual','combo_anuncio','publieditorial','combo_misto')),
  descricao_produto text not null,
  regiao_slug text,
  abrangencia text,
  periodicidade text,
  valor_total numeric not null,
  nome_cliente text,
  contato text,
  origem text not null default 'direto' check (origem in ('direto','agencia')),
  status text not null default 'pendente_pagamento' check (status in ('pendente_pagamento','pago','cancelado','expirado')),
  metodo_pagamento text not null default 'pix_manual' check (metodo_pagamento in ('pix_manual','mercado_pago')),
  confirmado_por uuid references auth.users(id),
  anuncio_vinculado_ate timestamptz,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);

grant select, insert, update on public.pedidos_chatbot to anon, authenticated;
grant all on public.pedidos_chatbot to service_role;
alter table public.pedidos_chatbot enable row level security;

drop policy if exists "qualquer um cria pedido" on public.pedidos_chatbot;
create policy "qualquer um cria pedido" on public.pedidos_chatbot
  for insert to anon, authenticated with check (true);
drop policy if exists "equipe le e gerencia pedidos" on public.pedidos_chatbot;
create policy "equipe le e gerencia pedidos" on public.pedidos_chatbot
  for select using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "equipe atualiza pedidos" on public.pedidos_chatbot;
create policy "equipe atualiza pedidos" on public.pedidos_chatbot
  for update to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
