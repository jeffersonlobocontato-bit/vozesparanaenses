-- Pausa global da IA quando o limite de créditos é atingido (uma linha só).
-- As edge functions gravam aqui pelo service role; ninguém mais lê nem escreve.
create table if not exists public.ia_pausa (
  id smallint primary key default 1 check (id = 1),
  ate timestamptz not null,
  motivo text not null,
  desde timestamptz not null default now()
);
alter table public.ia_pausa enable row level security;
revoke all on public.ia_pausa from anon, authenticated;
grant all on public.ia_pausa to service_role;
drop policy if exists ia_pausa_admin_le on public.ia_pausa;
create policy ia_pausa_admin_le on public.ia_pausa for select to authenticated using (public.has_role(auth.uid(), 'admin'));
grant select on public.ia_pausa to authenticated;
