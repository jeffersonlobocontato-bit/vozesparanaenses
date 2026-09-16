-- =====================================================================
-- Vozes Paranaenses — 065_entrevista_jefferson_geo.sql
-- Entrevista com Jefferson Lobo sobre GEO e reputação na busca
-- generativa, seguindo o mesmo tema de matéria publicada no Valor
-- Econômico (Regina Moura, Roche Farma) — nenhum texto daquela
-- entrevista foi reproduzido, é uma entrevista nova e distinta.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

do $$
declare
  v_cat_id uuid;
  v_regiao_id uuid;
begin
  select id into v_cat_id from public.editorial_categories where slug = 'tecnologia';
  select id into v_regiao_id from public.regioes where slug = 'nacional';

  if v_cat_id is null then
    raise exception 'Categoria "tecnologia" não encontrada.';
  end if;
  if v_regiao_id is null then
    raise exception 'Região "nacional" não encontrada.';
  end if;

  if not exists (select 1 from public.generated_articles where slug = 'o-clique-perdeu-a-coroa-quem-manda-agora-e-a-citacao') then
    insert into public.generated_articles (titulo, subtitulo, slug, corpo, categoria_id, regiao_id, status, publicado_automaticamente, gerado_em, publicado_em)
    values (
      'O clique perdeu a coroa. Quem manda agora é a citação',
      'Jefferson Lobo, especialista em IA e Método DEL, defende que reputação estruturada — não tráfego — é o novo indicador que decide quem sobrevive na busca generativa',
      'o-clique-perdeu-a-coroa-quem-manda-agora-e-a-citacao',
      'Há um ano, medir sucesso digital era simples: quem tinha mais clique, ganhava. Hoje, segundo o palestrante e especialista em inteligência artificial Jefferson Lobo — autor do livro "O Código Invisível dos Superagentes de Inteligência Artificial" e head executivo de Marketing e Inteligência Artificial do Sistema Fiep —, essa régua já não serve mais pra boa parte do que acontece na internet. Em conversa com o Vozes Paranaenses, ele defende que o critério que hoje decide se uma marca, uma empresa ou até um portal de notícia existe ou não pra IA generativa não é mais o clique — é a reputação estruturada, aquilo que o ChatGPT, o Gemini ou o Perplexity conseguem citar com confiança quando alguém pergunta sobre você.

Vozes Paranaenses: Você defende que a métrica mudou. Do clique pra quê, exatamente?

Jefferson Lobo: Pra reputação verificável — e faço questão da palavra "verificável", porque não é reputação no sentido vago de "boa imagem de marca". É reputação no sentido técnico: você é citado porque o sistema de IA consegue confirmar, em múltiplas fontes, que aquilo que você diz sobre si mesmo é consistente com o que terceiros dizem sobre você. O clique media atenção. A citação em resposta de IA mede confiança. São dois jogos completamente diferentes, e boa parte do mercado ainda está jogando o primeiro enquanto o segundo já decide quem aparece.

Isso é teoria ou você já viu isso na prática?

Bem prática, inclusive num projeto que acompanho de perto: o Vozes Paranaenses, portal de notícias regional do Paraná. Construímos ele desde o primeiro dia pra ser lido por máquina, não só por gente — schema estruturado em toda matéria, arquivo llms.txt liberando explicitamente o rastreamento de IA, conteúdo formatado em "resposta primeiro". Resultado: em poucas semanas de existência, o portal já aparece com posição de busca melhor que muita gente com anos de operação — não porque tem mais tráfego, tem muito menos, mas porque tem estrutura que a IA consegue confiar e citar.

A entrevista que motivou essa conversa cita o conceito de GEO, Generative Engine Optimization. Como você explica isso pra quem nunca ouviu falar?

SEO você otimiza pra aparecer numa lista de dez links azuis. GEO você otimiza pra ser a frase que a IA decide repetir quando alguém pergunta algo relacionado a você — sem link nenhum, muitas vezes. É uma mudança de alvo, não só de técnica: você para de competir por clique e passa a competir por ser a fonte que a máquina julga confiável o suficiente pra citar sem checar de novo.

E qual o erro mais comum que você vê empresa cometendo nessa transição?

Tratar isso como truque de prompt — o que eu chamo, em quase toda palestra que dou, de "cardápio mágico": a ideia de que existe uma frase mágica que resolve. Reputação estruturada não se constrói com prompt esperto. Se constrói com linguagem consistente, repetida da mesma forma em todo lugar onde sua marca aparece — no site, no LinkedIn, na imprensa, no depoimento de cliente. É exatamente o que sistematizei no Método DEL: decompor a comunicação da empresa em estrutura sintática, semântica e lexical, e manter essa estrutura coerente em todo canal. IA generativa recompensa consistência, não criatividade pontual.

Pra fechar: se reputação virou "condição pra operar", como você costuma dizer em suas falas, o que uma empresa paranaense de médio porte deveria fazer amanhã de manhã?

Primeiro passo, o mais barato e mais ignorado: perguntar pra três ou quatro IAs diferentes "o que você sabe sobre [nome da empresa]" e comparar as respostas. Se elas divergem entre si, ou divergem do que a empresa diz sobre si mesma no próprio site, esse é o buraco a fechar antes de qualquer investimento em mídia. Não adianta comprar visibilidade se a base de confiança que sustenta essa visibilidade ainda está rachada.',
      v_cat_id, v_regiao_id, 'publicado', false, now(), now()
    );
  end if;
end $$;
