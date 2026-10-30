-- 097 — Usuários da equipe (/admin/usuarios) e o papel "Consulta".
--
-- Papéis do painel (enum user_role já existente):
--   admin   — tudo, inclusive cadastrar usuários;
--   editor  — redação e pipeline, sem gestão de usuários;
--   viewer  — "Consulta": só LÊ os painéis (números, pipeline, cobertura,
--             analytics, custos). Nunca escreve: as políticas de escrita
--             continuam só para admin/editor.
--
-- 1. Leitura para o papel Consulta: uma política SELECT a mais em cada tabela
--    que a equipe (editor) já lê — exceto as de dados pessoais de clientes e
--    a própria tabela de papéis.
-- 2. As RPCs de painel (stable, só leitura) passam a aceitar o papel Consulta.
-- 3. Funções de gestão (só admin): listar a equipe, trocar papel, tirar
--    acesso; e uma busca de usuário por e-mail só para a service role (usada
--    pela função equipe-criar-usuario).

-- 1. Leitura para o papel Consulta -------------------------------------------
do $$
declare t text;
begin
  for t in
    select distinct tablename from pg_policies
    where schemaname = 'public'
      and cmd in ('SELECT', 'ALL')
      and qual ilike '%''editor''%'
      and tablename not in (
        'user_roles', 'form_rate_limit',
        'clientes_imprensa', 'imprensa_submissoes',
        'publieditorial_briefings', 'publieditorial_chat_messages',
        'vitrine_pessoal_pedidos', 'vitrine_pessoal_chat_messages',
        'pedidos_chatbot', 'whatsapp_leads', 'coluna_comentarios'
      )
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'consulta_le') then
      execute format('create policy consulta_le on public.%I for select to authenticated using (public.has_role(auth.uid(), ''viewer''))', t);
    end if;
  end loop;
end $$;

-- 2. RPCs de painel aceitam o papel Consulta ------------------------------
do $$
declare f record; def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.provolatile = 's'
      and p.proname in ('cobertura_municipios', 'custos_resumo', 'fonte_ficha', 'fontes_estatisticas',
                        'pipeline_agenda', 'pipeline_eventos', 'pipeline_painel', 'pipeline_resumo_hoje')
  loop
    def := pg_get_functiondef(f.oid);
    if def !~ '''viewer''' then
      def := replace(def, '''editor'')) then', '''editor'') or public.has_role(auth.uid(), ''viewer'')) then');
      execute def;
    end if;
  end loop;
end $$;

-- 3. Gestão da equipe (só admin) --------------------------------------------
create or replace function public.equipe_listar()
returns table (user_id uuid, email text, nome text, papeis text[], criado_em timestamptz, ultimo_acesso timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado';
  end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'nome', '')::text,
           array_agg(r.role::text order by r.role::text), u.created_at, u.last_sign_in_at
    from auth.users u
    join public.user_roles r on r.user_id = u.id
    group by u.id
    order by u.email;
end;
$$;

-- Troca o papel (um papel por pessoa no painel). Ninguém mexe no próprio
-- papel — evita o último admin se trancar fora.
create or replace function public.equipe_definir_papel(p_user uuid, p_papel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado';
  end if;
  if p_user = auth.uid() then
    raise exception 'não é possível alterar o próprio papel';
  end if;
  if p_papel not in ('admin', 'editor', 'viewer') then
    raise exception 'papel inválido';
  end if;
  delete from public.user_roles where user_id = p_user and role in ('admin', 'editor', 'reviewer', 'viewer');
  insert into public.user_roles (user_id, role) values (p_user, p_papel::user_role);
end;
$$;

-- Tira o acesso ao painel (remove os papéis; a conta de login continua).
create or replace function public.equipe_remover(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado';
  end if;
  if p_user = auth.uid() then
    raise exception 'não é possível remover o próprio acesso';
  end if;
  delete from public.user_roles where user_id = p_user and role in ('admin', 'editor', 'reviewer', 'viewer');
end;
$$;

-- Só a service role (função equipe-criar-usuario): acha a conta pelo e-mail.
create or replace function public.equipe_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.equipe_listar() from public, anon;
revoke all on function public.equipe_definir_papel(uuid, text) from public, anon;
revoke all on function public.equipe_remover(uuid) from public, anon;
revoke all on function public.equipe_id_por_email(text) from public, anon, authenticated;
grant execute on function public.equipe_listar() to authenticated;
grant execute on function public.equipe_definir_papel(uuid, text) to authenticated;
grant execute on function public.equipe_remover(uuid) to authenticated;
grant execute on function public.equipe_id_por_email(text) to service_role;
