import * as React from 'react'
import { render } from '@react-email/render'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'vozesparanaenses'
const SENDER_DOMAIN = 'notify.vozesparanaenses.com.br'
const FROM_DOMAIN = 'notify.vozesparanaenses.com.br'
const TEMPLATE_NAME = 'contact-form'

const contactSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório').max(120),
  email: z.string().email('E-mail inválido').max(120),
  subject: z.string().min(3, 'Assunto é obrigatório').max(200),
  message: z.string().min(10, 'Mensagem muito curta').max(5000),
  department: z.enum(['redacao', 'publicidade', 'privacidade', 'geral']).default('geral'),
})

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Correção de segurança: este formulário não tinha NENHUMA proteção
// contra bot — dava pra chamar /api/public/contact direto (sem passar
// pelo navegador) em massa, gerando spam de e-mail ou esgotando a fila
// de envio. Duas camadas agora: hash do IP com limite de tentativas, e
// reCAPTCHA v3 (invisível, sem quebrar a experiência de quem é humano).
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (process.env.RATE_LIMIT_SALT ?? 'vp-salt'))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  request: Request,
  endpoint: string,
  maxTentativas = 5,
  janelaMinutos = 15,
): Promise<boolean> {
  const ipHash = await hashIp(getClientIp(request))
  const desde = new Date(Date.now() - janelaMinutos * 60_000).toISOString()
  const { count } = await supabase
    .from('form_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('endpoint', endpoint)
    .eq('ip_hash', ipHash)
    .gte('criado_em', desde)
  if ((count ?? 0) >= maxTentativas) return false
  await supabase.from('form_rate_limit').insert({ ip_hash: ipHash, endpoint })
  return true
}

async function verificarRecaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) {
    console.warn('RECAPTCHA_SECRET_KEY não configurado — pulando verificação (configure antes de ir pra produção)')
    return true
  }
  if (!token) return false
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`,
    })
    const data = await res.json()
    return data.success === true && (data.score ?? 1) >= 0.5
  } catch (e) {
    console.error('Falha ao verificar reCAPTCHA', e)
    return false
  }
}

export const Route = createFileRoute('/api/public/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const permitido = await checkRateLimit(supabase, request, 'contato')
        if (!permitido) {
          return Response.json({ error: 'Muitas tentativas — tente novamente mais tarde.' }, { status: 429 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 })
        }

        const recaptchaOk = await verificarRecaptcha((body as { recaptchaToken?: string })?.recaptchaToken)
        if (!recaptchaOk) {
          return Response.json({ error: 'Falha na verificação de segurança. Tente novamente.' }, { status: 403 })
        }

        const parseResult = contactSchema.safeParse(body)
        if (!parseResult.success) {
          return Response.json(
            { error: 'Invalid input', issues: parseResult.error.flatten().fieldErrors },
            { status: 400 }
          )
        }

        const { name, email, subject, message, department } = parseResult.data
        const template = TEMPLATES[TEMPLATE_NAME]
        if (!template) {
          return Response.json({ error: 'Contact template not configured' }, { status: 500 })
        }

        const messageId = crypto.randomUUID()
        const idempotencyKey = `contact-${messageId}`
        const effectiveRecipient = template.to || email

        // Check suppression list
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

        if (suppressionError) {
          console.error('Suppression check failed', { error: suppressionError })
          return Response.json({ error: 'Failed to verify suppression status' }, { status: 500 })
        }

        if (suppressed) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: TEMPLATE_NAME,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          })
          return Response.json({ success: false, reason: 'email_suppressed' }, { status: 400 })
        }

        // Get or create unsubscribe token
        const normalizedEmail = effectiveRecipient.toLowerCase()
        let unsubscribeToken: string

        const { data: existingToken } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          unsubscribeToken = generateToken()
          const { error: tokenError } = await supabase
            .from('email_unsubscribe_tokens')
            .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })

          if (tokenError) {
            console.error('Failed to create unsubscribe token', { error: tokenError })
            return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
          }

          const { data: storedToken } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()

          if (!storedToken) {
            return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
          }
          unsubscribeToken = storedToken.token
        } else {
          return Response.json({ success: false, reason: 'email_suppressed' }, { status: 400 })
        }

        const templateData = { name, email, subject, message, department }
        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })

        const resolvedSubject =
          typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject.replace('{subject}', subject)

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: effectiveRecipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: effectiveRecipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: TEMPLATE_NAME,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue email', { error: enqueueError })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: TEMPLATE_NAME,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })
          return Response.json({ error: 'Failed to enqueue email' }, { status: 500 })
        }

        console.log('Contact email enqueued', {
          recipient_redacted: redactEmail(effectiveRecipient),
          subject,
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
