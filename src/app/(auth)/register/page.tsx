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
