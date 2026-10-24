'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { LayoutDashboard } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-4rem)] bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center">
            <LayoutDashboard className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 font-playfair">
              Problem z dashboardem
            </h1>
            <p className="text-gray-500 text-sm">
              Nie udało się załadować danych. Sprawdź połączenie z internetem i spróbuj ponownie.
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
        </div>
      </main>
    </>
  )
}
