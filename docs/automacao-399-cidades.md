# Automação das 399 cidades do Paraná

Objetivo: o portal cobre sozinho as 399 cidades do PR, com notícias **do dia**, sem repetir notícias e sem risco de foto. A revisão humana fica só para o que tiver risco editorial.

## Decisões editoriais (out/2026)

| Tema | Regra |
|---|---|
| Fontes | Por cidade: site oficial da prefeitura + pelo menos 1 veículo local. Veículo regional pode cobrir várias cidades. |
| Varredura | Dois ciclos por dia: **11h e 18h** (Brasília). |
| Validador | **Data de publicação da fonte.** Só entra o que foi publicado HOJE. Sem data identificável = descartado. |
| Repetição | Nunca: hash da URL+título na coleta, agrupamento por similaridade e checagem contra tudo o que foi selecionado nas últimas 72h (`cluster_duplicado`). |
| Região | Pela **cidade de que a notícia fala**, nunca pela cidade do jornal. Palotina em jornal de Curitiba = Oeste. |
| Foto | Só foto com crédito de assessoria, divulgação, prefeitura/município, governo ou foto pública. Crédito pessoal, de outro veículo ou sem crédito: a foto da fonte **não** é usada. |
| Crivo | Prioridade **alta**: serviço, utilidade pública, saúde, educação, segurança. **Baixa**: evento e propaganda de governo. **Média**: o resto. Define a ordem da fila, a cota e a criticidade — não o formato. |
| Destino (out/2026) | Pela **origem**: release de **prefeitura** → sempre **nota** na coluna regional. Notícia de **portal/veículo** → sempre **matéria**; com foto liberada sai com a foto, sem foto liberada sai **sem capa e vai para o VAPT-VUPT** (sem foto geral da cidade). Portal que estoura a cota é descartado (portal nunca vira nota). |
| Coluna | Uma coluna por **região**: **"Vozes {Região}"** (`/vozes/{regiao}`), em formato blog, com as notas de todas as cidades da região. Cada nota abre com o nome da cidade, que filtra a coluna (`/vozes/{regiao}?cidade={cidade}`). A página da cidade mostra as notas dela. `/vozes/{cidade}` antigo redireciona para a região filtrada. |
| Home | Módulo **Colunas**: Vozes Políticas fixa no primeiro card; as demais (opinião e regionais) se alternam pela que recebeu post por último. |
| Publicação | Automática. O **agente de criticidade** manda para revisão humana tudo o que tem risco médio ou maior. |

## Fluxo

```
cron 11h/18h (lotes a cada 3 min, janela de 2h)
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

São 62 casos cobrindo região pela cidade (Palotina/Curitiba, sobrenome "Castro", "festa de São João"), crédito de foto, data do dia (fuso, JSON-LD, texto, URL), ciclos 11h/18h, gatilhos de criticidade (sem travar "casos suspeitos de dengue", "candidatos do concurso", "vacinação de crianças") e decisão matéria/nota.

## Pendências conhecidas

- **Mapeamento das fontes**: 18 prefeituras e 42 veículos cadastrados para 399 cidades. A maioria das prefeituras segue `https://www.{cidade}.pr.gov.br`. Falta um script de descoberta e verificação, além da curadoria dos veículos locais.
- **Sites com JavaScript/anti-bot**: usam Firecrawl (custo por página). Em escala, avaliar um leitor por fornecedor de site de prefeitura (vários municípios usam a mesma plataforma).
- **Cotas** (`quota_rules`): foram calibradas para 41 cidades. Com 399, cota estourada vira nota (não descarta), mas vale revisar os tetos.
