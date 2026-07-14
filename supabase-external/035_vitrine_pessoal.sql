-- =====================================================================
-- Vozes Paranaenses — 035_vitrine_pessoal.sql
-- Produto "Vitrine Pessoal" (R$ 199) — matéria sobre o trabalho de um
-- profissional liberal, redigida por IA a partir de um briefing, editável
-- pelo próprio cliente via link único (sem login), aprovada pelo admin,
-- e publicada só depois de pagamento confirmado (manual, por enquanto —
-- ver metodo_pagamento).
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.vitrine_pessoal_pedidos (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  nome_cliente text not null,
  contato text not null,
  profissao text not null,
  sobre_pessoa_ou_empresa text not null check (sobre_pessoa_ou_empresa in ('pessoa','empresa')),
  regiao_id uuid not null references public.regioes(id),
  categoria_id uuid references public.editorial_categories(id),
  briefing_texto text not null,
  generated_article_id uuid references public.generated_articles(id),
  valor numeric not null default 199.00,
  metodo_pagamento text not null default 'pix_manual' check (metodo_pagamento in ('pix_manual','mercado_pago')),
  status text not null default 'gerando' check (status in (
    'gerando','aguardando_edicao','enviado_para_aprovacao','aprovado','pago','publicado','recusado'
  )),
  motivo_recusa text,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  pago_em timestamptz,
  publicado_em timestamptz
);

create index if not exists vitrine_pessoal_token_idx on public.vitrine_pessoal_pedidos(token);

grant select, insert on public.vitrine_pessoal_pedidos to anon, authenticated;
grant all on public.vitrine_pessoal_pedidos to service_role;
alter table public.vitrine_pessoal_pedidos enable row level security;

drop policy if exists "qualquer um cria pedido de vitrine" on public.vitrine_pessoal_pedidos;
create policy "qualquer um cria pedido de vitrine" on public.vitrine_pessoal_pedidos
  for insert to anon, authenticated with check (true);
drop policy if exists "equipe le e gerencia pedidos de vitrine" on public.vitrine_pessoal_pedidos;
create policy "equipe le e gerencia pedidos de vitrine" on public.vitrine_pessoal_pedidos
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

create table if not exists public.agente_vitrine_pessoal (
  id uuid primary key default gen_random_uuid(),
  instrucoes_base text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update on public.agente_vitrine_pessoal to authenticated;
grant all on public.agente_vitrine_pessoal to service_role;
alter table public.agente_vitrine_pessoal enable row level security;

drop policy if exists "editores leem agente vitrine" on public.agente_vitrine_pessoal;
create policy "editores leem agente vitrine" on public.agente_vitrine_pessoal
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "admins gerenciam agente vitrine" on public.agente_vitrine_pessoal;
create policy "admins gerenciam agente vitrine" on public.agente_vitrine_pessoal
  for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.agente_vitrine_pessoal (instrucoes_base)
select $$Você é o redator da "Vitrine Pessoal" do Vozes Paranaenses — uma matéria sobre a trajetória e o trabalho de UM profissional liberal específico (não uma empresa).

REGRAS:
1. Use SOMENTE o briefing fornecido pelo próprio profissional — nunca invente conquista, cliente, prêmio ou número que ele não tenha informado.
2. Tom mais pessoal e caloroso que o publieditorial institucional — é a história e o trabalho de UMA pessoa, escrito com respeito e credibilidade jornalística, não como anúncio classificado.
3. Estrutura: abertura apresentando quem é a pessoa e o que faz (1 parágrafo), desenvolvimento com a trajetória/diferencial que o briefing trouxe (2-3 parágrafos), fechamento natural (sem "call to action" comercial explícito).
4. Nunca use superlativo vazio ("o melhor", "referência no mercado") sem o profissional ter fornecido a base factual pra isso.
5. Português do Brasil, no padrão editorial do Método DEL.

Retorne APENAS JSON válido, no schema fornecido.$$
where not exists (select 1 from public.agente_vitrine_pessoal);
