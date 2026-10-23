# Automação das 399 cidades do Paraná

Objetivo: o portal cobre sozinho as 399 cidades do PR, com notícias **do dia**, sem repetir notícias e sem risco de foto. A revisão humana fica só para o que tiver risco editorial.

## Decisões editoriais (out/2026)

| Tema | Regra |
|---|---|
| Fontes | Por cidade: site oficial da prefeitura + pelo menos 1 veículo local. Veículo regional pode cobrir várias cidades. |
| Varredura | Horários alternados por frente (Brasília, `076_horarios_alternados_por_frente.sql`): nacional/internacional **7h e 14h**, portais **10h, 16h e 21h**, prefeituras **12h e 18h**, tecnologia **14h** (1 publicação por dia), esportes **21h**. Processamento (agrupar, crivo, escrever) das 7h às 23h. |
| Validador | **Data de publicação da fonte.** Só entra o que foi publicado HOJE. Sem data identificável = descartado. |
| Repetição | Nunca: hash da URL+título na coleta, agrupamento por similaridade e checagem contra tudo o que foi selecionado nas últimas 72h (`cluster_duplicado`). |
| Região | Pela **cidade de que a notícia fala**, nunca pela cidade do jornal. Palotina em jornal de Curitiba = Oeste. |
| Foto | Só foto com crédito de assessoria, divulgação, prefeitura/município, governo ou foto pública. Crédito pessoal, de outro veículo ou sem crédito: a foto da fonte **não** é usada. |
| Crivo | Prioridade **alta**: serviço, utilidade pública, saúde, educação, segurança. **Baixa**: evento e propaganda de governo. **Média**: o resto. Define a ordem da fila, a cota e a criticidade — não o formato. |
| Destino (out/2026) | Pela **origem**. Release de **prefeitura**: com foto → **matéria**; sem foto (ou cota estourada) → **nota** na coluna regional. Notícia de **portal/veículo** → sempre **matéria**; sem foto liberada sai **sem capa e vai para o VAPT-VUPT** (sem foto geral da cidade). Portal que estoura a cota é descartado (portal nunca vira nota). |
| Portais/jornais (out/2026) | Fora: release de **assessoria de prefeitura** (já coletamos da própria prefeitura), notícia **nacional/internacional** e **crítica política** sobre a cidade (crivo por IA + pistas no texto/crédito, `motivoDescartePortal`). Só notícia do dia, sem repetir entre portais (agrupamento + `cluster_duplicado`). Notícia do estado do Paraná sem cidade específica continua entrando. |
| Imagem (out/2026) | `decidirImagem`: prefeitura → foto dela; portal → foto com crédito institucional, senão **ilustração por IA** (tema geral, gerada só do tema, identificada como IA, sem pessoas/crianças/marcas) ou **foto real da cidade** (Wikimedia Commons, licença livre, categoria da cidade conferida em "Municipalities in Paraná", cache em `cidades.foto_geral_url`); fato específico sem foto → VAPT-VUPT. **Esportes, nacional, internacional e tecnologia: só texto.** Recriar foto de terceiro com IA foi desligado. |
| Analista de imagem (nacional/internacional) | `analista-imagem-curadoria` (cron 075, de meia em meia hora, 8h–22h) garante **1 matéria nacional e 1 internacional** (temas gerais e política) com imagem de risco baixo nas últimas 12h: a IA planeja a busca (lugar/instituição, nunca pessoas), busca fotos de licença livre no Wikimedia Commons, **olha cada foto** e dá nota de risco (crianças, vítimas, pessoas identificáveis, marcas, foto que pareça o registro do fato → alto); usa a de risco baixo, senão ilustração por IA; tema sensível (morte, guerra, crime) fica sem imagem. Decisão em `generated_articles.imagem_analise`. A home reserva uma lateral da primeira dobra para nacional e outra para internacional quando houver (24h). |
| Curadoria | Esportes, nacional e internacional passam pelo crivo e **publicam sozinhos** nos ciclos (só texto, fora da primeira dobra). |
| Título | Nunca "Prefeitura" (nem "Município de", "Administração municipal"). Com cidade identificada, a cidade aparece como **tag** (página da matéria, cards da home, VAPT-VUPT, coluna) e o título traz só o fato — cidade e prefeitura vão para o lide; exceção quando a cidade é indispensável. Sem cidade identificada, o nome da cidade pode entrar. O SEO title pode citar a cidade. Regra no prompt + conferência e reescrita do título em `_shared/titulo.ts`. |
| Primeira dobra da home | Matéria de **portal** sempre pode entrar; matéria de **prefeitura só das 20 maiores cidades** (`cidades.destaque_home`, Censo 2022 — editável sem deploy). As demais aparecem nas páginas de região, cidade e editoria. Matéria fixada pelo editor sempre pode. Ver `072_dobra_home_20_maiores.sql`. |
| Coluna | Uma coluna por **região**: **"Vozes {Região}"** (`/vozes/{regiao}`), em formato blog, com as notas de todas as cidades da região. Cada nota abre com o nome da cidade, que filtra a coluna (`/vozes/{regiao}?cidade={cidade}`). A página da cidade mostra as notas dela. `/vozes/{cidade}` antigo redireciona para a região filtrada. |
| Home | Módulo **Colunas**: Vozes Políticas fixa no primeiro card; as demais (opinião e regionais) se alternam pela que recebeu post por último. |
| Publicação | Automática. O **agente de criticidade** manda para revisão humana tudo o que tem risco médio ou maior. |

## Fluxo

