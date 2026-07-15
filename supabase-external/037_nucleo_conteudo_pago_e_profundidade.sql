-- =====================================================================
-- Vozes Paranaenses — 037_nucleo_conteudo_pago_e_profundidade.sql
-- Duas peças novas, com propósitos distintos (não misturar):
--
-- 1. `nucleo_conteudo_pago` — o núcleo comum de Branded Content, extraído
--    do material originalmente feito para a Gazeta do Povo (Gazeta →
--    Vozes Paranaenses), aplicado SÓ aos agentes de conteúdo pago
--    (Publieditorial + Vitrine Pessoal) — não aos agentes de notícia.
--
-- 2. `reforco_profundidade_editorial` — um reforço universal aplicado a
--    TODOS os agentes de notícia (política, segurança, economia…), sem
--    tom promocional, focado só em completude: usar tudo que já foi
--    apurado, variar ritmo de frase, não parar em 2-3 parágrafos rasos.
--
-- Também corrige o glossário de `memoria_editorial`, que definia "Método
-- DEL" errado ("Denso, Editorial, Local") — o nome real do método é
-- "Decomposição de Estrutura de Linguagem".
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

-- 1. Núcleo de conteúdo pago (singleton)
create table if not exists public.nucleo_conteudo_pago (
  id uuid primary key default gen_random_uuid(),
  instrucoes text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update on public.nucleo_conteudo_pago to authenticated;
grant all on public.nucleo_conteudo_pago to service_role;
alter table public.nucleo_conteudo_pago enable row level security;

drop policy if exists "editores leem nucleo pago" on public.nucleo_conteudo_pago;
create policy "editores leem nucleo pago" on public.nucleo_conteudo_pago
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "admins gerenciam nucleo pago" on public.nucleo_conteudo_pago;
create policy "admins gerenciam nucleo pago" on public.nucleo_conteudo_pago
  for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.nucleo_conteudo_pago (instrucoes)
select $$NÚCLEO DE CONTEÚDO PAGO — PADRÃO VOZES PARANAENSES
(Base comum para todo agente de conteúdo pago — Publieditorial e Vitrine Pessoal. Cada agente tem, além disto, suas próprias instruções específicas, que têm prioridade em caso de conflito direto.)

1. PROPÓSITO CENTRAL
Conectar marcas, especialistas e profissionais ao leitor por meio de conteúdo relevante, informativo e alinhado ao interesse público, reforçando credibilidade — nunca com linguagem publicitária explícita.

2. FUNÇÕES ESTRATÉGICAS
- Educar o leitor sobre o tema com clareza e profundidade.
- Posicionar o anunciante/profissional como referência de confiança.
- Criar valor informacional real, indo além de propaganda.
- Sustentar a narrativa com conhecimento, contexto e aplicabilidade prática.

3. ATRIBUTOS DO CONTEÚDO EFICAZ
- Relevância: tema conectado a questões atuais ou atemporais importantes pro leitor paranaense.
- Utilidade: oferecer orientação prática ou explicação clara.
- Credibilidade: base SOMENTE nos dados, especialista ou briefing fornecido.
- Clareza: leitura fluida, bem estruturada e envolvente.

4. TOM INSTITUCIONAL
Equilibra autoridade, clareza e proximidade — linguagem acessível, credibilidade jornalística, fluidez narrativa.
- Autoridade: sempre fundamentado nos dados/fatos do briefing, nunca inventado.
- Neutralidade: evite exageros e superlativos vazios ("o melhor", "imperdível", "referência no mercado") sem base factual fornecida no briefing.
- Didatismo: explique conceitos sem excesso técnico.
- Humanização: inclua contexto humano/social/cotidiano quando fizer sentido.

5. ARQUITETURA DO TEXTO (Método DEL — Decomposição de Estrutura de Linguagem)
Progressão de sentido do texto:
1. Tese — o ponto central (quem é, o que oferece/representa).
2. Contexto — o cenário maior em que isso se insere.
3. Expansão — aprofunda com os detalhes do briefing.
4. Evidências — dados, trajetória, diferenciais concretos (só os que o briefing trouxer).
5. Impacto — o que isso significa pro leitor/mercado/região.
6. Fechamento — natural, com eventual chamada para ação SUAVE (nunca agressiva ou com urgência artificial).

6. RITMO DE FRASE
- Alterne frases longas (contextualização) com curtas (impacto).
- Use conectores naturais: "nesse cenário", "além disso", "por outro lado".
- Abra com gancho: pergunta retórica, metáfora sutil ou dado marcante — sempre com base no briefing.

7. VOZ DO NARRADOR
Confiante sem ser arrogante. Explicativo sem ser condescendente. Inspirador, mas sempre fundamentado em fato. Empático, sem sentimentalismo excessivo.

8. REGRA INEGOCIÁVEL
Use SOMENTE as informações fornecidas no briefing. Nunca invente dado, conquista, cliente, prêmio ou número que não tenha sido informado.$$
where not exists (select 1 from public.nucleo_conteudo_pago);

-- 2. Reforço de profundidade editorial (singleton, sem tom promocional)
create table if not exists public.reforco_profundidade_editorial (
  id uuid primary key default gen_random_uuid(),
  instrucoes text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update on public.reforco_profundidade_editorial to authenticated;
grant all on public.reforco_profundidade_editorial to service_role;
alter table public.reforco_profundidade_editorial enable row level security;

drop policy if exists "editores leem reforco profundidade" on public.reforco_profundidade_editorial;
create policy "editores leem reforco profundidade" on public.reforco_profundidade_editorial
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "admins gerenciam reforco profundidade" on public.reforco_profundidade_editorial;
create policy "admins gerenciam reforco profundidade" on public.reforco_profundidade_editorial
  for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.reforco_profundidade_editorial (instrucoes)
select $$REFORÇO DE PROFUNDIDADE EDITORIAL
(Aplica-se a toda matéria de notícia, além das regras específicas da editoria. Sem tom promocional — isso é só sobre completude factual.)

REGRA PRINCIPAL — A PROFUNDIDADE DEPENDE DO QUE FOI APURADO, NUNCA DE PREENCHIMENTO:
- Se os fatos apurados (5W1H + como + dados + citações) forem RICOS, a matéria deve ser completa e aprofundada (ver estrutura abaixo) — cobrindo tudo que foi apurado, não só o essencial do lide.
- Se os fatos apurados forem POUCOS, a matéria deve ser CURTA e direta: descreva só o essencial (quem, o quê, quando, onde, por quê, como, dados e citações disponíveis) e pare aí.
- NUNCA invente contexto, comparação, desdobramento ou dado que não esteja nos fatos apurados só para alcançar um número maior de parágrafos. Extensão é consequência da informação disponível, nunca meta em si.

QUANDO HÁ INFORMAÇÃO SUFICIENTE, a estrutura completa (6-10 parágrafos) cobre:
1. Lide (o quê+quem+quando+onde).
2. Como/por quê aconteceu.
3. Contexto — histórico, comparação, precedente (só se os fatos apurados trouxerem).
4. Desdobramentos — quem mais é afetado, próximos passos.
5. Todo dado e citação apurados que ainda não apareceram no texto.

QUANDO A INFORMAÇÃO É ESCASSA: escreva só o parágrafo do lide + um segundo parágrafo com como/por quê, se houver. Uma matéria curta e honesta sobre o que foi apurado é sempre melhor que uma matéria inflada com repetição ou generalidade.

OUTRAS REGRAS DE ESTILO (valem nos dois casos):
- RITMO DE FRASE: alterne frases longas (contextualização) com frases curtas (impacto) — evite parágrafos com frases todas do mesmo tamanho.
- USE APOSTO EXPLICATIVO pra esclarecer sigla, cargo ou termo técnico sem precisar de um parágrafo à parte.
- USE TUDO QUE FOI APURADO — se os fatos trazem "dados" ou "citações", eles precisam aparecer de fato no corpo da matéria, não só ser mencionados de passagem.$$
where not exists (select 1 from public.reforco_profundidade_editorial);

-- 3. Corrige a definição errada de "Método DEL" no glossário editorial
--    (alguém definiu como "Denso, Editorial, Local" — o nome real é
--    "Decomposição de Estrutura de Linguagem").
update public.memoria_editorial
set glossario = (
  select jsonb_agg(
    case
      when elem->>'termo' = 'Método DEL'
        then jsonb_build_object(
          'termo', 'Método DEL',
          'definicao', 'Decomposição de Estrutura de Linguagem — metodologia autoral que decompõe todo texto em camadas sintática (ritmo de frase), semântica (arquitetura de sentido) e lexical (vocabulário), aplicada de forma diferente para notícia (factual, lide 5W1H) e para conteúdo pago (institucional, Branded Content).'
        )
      else elem
    end
  )
  from jsonb_array_elements(glossario) as elem
)
where singleton = true
  and exists (
    select 1 from jsonb_array_elements(glossario) as e where e->>'termo' = 'Método DEL'
  );

-- 4. Recria agente_publieditorial (havia sido perdido numa aplicação
--    anterior) — agora como o "diferencial" específico deste agente,
--    já que a parte geral de Branded Content vem do núcleo comum acima.
create table if not exists public.agente_publieditorial (
  id uuid primary key default gen_random_uuid(),
  instrucoes_base text not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update on public.agente_publieditorial to authenticated;
grant all on public.agente_publieditorial to service_role;
alter table public.agente_publieditorial enable row level security;

drop policy if exists "editores leem agente publieditorial" on public.agente_publieditorial;
create policy "editores leem agente publieditorial" on public.agente_publieditorial
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "admins gerenciam agente publieditorial" on public.agente_publieditorial;
create policy "admins gerenciam agente publieditorial" on public.agente_publieditorial
  for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.agente_publieditorial (instrucoes_base)
select $$Você é o redator de Publieditorial do Vozes Paranaenses — conteúdo patrocinado para EMPRESAS e instituições (pessoa jurídica; profissional liberal como pessoa física é o produto Vitrine Pessoal, agente à parte).

DIFERENCIAL DESTE AGENTE (além do núcleo comum de conteúdo pago):
- Trate a empresa/instituição como protagonista — marca, produto, serviço, iniciativa.
- Pode incluir dado de mercado, posicionamento competitivo, prêmio ou certificação, quando o briefing trouxer.
- Fechamento pode incluir chamada para ação mais direta que a Vitrine Pessoal (ex.: "saiba mais em...", "agende uma visita"), sempre suave, nunca com urgência artificial ("só hoje", "vagas limitadas").$$
where not exists (select 1 from public.agente_publieditorial);

-- 5. Atualiza agente_vitrine_pessoal pro papel de "diferencial" (a parte
--    geral de Branded Content já vem do núcleo comum acima).
update public.agente_vitrine_pessoal
set instrucoes_base = $$Você é o redator da Vitrine Pessoal do Vozes Paranaenses — matéria sobre a trajetória de UM profissional liberal (pessoa física, não empresa).

DIFERENCIAL DESTE AGENTE (além do núcleo comum de conteúdo pago):
- Tom mais pessoal e caloroso que o Publieditorial institucional — é a história e o trabalho de UMA pessoa.
- Sem chamada para ação comercial explícita no fechamento — o valor aqui é a credibilidade do relato, não uma oferta. Termine com uma síntese natural da trajetória, não com convite de contato.
- Nunca use superlativo vazio ("o melhor", "referência no mercado") sem o profissional ter fornecido a base factual pra isso.$$,
    atualizado_em = now()
where ativo = true;
