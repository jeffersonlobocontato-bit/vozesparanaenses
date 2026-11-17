# Consumo medido de IA · Entrega 1

## Ativação pendente

1. Aplicar `supabase-external/099_ia_uso.sql` **no banco externo de conteúdo**. O banco gerenciado pela ferramenta de migração desta conversa é o banco de login/e-mail, não o banco externo; por isso a migração foi preparada, não aplicada no lugar errado.
2. Implantar as 18 funções alteradas e publicar o app. A medição começa a partir dessas chamadas, sem preencher novembro retroativamente.
3. Com um administrador do banco externo, abrir `/admin/custos` e conferir o registro de uma chamada real. Esse teste autenticado ainda não foi realizado: a sessão gerenciada disponível pertence ao banco de login, não ao painel externo.

## Inventário de modelos por função

Inclui chamadas indiretas dos helpers. Nenhum modelo/prompt foi trocado.

| Função | Modelos |
|---|---|
| cluster-articles | openai/text-embedding-3-small; google/gemini-2.5-flash-lite (duplicidade) |
| classify-and-quota | google/gemini-2.5-flash-lite |
| extract-facts | google/gemini-2.5-flash |
| generate-article | google/gemini-2.5-flash; google/gemini-2.5-flash-lite; google/gemini-2.5-flash-image |
| generate-article-image | google/gemini-2.5-flash-image |
| analista-imagem-curadoria | google/gemini-2.5-flash; google/gemini-2.5-flash-image |
| publish-article | google/gemini-2.5-flash |
| imprensa-gerar-rascunho | google/gemini-2.5-flash |
| imprensa-publicar | google/gemini-2.5-flash |
| instagram-selecionar | google/gemini-2.5-flash |
| coluna-escrever | google/gemini-2.5-pro |
| generate-publieditorial | google/gemini-2.5-pro |
| vitrine-pessoal-criar | google/gemini-2.5-pro |
| sales-chat | google/gemini-2.5-pro |
| publieditorial-chat | google/gemini-2.5-flash |
| vitrine-pessoal-chat | google/gemini-2.5-flash |
| publieditorial-transcrever | openai/gpt-4o-mini-transcribe |
| vitrine-pessoal-transcrever | openai/gpt-4o-mini-transcribe |
| publicar-tecnologia-periodico (rota do app) | google/gemini-2.5-flash |

As demais funções não chamam o Gateway diretamente; os encadeamentos são medidos na função executora.

## Preços consultados em 17/11/2026

USD por milhão de tokens (entrada / saída), preços padrão dos provedores:

- Gemini 2.5 Flash-Lite: 0,10 / 0,40; entrada de áudio 0,30; cache 0,01.
- Gemini 2.5 Flash: 0,30 / 2,50; entrada de áudio 1,00; cache 0,03.
- Gemini 2.5 Pro: 1,25 / 10,00; acima de 200 mil tokens de entrada, 2,50 / 15,00; cache curto 0,125.
- Gemini 2.5 Flash Image: entrada 0,30; texto de saída 2,50; imagem 0,039. Tokens da imagem não são cobrados novamente como texto.
- Text Embedding 3 Small: entrada 0,02.
- GPT-4o Mini Transcribe: entrada de texto 1,25 / saída 5,00; entrada de áudio 3,00.

Fontes: https://ai.google.dev/gemini-api/docs/pricing e https://developers.openai.com/api/docs/pricing.
O catálogo autenticado do Gateway não foi consultado: a chave privada só está disponível no serviço hospedado, não no ambiente de execução desta conversa. Os valores são cálculo pelo uso informado e tabela de preços, não conciliação exata de créditos/fatura. Atualizar a tabela se o provedor mudar a tarifa ou o roteamento; os preços de chamadas antigas permanecem preservados.

## Segurança e dados desconhecidos

- `ia_uso`, preços e relatórios: somente administrador; escrita de uso exclusivamente pelo serviço.
- Nenhum prompt, resposta ou mensagem de erro do provedor é persistido. Somente códigos seguros de falha.
- Uso ausente, modelo sem preço e falha sem tokens ficam com custo `NULL`, não zero. Totais parciais são sinalizados.
- Ontem e últimos sete dias completos usam Brasília; custo por matéria usa total agregado / quantidade realmente publicada, não média das médias diárias.
- Não há alteração de critérios de coleta, deduplicação, crivo, criticidade, Método DEL ou publicação.