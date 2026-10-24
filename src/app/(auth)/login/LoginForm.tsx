'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, safeNext } from '@/lib/auth-redirect'
import { startGoogleLogin } from '@/lib/auth-google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormMessage } from '@/components/auth/FormMessage'
import { AuthDivider, GoogleButton } from '@/components/auth/GoogleButton'

/** Dokąd wrócić po zalogowaniu — proxy dodaje ?redirectTo= przy wejściu na chronioną stronę. */
const redirectTarget = () => new URLSearchParams(window.location.search).get('redirectTo')

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Błąd z /auth/callback (Google, link z maila) przychodzi jako ?error=<kod>.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code) setError(authErrorMessage(code))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(authErrorMessage(error.code, error.message))
      setLoading(false)
      return
    }

    router.push(safeNext(redirectTarget()))
  }

  async function handleGoogleLogin() {
    setError('')
    const message = await startGoogleLogin(redirectTarget())
    if (message) setError(message)
  }

  return (
    <>
      <h1 className="font-playfair text-3xl text-gray-900">Zaloguj się</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Wpisz e-mail i hasło albo użyj konta Google.</p>

      <GoogleButton onClick={handleGoogleLogin}>Kontynuuj z Google</GoogleButton>
      <AuthDivider />

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Hasło</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Nie pamiętasz hasła?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" variant="dark" size="lg" disabled={loading} className="w-full">
          {loading ? 'Logowanie…' : 'Zaloguj się'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Nie masz konta?{' '}
        <Link href="/register" className="font-medium text-primary underline-offset-2 hover:underline">Zarejestruj się</Link>
      </p>
    </>
  )
}
