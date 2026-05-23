'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })

    if (error) {
      setError(error.message || 'Nie udało się wysłać maila. Spróbuj ponownie.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
          Wróć do <span className="font-semibold underline underline-offset-2">logowania</span>
        </Link>
      </nav>

      {/* Formularz */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 px-8 py-10">
          <h1
            className="text-3xl text-gray-900 mb-1"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
          >
            Reset hasła
          </h1>
          <p
            className="text-sm text-gray-500 mb-8"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Podaj email — wyślemy link do zmiany hasła
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                <p className="font-semibold mb-1">✓ Mail wysłany!</p>
                <p>Sprawdź skrzynkę <strong>{email}</strong> i kliknij link do resetu hasła.</p>
                <p className="mt-2 text-green-600 text-xs">Nie widzisz maila? Sprawdź folder spam.</p>
              </div>
              <Link
                href="/login"
                className="block text-center w-full border border-gray-200 text-gray-700 py-3 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Wróć do logowania
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-3 rounded-full font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 mt-2"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                {loading ? 'Wysyłam...' : 'Wyślij link do resetu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
