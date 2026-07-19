# Plano: E-mail contato@vozesparanaenses.com.br + envio transacional

## Objetivo
- Criar a caixa de entrada `contato@vozesparanaenses.com.br` usando Microsoft 365/Outlook.
- Configurar o portal para enviar e-mails transacionais (notificações, confirmações, etc.) com o domínio do portal.

---

## 1. Caixa de entrada no Outlook/Microsoft 365

### O que você precisa fazer (fora do Lovable):
1. Acessar [admin.microsoft.com](https://admin.microsoft.com) ou [outlook.com](https://outlook.com) e contratar um plano Microsoft 365 que permita domínio personalizado.
   - Recomendado para portais/empresas: **Microsoft 365 Business Basic** (ou superior).
   - O plano **Microsoft 365 Family/Personal** também aceita domínio personalizado, mas é voltado para uso pessoal.
2. No painel da Microsoft, adicionar o domínio `vozesparanaenses.com.br`.
3. Seguir o assistente de verificação de domínio da Microsoft, que pedirá para você criar um registro **TXT** nas configurações de DNS do seu provedor de domínio.
4. Após verificar o domínio, criar a caixa de correio `contato@vozesparanaenses.com.br`.
5. (Opcional) Criar caixas adicionais como `redacao@`, `comercial@`, `suporte@`.

### Observação importante sobre DNS
- O Outlook/Microsoft 365 exige registros **MX**, **SPF**, **DKIM** e **DMARC** no domínio raiz (`vozesparanaenses.com.br`).
- O Lovable Emails, por sua vez, delega um **subdomínio** (ex: `notify.vozesparanaenses.com.br`) para os servidores da Lovable via registros **NS**.
- Essas duas configurações **não entram em conflito**, desde que o subdomínio de envio seja separado do domínio de recebimento.

---

## 2. Envio transacional pelo Lovable

### O que configuraremos no projeto:
1. Configurar o domínio de envio no Lovable Cloud usando um subdomínio dedicado, por exemplo:
   - `notify.vozesparanaenses.com.br` (recomendado)
   - ou `mail.vozesparanaenses.com.br`
2. O Lovable fornecerá os registros **NS** para delegar esse subdomínio.
3. Você adicionará esses registros NS nas configurações de DNS do seu provedor de domínio (onde comprou o domínio, não no Microsoft 365).
4. Após a delegação, o Lovable gerencia automaticamente SPF, DKIM e DMARC para o subdomínio de envio.
5. No código do projeto, instalaremos:
   - infraestrutura de fila de e-mails (`email_domain--setup_email_infra`)
   - templates e rotas de envio transacional (`email_domain--scaffold_transactional_email`)
6. Criaremos templates de e-mail iniciais, como:
   - confirmação de contato do formulário `/contato`
   - notificação de publicação de pauta/vitrine
7. Criaremos a página de cancelamento de inscrição (unsubscribe) no caminho que o Lovable indicar.

---

## 3. Página de contato no site

1. Ajustar o formulário da página `/contato` para, além de salvar no banco, enviar uma cópia para `contato@vozesparanaenses.com.br` (ou outro e-mail interno) via Lovable Emails.
2. Adicionar mensagem de confirmação ao usuário: "Recebemos sua mensagem".

---

## Próximos passos

Para seguir, você precisa:

1. **Escolher o plano Microsoft 365** e começar a configuração do domínio no painel da Microsoft.
2. **Me informar quando tiver acesso ao painel de DNS do domínio** (onde comprou o domínio `vozesparanaenses.com.br`), pois precisaremos adicionar tanto os registros do Outlook quanto os registros NS do Lovable.
3. **Confirmar qual subdomínio quer usar para envio**: `notify.vozesparanaenses.com.br` é o mais comum e recomendado.

Assim que você confirmar, eu inicio a configuração do lado do Lovable e do projeto.
