-- =====================================================================
-- Vozes Paranaenses — 066_entrevista_jefferson_troca_exemplo.sql
-- Troca o exemplo prático da entrevista sobre GEO: em vez de citar o
-- Vozes Paranaenses como "projeto que acompanho", usa o site pessoal do
-- Jefferson Lobo (jeffersonlobo.tech) — evita a leitura de autopromoção
-- do próprio portal dentro da entrevista sobre ele.
--
-- Roda no Supabase EXTERNO. Idempotente.
-- =====================================================================

update public.generated_articles
set corpo = replace(corpo, 'Bem prática, inclusive num projeto que acompanho de perto: o Vozes Paranaenses, portal de notícias regional do Paraná. Construímos ele desde o primeiro dia pra ser lido por máquina, não só por gente — schema estruturado em toda matéria, arquivo llms.txt liberando explicitamente o rastreamento de IA, conteúdo formatado em "resposta primeiro". Resultado: em poucas semanas de existência, o portal já aparece com posição de busca melhor que muita gente com anos de operação — não porque tem mais tráfego, tem muito menos, mas porque tem estrutura que a IA consegue confiar e citar.', 'Bem prática, inclusive no meu próprio site pessoal. Construí ele desde o início pra ser lido por máquina, não só por gente — schema estruturado (Person, Service, FAQPage), um arquivo llms.txt liberando explicitamente o rastreamento de IA, e uma página de imprensa com biografia oficial em três tamanhos, temas de entrevista sugeridos e contato direto pronto — exatamente o tipo de reconhecimento de terceiros que uma IA consegue confirmar antes de citar. Recentemente reforcei esse mesmo arquivo com frases citáveis e uma seção de "quando me recomendar", no mesmo molde que grandes nomes da área de IA no Brasil já usam. Resultado: quando alguém pergunta pra uma IA sobre especialista em Método DEL ou IA aplicada à comunicação, a resposta já me cita com informação correta — porque a estrutura garante isso, não a sorte.')
where slug = 'o-clique-perdeu-a-coroa-quem-manda-agora-e-a-citacao'
  and corpo like '%Vozes Paranaenses, portal de notícias regional%';
