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

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 })
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
