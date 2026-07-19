import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SiteHeader, SiteFooter } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Cancelar inscrição — Vozes Paranaenses' },
      { name: 'description', content: 'Cancelar recebimento de e-mails do Vozes Paranaenses.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'canonical', href: '/unsubscribe' }],
  }),
  component: Unsubscribe,
})

function Unsubscribe() {
  const { token } = useSearch({ strict: false }) as { token?: string }
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'already' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setStatus('already')
        } else if (data.valid === true) {
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('error'))
  }, [token])

  const handleConfirm = async () => {
    if (!token) return
    setStatus('loading')
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
      } else if (data.reason === 'already_unsubscribed') {
        setStatus('already')
      } else {
        setStatus('error')
        setErrorMessage(data.error || 'Não foi possível processar o pedido.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Erro de conexão. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-black text-[#0A2540]">Cancelar inscrição</h1>

        {status === 'loading' && (
          <p className="mt-6 text-slate-600">Verificando seu link de cancelamento...</p>
        )}

        {status === 'valid' && (
          <div className="mt-6 space-y-4">
            <p className="text-slate-700">
              Você está cancelando o recebimento de e-mails do Vozes Paranaenses.
            </p>
            <Button onClick={handleConfirm} className="bg-[#0A2540] hover:bg-[#0A2540]/90">
              Confirmar cancelamento
            </Button>
          </div>
        )}

        {status === 'already' && (
          <p className="mt-6 text-slate-700">
            Este endereço já teve o recebimento de e-mails cancelado.
          </p>
        )}

        {status === 'invalid' && (
          <p className="mt-6 text-slate-700">
            Link de cancelamento inválido ou expirado. Verifique o endereço e tente novamente.
          </p>
        )}

        {status === 'success' && (
          <p className="mt-6 text-green-700">
            Cancelamento confirmado. Você não receberá mais e-mails do Vozes Paranaenses.
          </p>
        )}

        {status === 'error' && (
          <p className="mt-6 text-red-700">
            {errorMessage || 'Ocorreu um erro ao processar o pedido. Tente novamente mais tarde.'}
          </p>
        )}
      </article>
      <SiteFooter />
    </div>
  )
}
