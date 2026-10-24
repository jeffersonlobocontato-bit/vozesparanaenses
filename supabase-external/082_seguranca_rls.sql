-- 082 — Correções de segurança (revisão de 24/10/2026).
--
-- 1. correcoes: a política "equipe le e edita correcoes" valia para QUALQUER
--    usuário logado (using true). Com o autocadastro do Portal da Imprensa,
--    qualquer pessoa vira usuário logado e lia o contato dos leitores.
--    Agora só admin/editor. O leitor continua podendo registrar correção.
-- 2. imprensa_submissoes: o cliente podia editar a própria submissão direto
--    pela API (inclusive hora/IP/texto do aceite do termo). As funções gravam
--    com a service role; o cliente só precisa ler.
-- 3. Buckets públicos que recebem arquivo de fora da equipe: só foto
--    (JPG/PNG/WebP), até 10 MB — SVG/HTML poderiam carregar script.

drop policy if exists "equipe le e edita correcoes" on public.correcoes;
create policy "equipe le e edita correcoes" on public.correcoes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "cliente gerencia proprias submissoes" on public.imprensa_submissoes;
drop policy if exists "cliente le proprias submissoes" on public.imprensa_submissoes;
create policy "cliente le proprias submissoes" on public.imprensa_submissoes
  for select to authenticated
  using (cliente_id in (select id from public.clientes_imprensa where user_id = auth.uid()));

update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
      file_size_limit = 10485760
  where id in ('imprensa-imagens', 'vitrine-pessoal-fotos');
