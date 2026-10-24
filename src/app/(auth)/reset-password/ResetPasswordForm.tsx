'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth-redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormMessage } from '@/components/auth/FormMessage'

/**
 * Nowe hasło po kliknięciu linku z maila. /auth/callback wymienił już `code` na sesję,
 * więc wystarczy updateUser. Bez sesji (link wygasł, otwarty w innej przeglądarce) — prośba o nowy link.
 */
export default function ResetPasswordForm() {
  const [session, setSession] = useState<'checking' | 'ok' | 'missing'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setSession(data.user ? 'ok' : 'missing'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      return
    }
    if (password !== confirm) {
      setError('Hasła nie są takie same.')
      return
    }

    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(authErrorMessage(error.code, error.message))
      return
    }
    setDone(true)
  }

  return (
    <>
      <h1 className="font-playfair text-3xl text-gray-900">Nowe hasło</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Ustaw hasło, którym będziesz się logować.</p>

      {done ? (
        <div className="space-y-4">
          <FormMessage tone="info">Hasło zostało zmienione.</FormMessage>
          <Button asChild variant="dark" size="lg" className="w-full">
            <Link href="/dashboard">Przejdź do moich raportów</Link>
          </Button>
        </div>
      ) : session === 'missing' ? (
        <div className="space-y-4">
          <FormMessage tone="error">{authErrorMessage('session_missing')}</FormMessage>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/forgot-password">Wyślij nowy link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <FormMessage tone="error">{error}</FormMessage>}

          <div className="space-y-1.5">
            <Label htmlFor="password">
              Nowe hasło <span className="font-normal text-muted-foreground">(min. 8 znaków)</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Powtórz hasło</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          <Button type="submit" variant="dark" size="lg" disabled={loading || session === 'checking'} className="w-full">
            {loading ? 'Zapisuję…' : 'Zapisz nowe hasło'}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Wróć do logowania</Link>
      </p>
    </>
  )
}
