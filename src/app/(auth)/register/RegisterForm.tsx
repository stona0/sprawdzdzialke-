'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, callbackUrl, safeNext } from '@/lib/auth-redirect'
import { startGoogleLogin } from '@/lib/auth-google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FormMessage } from '@/components/auth/FormMessage'
import { AuthDivider, GoogleButton } from '@/components/auth/GoogleButton'

const redirectTarget = () => new URLSearchParams(window.location.search).get('redirectTo')

export default function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // link aktywacyjny wraca przez callback (wymiana code na sesję), nie na Site URL projektu
      options: { emailRedirectTo: callbackUrl(window.location.origin, redirectTarget()) },
    })

    if (error) {
      setError(authErrorMessage(error.code, error.message))
      setLoading(false)
      return
    }

    // Przy włączonym potwierdzaniu adresu Supabase nie zwraca sesji — konto zadziała po kliknięciu linku.
    if (!data.session) {
      setInfo(`Wysłaliśmy link aktywacyjny na ${email}. Kliknij go, żeby dokończyć rejestrację.`)
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
      <Badge variant="success" className="mb-6 font-medium">Pierwszy raport całkowicie za darmo</Badge>
      <h1 className="font-playfair text-3xl text-gray-900">Utwórz konto</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Załóż konto, żeby sprawdzić swoją działkę.</p>

      <GoogleButton onClick={handleGoogleLogin}>Zarejestruj się z Google</GoogleButton>
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {info && <FormMessage tone="info">{info}</FormMessage>}

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
          <Label htmlFor="password">
            Hasło <span className="font-normal text-muted-foreground">(min. 8 znaków)</span>
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

        <Button type="submit" variant="dark" size="lg" disabled={loading} className="w-full">
          {loading ? 'Tworzenie konta…' : 'Zarejestruj się'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Masz już konto?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Zaloguj się</Link>
      </p>
    </>
  )
}
