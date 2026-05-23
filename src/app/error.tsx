'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl">⚠️</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 font-playfair">
            Coś poszło nie tak
          </h1>
          <p className="text-gray-500 text-sm">
            Przepraszamy — wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć na stronę główną.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-700 transition-colors"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors"
          >
            Strona główna
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-300">Kod błędu: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
