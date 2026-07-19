# Status atual do DNS — o que já está feito e o que falta

## ✅ Já está configurado no Registro.br

| Tipo | Nome | Valor | Status |
|------|------|-------|--------|
| TXT  | @.vozesparanaenses.com.br | `v=spf1 include:zoho.com ~all` | SPF do Zoho ok |
| MX   | @.vozesparanaenses.com.br | `10 mx.zoho.com` | Recebimento ok |
| MX   | @.vozesparanaenses.com.br | `20 mx.zoho.com` | Recebimento ok |
| MX   | @.vozesparanaenses.com.br | `50 mx.zoho.com` | Recebimento ok |
| TXT  | @.vozesparanaenses.com.br | `zoho-verification=zb33728644.zmverify.zoho.com` | Domínio verificado no Zoho |
| A    | vozesparanaenses.com.br | `185.158.133.1` | Site no Lovable ok |
| A    | www.vozesparanaenses.com.br | `185.158.133.1` | Site no Lovable ok |
| TXT  | _lovable.vozesparanaenses.com.br | `lovable_verify=...` | Lovable ok |
| TXT  | _lovable.www.vozesparanaenses.com.br | `lovable_verify=...` | Lovable ok |

> O básico obrigatório para receber e-mails no Zoho já está no ar: verificação, MX e SPF.

---

## ❌ Ainda falta adicionar

| Tipo | Nome | Onde pegar o valor | Por que é importante |
|------|------|--------------------|---------------------|
| TXT  | `zoho._domainkey.vozesparanaenses.com.br` | Painel Zoho → Email Configuration → DKIM | Assinatura DKIM: evita spam e spoofing |
| TXT  | `_dmarc.vozesparanaenses.com.br` | Você mesmo cria o valor | Política de proteção contra spoofing |

---

## Valores sugeridos para adicionar agora

### 1. DKIM (copie o valor exato do Zoho)

No painel do Zoho Mail, vá em **Configuração → Email Configuration → DKIM** e gere a chave para `vozesparanaenses.com.br`. O Zoho vai te dar um registro parecido com:

```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKB...
```

Adicione no Registro.br:

| Tipo | Nome | Valor |
|------|------|-------|
| TXT  | `zoho._domainkey` | (chave completa que o Zoho gerar) |

> No Registro.br, quando o nome é `zoho._domainkey`, o sistema completa para `zoho._domainkey.vozesparanaenses.com.br`.

---

### 2. DMARC

Adicione no Registro.br:

| Tipo | Nome | Valor |
|------|------|-------|
| TXT  | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:contato@vozesparanaenses.com.br` |

---

## Resumo

- **Já funciona para receber**: sim, os MX e a verificação Zoho estão corretos.
- **Falta para entregabilidade completa**: DKIM + DMARC.
- **Envio transacional do portal**: já está no subdomínio `notify.vozesparanaenses.com.br` — não mexa nos registros dele.

Quer que eu já implemente o formulário de contato do site enviando para `contato@vozesparanaenses.com.br` via Lovable Emails?
