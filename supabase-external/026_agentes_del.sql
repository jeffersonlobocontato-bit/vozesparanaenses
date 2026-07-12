-- =====================================================================
-- 026 — Método DEL para agentes redatores
-- Camadas estruturadas (DNA Sintático/Semântico/Lexical + Matriz) em
-- `agentes_redatores` + singleton `memoria_editorial` (missão, glossário,
-- siglas, pessoas, instituições). Retrocompatível: se camadas vazias,
-- cai no `instrucoes_base` atual.
-- =====================================================================

alter table public.agentes_redatores
  add column if not exists dna_sintatico    jsonb not null default '{}'::jsonb,
  add column if not exists dna_semantico    jsonb not null default '{}'::jsonb,
  add column if not exists dna_lexical      jsonb not null default '{}'::jsonb,
  add column if not exists matriz_editorial jsonb not null default '{}'::jsonb;

create table if not exists public.memoria_editorial (
  id             uuid primary key default gen_random_uuid(),
  singleton      boolean not null default true unique,
  missao         text,
  valores        text,
  posicionamento text,
  manual_estilo  text,
  glossario      jsonb not null default '[]'::jsonb,
  siglas         jsonb not null default '[]'::jsonb,
  pessoas        jsonb not null default '[]'::jsonb,
  instituicoes   jsonb not null default '[]'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);

grant select, insert, update, delete on public.memoria_editorial to authenticated;
grant all on public.memoria_editorial to service_role;
alter table public.memoria_editorial enable row level security;

drop policy if exists "editores leem memoria" on public.memoria_editorial;
create policy "editores leem memoria" on public.memoria_editorial
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

drop policy if exists "admins gerenciam memoria" on public.memoria_editorial;
create policy "admins gerenciam memoria" on public.memoria_editorial
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.memoria_editorial (singleton, missao, valores, posicionamento, manual_estilo, glossario, siglas, pessoas, instituicoes)
values (
  true,
  'Fazer jornalismo hiperlocal, factual e útil para o cidadão do Paraná, priorizando o impacto direto na vida das cidades e regiões do estado.',
  'Precisão factual acima de velocidade. Fonte primária sempre. Zero adjetivação valorativa. Foco no leitor paranaense.',
  'Portal de referência regional do Paraná, com cobertura das 10 regiões e 399 municípios. Traduz nacional/internacional pelo gancho paranaense.',
  'Frases curtas. Voz ativa. Nunca use "polêmico", "importante", "controverso". Cargos com partido e estado (ex.: deputado Fulano — PP-PR). Números com fonte e data.',
  '[
    {"termo":"Método DEL","definicao":"Denso, Editorial, Local — arquitetura que combina lide 5W1H + gancho local em cada matéria."},
    {"termo":"Lide 5W1H","definicao":"Primeira frase responde O QUÊ + QUEM + QUANDO + ONDE em até 30 palavras; COMO e POR QUÊ vão no 2º parágrafo."},
    {"termo":"Gancho paranaense","definicao":"Todo assunto nacional/internacional traz, até o 3º parágrafo, o impacto para o Paraná (bancada, cidades, setor produtivo, câmbio)."}
  ]'::jsonb,
  '[
    {"sigla":"Sesa","significado":"Secretaria Estadual de Saúde do Paraná"},
    {"sigla":"Seed-PR","significado":"Secretaria da Educação do Paraná"},
    {"sigla":"IAT","significado":"Instituto Água e Terra (órgão ambiental do PR)"},
    {"sigla":"Deral","significado":"Departamento de Economia Rural da Seab-PR"},
    {"sigla":"Ipardes","significado":"Instituto Paranaense de Desenvolvimento Econômico e Social"},
    {"sigla":"Copel","significado":"Companhia Paranaense de Energia"},
    {"sigla":"Sanepar","significado":"Companhia de Saneamento do Paraná"},
    {"sigla":"DER-PR","significado":"Departamento de Estradas de Rodagem do Paraná"},
    {"sigla":"Alep","significado":"Assembleia Legislativa do Paraná"},
    {"sigla":"TCE-PR","significado":"Tribunal de Contas do Estado do Paraná"},
    {"sigla":"MP-PR","significado":"Ministério Público do Paraná"},
    {"sigla":"TJ-PR","significado":"Tribunal de Justiça do Paraná"},
    {"sigla":"UBS","significado":"Unidade Básica de Saúde"},
    {"sigla":"PSS","significado":"Processo Seletivo Simplificado (contratação temporária)"}
  ]'::jsonb,
  '[]'::jsonb,
  '[
    {"nome":"Governo do Paraná","tipo":"executivo estadual"},
    {"nome":"Assembleia Legislativa do Paraná","tipo":"legislativo estadual"},
    {"nome":"Tribunal de Justiça do Paraná","tipo":"judiciário estadual"}
  ]'::jsonb
)
on conflict (singleton) do nothing;
