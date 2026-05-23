'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Report error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="text-5xl">📄</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-2 font-playfair">
            Nie udało się załadować raportu
          </h1>
          <p className="text-gray-500 text-sm">
            Raport może być jeszcze generowany lub wystąpił problem z serwerem.
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
            href="/dashboard"
            className="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors"
          >
            Wróć do dashboardu
          </Link>
        </div>
      </div>
    </div>
  )
}
