-- 080 — Portal da Imprensa: autocadastro de assessorias de prefeitura.
--
-- O responsável pela comunicação da prefeitura cria a própria conta (senha
-- dele, ninguém precisa enviar), mas só publica depois que a equipe aprova
-- o cadastro no painel (/admin/imprensa-clientes).
--
-- Clientes já existentes (criados pelo admin) ficam como 'aprovado'.
-- Rodar à mão no SQL editor do projeto externo.

alter table public.clientes_imprensa
  add column if not exists status text not null default 'aprovado'
    check (status in ('pendente', 'aprovado', 'recusado')),
  add column if not exists origem text not null default 'admin'
    check (origem in ('admin', 'autocadastro')),
  add column if not exists cidade_id uuid references public.cidades(id),
  add column if not exists cpf text,
  add column if not exists funcao text,
  add column if not exists lgpd_aceite_em timestamptz,
  add column if not exists lgpd_aceite_texto text,
  add column if not exists termo_cadastro_aceite_em timestamptz,
  add column if not exists termo_cadastro_texto text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id),
  add column if not exists recusa_motivo text;

-- Uma mesma pessoa (CPF) só tem um cadastro por prefeitura.
create unique index if not exists clientes_imprensa_cpf_cidade_uidx
  on public.clientes_imprensa(cpf, cidade_id) where cpf is not null;

create index if not exists clientes_imprensa_status_idx
  on public.clientes_imprensa(status, criado_em desc);

-- Fotos: só cliente aprovado envia (o pendente só vê "cadastro em análise").
drop policy if exists "imprensa imagens upload cliente logado" on storage.objects;
create policy "imprensa imagens upload cliente logado" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imprensa-imagens'
    and exists (
      select 1 from public.clientes_imprensa
      where user_id = auth.uid() and ativo = true and status = 'aprovado'
    )
  );
