## Panorama das frentes de monetização

Hoje o portal tem **3 caminhos de receita** previstos no código. Abaixo o estado real de cada um e o que falta para começar a faturar.

---

### 1. Venda direta (patrocínio / anunciantes locais) — 🟡 Parcial
**Pronto:**
- Painel `/admin/anuncios` com campanhas, criativos por slot (desktop/mobile), targeting geo (estado/região/cidade) e por editoria.
- Ad server próprio (`pickAd`) com cap diário, contagem de impressões e cliques, redirecionador `/r/:id`.
- Preview do encaixe do criativo no espaço.

**Pendente:**
1. **Relatório para o anunciante** — hoje impressões/cliques ficam só no banco. Falta uma tela (ou export CSV/PDF) por campanha com: impressões/dia, cliques, CTR, cidades que mais impactaram. Sem isso não dá pra prestar contas de plano vendido.
2. **Planos / pacotes comerciais** — não existe noção de "plano" (ex.: 30 dias, 10k impressões/dia em Curitiba). Hoje é tudo manual no cadastro. Precisa: campo `plano` na campanha + limitador de impressões total (não só diário).
3. **Onboarding do anunciante** — não há fluxo público de "quero anunciar". Página `/anuncie` com formulário + tabela de preços + envio pro admin. 
4. **Faturamento** — nenhum. Decidir: cobrar fora (boleto/PIX manual) ou plugar Stripe/Paddle? Hoje volume não justifica automação.

---

### 2. Programática (Google Ad Manager) — 🔴 Não ativa
**Pronto:**
- `GamSlot` implementado, integra com GPT quando `VITE_GAM_NETWORK_CODE` está setado.
- Fallback já correto: se não tem GAM, slot colapsa em vez de mostrar mock.

**Pendente:**
1. Criar conta Google Ad Manager (grátis até 90M imp/mês).
2. Criar ad unit `vozesparanaenses` com os 5 tamanhos usados no site.
3. Setar `VITE_GAM_NETWORK_CODE` no `.env`.
4. **Decisão comercial:** ativar GAM canibaliza AdSense? Normalmente não — GAM vira o "leilão" e AdSense entra como uma das demandas. Mas exige configurar as *ad sources* dentro do GAM. Sem isso, GAM ativo e vazio = slot colapsado, pior que só AdSense.

---

### 3. Google AdSense (`ca-pub-3867318545397573`) — 🟢 Ativo, mas subutilizado
**Pronto:**
- Script global carregado, desligado em `/admin`.
- Componente `AdsenseSlot` com auto-collapse quando `unfilled`.
- Multiplex já colocado em algumas páginas.

**Pendente:**
1. **Mapear onde o AdSense aparece hoje vs. onde poderia aparecer.** Preciso auditar — hoje `AdSlot` (venda direta) e `AdsenseSlot` vivem em rotas separadas; não há hierarquia "tenta direta → tenta GAM → cai em AdSense". Deveria haver.
2. **Ads in-article no corpo da matéria** — meio da matéria hoje é slot próprio, não AdSense in-article (que rende mais em conteúdo longo).
3. **Aprovação de conteúdo do AdSense** — confirmar que a conta está aprovada pra veicular (às vezes fica em "limited ads" até bater X pageviews).

---

### 4. Frentes que **existem no produto** mas ainda não viraram receita
- **Classificados** (`/:region/classificados`) — rota existe mas não vi modelo de cobrança. Pode virar receita (anúncio de imóvel/emprego cobrado por publicação).
- **Comunidade WhatsApp** — CTA em todo lugar, mas não há monetização (poderia ser: mensagem patrocinada no grupo, cobrada como mídia).
- **Newsletter / feed regional** — RSS existe, newsletter não. Newsletter regional é o produto mais vendável hoje em jornalismo local.

---

## Recomendação de ordem (por esforço × receita)

1. **Auditar AdSense** e adicionar in-article no corpo da matéria — ganho rápido, zero venda.
2. **Relatório do anunciante + página `/anuncie`** — destrava venda direta, que já está 80% pronta.
3. **Ativar GAM** só depois que houver volume de pageviews que justifique (senão vira trabalho sem retorno).
4. **Newsletter regional** — produto novo, mas é o de maior ticket em mídia local.

## Detalhes técnicos

- Auditoria de AdSense = ler `src/routes/*.tsx` e mapear onde há `AdsenseSlot` vs `AdSlot`.
- Relatório do anunciante = nova rota `/admin/anuncios/:id/relatorio` consumindo `ad_impressions` / `ad_clicks` já existentes.
- Página `/anuncie` = rota pública + tabela `ad_leads` + envio pro admin (email via edge function).

Quer que eu detalhe um plano de execução pra qual desses itens primeiro?
