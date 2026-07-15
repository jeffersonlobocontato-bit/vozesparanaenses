# Entrevista publieditorial via chat com IA

Hoje `/publieditorial/$token` mostra um formulário com 6 campos fixos, tudo de uma vez. Vamos trocar por um **chat conversacional** onde um agente IA conduz a entrevista pergunta por pergunta, pede aprofundamento quando a resposta é rasa, e só encerra quando tem material suficiente pra escrever a matéria.

## Experiência do cliente

1. Abre o link → vê uma tela de chat (não formulário) com a marca da campanha no topo.
2. Mensagem inicial do agente se apresenta ("Sou o redator do Vozes Paranaenses, vou te fazer algumas perguntas pra escrever sua matéria…") e faz a **1ª pergunta** (nome da empresa/marca).
3. Cliente responde em linguagem natural. Agente:
   - Se a resposta for muito curta/vaga → pergunta de aprofundamento ("me conta mais sobre X", "tem algum número que comprove isso?").
   - Se estiver ok → passa pra próxima etapa.
4. Cobre os 6 blocos que já existem hoje (Quem são, Contexto, Diferenciais, Evidências, Impacto, Fechamento) + CTA/link.
5. Quando o agente considera todos os blocos preenchidos, envia uma mensagem final ("Recebi tudo, sua matéria já entrou em produção") e dispara a geração.
6. Se o cliente reabrir o link depois: vê o histórico do chat e o status (em produção / publicada).

## Como o agente conduz

Um único system prompt (no server) instrui o modelo a:
- Fazer **uma pergunta por vez**, tom cordial e direto, sempre em PT-BR.
- Manter mentalmente um checklist dos 6 blocos + nome_anunciante + link_destino.
- Aprofundar quando a resposta for genérica ("somos os melhores"), pedir exemplos concretos, números, nomes, datas.
- Nunca inventar dado — se cliente não tem, seguir em frente.
- Quando todos os blocos estiverem cobertos, chamar a **tool `finalizar_briefing`** com os campos consolidados (mesmo shape do form atual: `nome_anunciante, o_que_faz, contexto_mercado, diferenciais, evidencias, impacto_leitor, cta_texto, link_destino`).
- Enquanto não finalizar, só responde com a próxima pergunta.

Ao receber a tool call, o servidor:
1. Salva os campos consolidados em `publieditorial_briefings` (mesmas colunas de hoje).
2. Marca `status='preenchido'`.
3. Dispara `generate-publieditorial` (fluxo já existente — sem mudança).
4. Devolve mensagem final pro chat.

## O que muda tecnicamente

### Backend
- **Nova migration** `039_publieditorial_chat.sql`: cria `publieditorial_chat_messages (id, briefing_id, role, content, criado_em)` + GRANTs + RLS (leitura/escrita só via service role — as edge functions abaixo cuidam).
- **Nova edge function `publieditorial-chat`** (Deno, no projeto Lovable):
  - `POST { token, mensagem }` → carrega briefing + histórico, chama Lovable AI Gateway (`google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions`, formato tool-calling), grava mensagem do usuário e resposta do assistente, e se vier `finalizar_briefing`: preenche as colunas do briefing, muda status pra `preenchido` e chama `generate-publieditorial` (mesma URL interna já usada em `classify-and-quota`).
  - `POST { token, init: true }` → se ainda não tem histórico, gera a primeira mensagem do agente.
- **`publieditorial-obter`**: passa a devolver também o histórico do chat (`chat_messages: [{role, content}]`) além do briefing.
- **`publieditorial-preencher`**: mantém como fallback (não é mais chamado pelo front, mas fica pra compatibilidade).
- Estimativa: `google/gemini-2.5-flash` (barato, já usado no projeto — ver `classify-and-quota`).

### Frontend
- Reescrever `src/routes/publieditorial.$token.tsx`:
  - Remover formulário atual.
  - Renderizar bolhas de chat (usuário à direita, agente à esquerda) com histórico vindo do `publieditorial-obter`.
  - Campo de texto embaixo + botão enviar; Enter envia, Shift+Enter quebra linha.
  - Auto-scroll pro fim; indicador "digitando…" enquanto espera resposta.
  - Ao receber mensagem final do agente (flag `finalizado: true` na resposta), trava o input e mostra o card verde "Respostas recebidas!" que já existe hoje.
  - Se `briefing.status` já for `preenchido`/`gerado` ao carregar, mostra card verde direto (comportamento atual preservado).
- Mantém header/rodapé, cor `#0066CC`/`#0A2540`, `noindex,nofollow`.

### Admin
- Nenhuma mudança visível em `/admin/anuncios` → aba publieditorial. Continua criando links do mesmo jeito.

## Fora de escopo
- Não muda `generate-publieditorial` nem o fluxo de aprovação/publicação.
- Não muda o schema atual de `publieditorial_briefings` (colunas continuam sendo preenchidas pelo agente ao finalizar).
- Não adiciona upload de arquivo/foto no chat.
