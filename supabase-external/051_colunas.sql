-- =====================================================================
-- Vozes Paranaenses — 051_colunas.sql
-- Módulo de colunas de opinião/bastidores (ex.: "Vozes Políticas").
--
-- Modelo: uma coluna (série, ex.: "Vozes Políticas") tem várias EDIÇÕES
-- (uma por publicação); cada edição tem várias NOTAS (os blocos com
-- título-gatilho próprio). A home mostra sempre a edição PUBLICADA mais
-- recente daquela coluna; edições anteriores ficam acessíveis por um
-- arquivo cronológico — não é apagado, só deixa de ser "a atual".
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

create table if not exists public.colunas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao text,
  foto_colunista_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.coluna_edicoes (
  id uuid primary key default gen_random_uuid(),
  coluna_id uuid not null references public.colunas(id) on delete cascade,
  titulo text not null,
  subtitulo text,
  imagem_principal_url text,
  pergunta_engajamento text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists coluna_edicoes_atual_idx
  on public.coluna_edicoes(coluna_id, status, publicado_em desc);

create table if not exists public.coluna_notas (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.coluna_edicoes(id) on delete cascade,
  ordem integer not null default 0,
  titulo_gatilho text not null,
  corpo text not null,
  imagem_url text,
  criado_em timestamptz not null default now()
);

create index if not exists coluna_notas_edicao_idx
  on public.coluna_notas(edicao_id, ordem);

-- RLS: leitura pública só de edição publicada (e das notas dela); escrita
-- só pra equipe (admin/editor), mesmo padrão já usado no resto do banco.
alter table public.colunas enable row level security;
alter table public.coluna_edicoes enable row level security;
alter table public.coluna_notas enable row level security;

drop policy if exists "colunas leitura publica" on public.colunas;
create policy "colunas leitura publica" on public.colunas
  for select to anon, authenticated using (ativo = true);

drop policy if exists "colunas escrita equipe" on public.colunas;
create policy "colunas escrita equipe" on public.colunas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "edicoes leitura publica" on public.coluna_edicoes;
create policy "edicoes leitura publica" on public.coluna_edicoes
  for select to anon, authenticated using (status = 'publicado');

drop policy if exists "edicoes leitura equipe" on public.coluna_edicoes;
create policy "edicoes leitura equipe" on public.coluna_edicoes
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "edicoes escrita equipe" on public.coluna_edicoes;
create policy "edicoes escrita equipe" on public.coluna_edicoes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "notas leitura publica" on public.coluna_notas;
create policy "notas leitura publica" on public.coluna_notas
  for select to anon, authenticated
  using (exists (
    select 1 from public.coluna_edicoes e
    where e.id = coluna_notas.edicao_id and e.status = 'publicado'
  ));

drop policy if exists "notas leitura equipe" on public.coluna_notas;
create policy "notas leitura equipe" on public.coluna_notas
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

drop policy if exists "notas escrita equipe" on public.coluna_notas;
create policy "notas escrita equipe" on public.coluna_notas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

-- Bucket de imagens da coluna (capa da edição + foto por nota)
insert into storage.buckets (id, name, public)
values ('coluna-imagens', 'coluna-imagens', true)
on conflict (id) do nothing;

drop policy if exists "coluna imagens leitura publica" on storage.objects;
create policy "coluna imagens leitura publica" on storage.objects
  for select using (bucket_id = 'coluna-imagens');

drop policy if exists "coluna imagens escrita equipe" on storage.objects;
create policy "coluna imagens escrita equipe" on storage.objects
  for all to authenticated
  using (bucket_id = 'coluna-imagens' and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')))
  with check (bucket_id = 'coluna-imagens' and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')));

-- =====================================================================
-- Seed: a coluna "Vozes Políticas" + primeira edição de verdade
-- =====================================================================

insert into public.colunas (slug, nome, descricao)
select 'vozes-politicas', 'Vozes Políticas',
  'Bastidores e movimentação política do Paraná, com leitura crítica e sem meias palavras — sempre separando fato de opinião.'
where not exists (select 1 from public.colunas where slug = 'vozes-politicas');

do $$
declare
  v_coluna_id uuid;
  v_edicao_id uuid;
begin
  select id into v_coluna_id from public.colunas where slug = 'vozes-politicas';

  if not exists (select 1 from public.coluna_edicoes where coluna_id = v_coluna_id) then
    insert into public.coluna_edicoes (coluna_id, titulo, subtitulo, pergunta_engajamento, status, publicado_em)
    values (
      v_coluna_id,
      'Antes da convenção, o Paraná já elegeu seu esporte oficial: virar a casaca',
      'Enquanto Republicanos e MDB se preparam para bater o martelo neste fim de semana, o tabuleiro político paranaense troca de peça a cada 24 horas — e o silêncio no Palácio Iguaçu, dizem os bem informados, está barulhento',
      'E você, leitor? Na sua opinião, pra qual lado a maioria dos prefeitos do Paraná deve migrar depois dessa movimentação toda?',
      'publicado',
      now()
    )
    returning id into v_edicao_id;

    insert into public.coluna_notas (edicao_id, ordem, titulo_gatilho, corpo) values
    (v_edicao_id, 1, 'Richa fecha com Sandro Alex — e dá o troco em Greca',
      'Comecemos pelo que já é dado como fechado: Beto Richa confirmou, na sexta-feira retrasada, que a Federação PSDB/Cidadania caminha ao lado de Sandro Alex para o governo e de Alexandre Curi para o Senado. Antes de bater o martelo, porém, o ex-governador recebeu — e recusou — convite de Rafael Greca para embarcar em outro projeto. A escolha, dizem quem acompanhou de perto, também levou em conta o espaço que Ricardo Barros já ocupava do outro lado.'),
    (v_edicao_id, 2, 'O vice que jurou nunca ser vice — e a conta que Curi não esperava pagar',
      'Foi bonito enquanto durou. Porque poucos dias depois, o próprio Greca trocou de mala: aceitou ser vice de Sandro Alex, movimento que teria vindo empacotado junto com uma vaga ao Senado para Álvaro Dias. E aqui a novela ganha seu primeiro grande abalo — Alexandre Curi, que vinha carregando nas costas boa parte da articulação municipal a favor de Sandro Alex, foi pego de surpresa. Segundo relatos de pessoas próximas ao presidente da Assembleia, o entendimento sempre foi de que qualquer segunda vaga passaria por conversa prévia com ele. Não passou.'),
    (v_edicao_id, 3, 'O silêncio mais barulhento do Palácio Iguaçu',
      'Curi, ao que tudo indica, não vai bater o pé antes da convenção do Republicanos, marcada para segunda-feira. Mas o silêncio, como quase sempre em política, é o barulho mais alto de todos — e a ausência dele (e de Greca) num evento governista em Foz do Iguaçu, nesta semana, não passou despercebida. Reza a lenda dos bastidores que o consumo de café forte na sede do governo anda em ritmo de plantão.'),
    (v_edicao_id, 4, 'A internet cobra a palavra empenhada',
      'Enquanto isso, quem prometeu não ser vice de ninguém colhe o troco nas redes sociais. A guinada de Greca reacendeu vídeos antigos em que ele garantia o contrário, e a internet — implacável como sempre — fez a festa com direito a print, corte e comentário ácido. Promessa de campanha, aprendemos de novo, tem prazo de validade mais curto que se imagina.'),
    (v_edicao_id, 5, 'Lupion não engoliu — e o risco de racha é real',
      'Do outro lado do tabuleiro, nem todo mundo comemora a nova aliança. Pedro Lupion, do Republicanos, já deixou pública sua irritação com o acordo entre MDB e PSD — na leitura dele, a costura que trouxe Greca e viabilizou Álvaro Dias ao Senado se fez desrespeitando o espaço de Curi. O risco, mesmo que ainda distante, é de racha aberto na convenção.'),
    (v_edicao_id, 6, 'A ponta solta: Bertolucci contra o governo',
      'E tem ainda a ponta solta que promete render capítulo à parte: o influenciador Gabriel Bertolucci afirma ter protocolado denúncia no Ministério Público contra o governo do Estado, alegando que dados da Secretaria de Turismo sumiram do Portal da Transparência bem na hora em que ele fazia o próprio levantamento. Segundo ele — e por enquanto só segundo ele, já que o MP não se manifestou publicamente sobre o caso — os números baixados antes do apagão apontariam salto expressivo em contratos e convênios da pasta. Fica o registro: é acusação, não veredito. Mas é o tipo de história que essa coluna vai acompanhar de perto.'),
    (v_edicao_id, 7, 'O que vem por aí',
      'Se depender do calendário, sábado e segunda-feira devem organizar boa parte dessa bagunça. Se depender do histórico recente, é melhor não apostar em nada até a poeira baixar de vez.');
  end if;
end $$;
