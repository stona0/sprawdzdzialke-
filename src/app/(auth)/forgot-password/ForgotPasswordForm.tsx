'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, callbackUrl } from '@/lib/auth-redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormMessage } from '@/components/auth/FormMessage'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    // Link z maila niesie `code`, który wymienia /auth/callback — dopiero potem formularz nowego hasła.
    // (Wcześniej link prowadził na /login, który `code` ignoruje, więc reset nie działał.)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl(window.location.origin, '/reset-password'),
    })

    if (error) {
      setError(authErrorMessage(error.code, error.message))
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <>
      <h1 className="font-playfair text-3xl text-gray-900">Nie pamiętasz hasła?</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Podaj e-mail — wyślemy link do ustawienia nowego hasła.</p>

      {sent ? (
        <div className="space-y-4">
          <FormMessage tone="info">
            Wysłaliśmy link na <strong>{email}</strong>. Kliknij go, żeby ustawić nowe hasło.
            Nie widzisz maila? Zajrzyj do folderu spam.
          </FormMessage>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/login">Wróć do logowania</Link>
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <FormMessage tone="error">{error}</FormMessage>}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="jan@przyklad.pl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="dark" size="lg" disabled={loading} className="w-full">
              {loading ? 'Wysyłam…' : 'Wyślij link'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pamiętasz hasło?{' '}
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Zaloguj się</Link>
          </p>
        </>
      )}
    </>
  )
}