```
cron por frente (lotes a cada 3–10 min, janela de 2h por ciclo)
  scrape-prefeitura / scrape-source        _shared/coleta.ts
    ├─ data do dia? (RSS → URL → página: meta, JSON-LD, <time>, texto)   _shared/data-publicacao.ts
    ├─ cidade citada → região                                            _shared/cidades.ts
    ├─ crédito da foto → autorizada | proibida | sem_credito | sem_foto  _shared/foto-credito.ts
    └─ raw_articles
  cluster-articles     agrupa por similaridade (agora também os releases oficiais)
  classify-and-quota   editoria + crivo (1 chamada de IA) · repetição 72h · cota estourada → nota
  process-pending-clusters → extract-facts → generate-article (modo automático)
    ├─ cidade/região = cidade_principal apurada pela IA
    ├─ decidirFormato (origem): prefeitura → nota | portal → matéria   _shared/crivo-editorial.ts
    ├─ matéria (portal): foto autorizada ou sem capa (VAPT-VUPT)
    ├─ nota (prefeitura): texto curto → coluna "Vozes {Região}"        _shared/nota-coluna.ts
    └─ criticidade → publica ou fila de revisão             _shared/criticidade.ts
```

Chamadas feitas por um editor ("Escrever agora", matéria manual, tecnologia) continuam gerando **matéria em rascunho**, com a foto geral da cidade como reserva. A regra da foto e a criticidade valem sempre. O destino por origem e a publicação automática valem só no modo automático.

A migration `070_colunas_regionais.sql` cria as colunas regionais e converteu em nota as matérias de prefeitura que estavam publicadas sem foto: a matéria saiu do ar (`expirado`) e o endereço antigo redireciona para a nota (`coluna_cidade_notas.artigo_origem_slug`).

## Onde a revisão humana entra

- Matérias: `/admin` → aba **rascunho**. O aviso "Criticidade …" mostra os motivos.
- Notas: `/admin/notas-cidades` → **Em revisão** (Publicar / Rejeitar).
- Ajuste do agente sem deploy: tabela `agente_criticidade` (`limiar_revisao`, `instrucoes_extra`, `termos_bloqueio`).
- Revisão assistida pelo Claude Code: skill `.claude/skills/criticidade-editorial`.

## Como ativar (ordem)

1. **Banco externo** ("Rede de Portais"), no SQL Editor: rodar `supabase-external/067_automacao_399_cidades.sql`. Ela cria as 399 cidades, os campos novos, a tabela de notas, as funções `garantir_coluna_cidade` / `cluster_duplicado` e o agente de criticidade.
2. **Código**: fazer o merge do branch `automacao-399` na branch conectada ao Lovable. O Lovable publica as edge functions e o site.
3. **Fotos gerais das cidades**: preencher `cidades.foto_geral_url` e `foto_geral_credito`, usando só foto própria ou de licença livre (AEN, Agência Brasil, Wikimedia Commons com atribuição). Sem isso, a matéria usa a foto da região (`regioes.hero_image_url`, hoje vazia em todas).
4. **Fontes**: cadastrar a prefeitura e o veículo local de cada cidade em `fontes`, com `cidade_slug` e `abrangencia` (`municipal` / `regional` / `estadual`).
5. **Agendamento**: preencher `v_url`/`v_key` em `supabase-external/068_cron_ciclos_11h_18h.sql` e rodar. O script se recusa a rodar com os marcadores no lugar, que foi o que parou o pipeline de 18/09 a 22/10/2026.

## Volume e custo (estimativa)

Supondo 800 fontes e 30–40% das cidades com algo novo por dia, são cerca de 300 a 600 pautas por dia. Cada pauta passa por 1 classificação (modelo barato) + 1 extração de fatos + 1 redação (matéria ou nota) + 1 criticidade. Acompanhe o saldo do Lovable AI Gateway nas primeiras semanas. Se apertar, a criticidade pode rodar só para matéria (as regras determinísticas continuam valendo para nota).

## Testes

```bash
npx deno run --allow-read supabase/functions/_shared/regras_test.ts
```

São 62 casos cobrindo região pela cidade (Palotina/Curitiba, sobrenome "Castro", "festa de São João"), crédito de foto, data do dia (fuso, JSON-LD, texto, URL), ciclos por frente, gatilhos de criticidade (sem travar "casos suspeitos de dengue", "candidatos do concurso", "vacinação de crianças") e decisão matéria/nota.

## Pendências conhecidas

- **Mapeamento das fontes**: 18 prefeituras e 42 veículos cadastrados para 399 cidades. A maioria das prefeituras segue `https://www.{cidade}.pr.gov.br`. Falta um script de descoberta e verificação, além da curadoria dos veículos locais.
- **Atende.Net (IPM)**: 51 cidades têm portal `{cidade}.atende.net`; a lista é montada com JavaScript, mas os dados vêm no HTML em base64. Leitor próprio em `_shared/atende-net.ts` (fetch comum, sem Firecrawl). 26 cidades que publicam de verdade lá foram cadastradas/corrigidas na `071_prefeituras_atende_net.sql` (levantamento de 23/10/2026). A lista estática traz só as 10 notícias mais recentes.
- **Sites com JavaScript/anti-bot**: usam Firecrawl (custo por página). Em escala, avaliar um leitor por fornecedor de site de prefeitura (vários municípios usam a mesma plataforma).
- **Cotas** (`quota_rules`): foram calibradas para 41 cidades. Com 399, cota estourada vira nota (não descarta), mas vale revisar os tetos.
