'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth-redirect'

/**
 * Nowe hasło po kliknięciu linku z maila. /auth/callback wymienił już `code` na sesję,
 * więc wystarczy updateUser. Bez sesji (link wygasł, otwarty w innej przeglądarce) — prośba o nowy link.
 */
export default function ResetPasswordPage() {
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
    <main
      className="min-h-screen flex flex-col bg-cover bg-center-top"
      style={{ backgroundImage: 'url(/hero-bg.jpg)' }}
    >
      {/* Nav */}
      <nav className="px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900 font-playfair">
          Sprawdź<span className="text-green-700">Działkę</span>.com
        </Link>
        <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">
          Wróć do <span className="font-semibold underline underline-offset-2">logowania</span>
        </Link>
      </nav>

      {/* Formularz */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 px-8 py-10">
          <h1 className="text-3xl text-gray-900 mb-1 font-playfair">
            Nowe hasło
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Ustaw hasło, którym będziesz się logować
          </p>

          {done ? (
            <div className="space-y-4">
              <p role="status" className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                Hasło zostało zmienione.
              </p>
              <Link
                href="/dashboard"
                className="block text-center w-full bg-gray-900 text-white py-3 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Przejdź do moich raportów
              </Link>
            </div>
          ) : session === 'missing' ? (
            <div className="space-y-4">
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authErrorMessage('session_missing')}
              </p>
              <Link
                href="/forgot-password"
                className="block text-center w-full border border-gray-200 text-gray-700 py-3 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Wyślij nowy link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm text-gray-600">
                  Nowe hasło <span className="text-gray-400">(min. 8 znaków)</span>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-sm text-gray-600">Powtórz hasło</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || session === 'checking'}
                className="w-full bg-gray-900 text-white py-3 rounded-full font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 mt-2"
              >
                {loading ? 'Zapisuję...' : 'Zapisz nowe hasło'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
