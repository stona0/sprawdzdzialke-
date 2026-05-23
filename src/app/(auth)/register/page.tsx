'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      setError('Nie udało się połączyć z Google. Spróbuj ponownie.')
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: 'url(/hero-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      {/* Nav */}
      <nav className="px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Sprawdź<span className="text-green-700">Działkę</span>.pl
        </Link>
        <Link
          href="/login"
          className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Masz już konto? <span className="font-semibold underline underline-offset-2">Zaloguj się</span>
        </Link>
      </nav>

      {/* Formularz wycentrowany */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 px-8 py-10">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-1 rounded-full mb-6"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Pierwszy raport całkowicie za darmo
          </div>

          <h1
            className="text-3xl text-gray-900 mb-1"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
          >
            Utwórz konto
          </h1>
          <p
            className="text-sm text-gray-500 mb-8"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Dołącz i sprawdź swoją działkę w 60 sekund
          </p>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-full text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Zarejestruj się z Google
          </button>

          {/* Separator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">lub email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm text-gray-600"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="jan@przykład.pl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition placeholder:text-gray-300"
                style={{ fontFamily: 'var(--font-playfair)' }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm text-gray-600"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Hasło <span className="text-gray-400">(min. 8 znaków)</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition"
                style={{ fontFamily: 'var(--font-playfair)' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3 rounded-full font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 mt-2"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {loading ? 'Tworzenie konta...' : 'Zarejestruj się'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
