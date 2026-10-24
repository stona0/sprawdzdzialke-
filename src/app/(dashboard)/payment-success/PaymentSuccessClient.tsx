'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { GeneratingNotice } from '@/components/report/GeneratingNotice'
import { RetryButton } from '@/components/report/RetryButton'
import { REPORT_PRICE_LABEL } from '@/lib/pricing'

interface Props {
  reportId: string | null
  parcelId: string | null
  gmina: string | null
  initialStatus: string | null
}

export default function PaymentSuccessClient({
  reportId, parcelId, gmina, initialStatus,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [polls, setPolls] = useState(0)

  // Polluj status raportu co 3 s gdy generuje. Trasa statusu wznawia też zadanie
  // kolejki, jeśli pierwsza próba się nie udała (ponowienia mogą potrwać kilka minut).
  useEffect(() => {
    if (!reportId || status === 'completed' || status === 'failed') return
    if (polls >= 100) return // max ~5 min pollowania

    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/report/${reportId}/status`)
        const data = await res.json()
        if (data?.status) setStatus(data.status)
      } catch {
        // chwilowy błąd sieci — spróbujemy przy następnym cyklu
      }
      setPolls(p => p + 1)
    }, 3000)

    return () => clearTimeout(id)
  }, [status, polls, reportId])

  // Automatyczne przekierowanie gdy raport gotowy
  useEffect(() => {
    if (status === 'completed' && reportId) {
      const id = setTimeout(() => router.push(`/report/${reportId}`), 2000)
      return () => clearTimeout(id)
    }
  }, [status, reportId, router])

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">

        {/* Ikona */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Płatność zakończona!</h1>
          <p className="text-gray-500 text-sm">
            Dziękujemy za zakup. Twój raport jest przygotowywany.
          </p>
        </div>

        {parcelId && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Działka</span>
              <span className="font-mono font-medium">{parcelId}</span>
            </div>
            {gmina && (
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Gmina</span>
                <span className="font-medium">{gmina}</span>
              </div>
            )}
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">Kwota</span>
              <span className="font-medium text-green-700">{REPORT_PRICE_LABEL}</span>
            </div>
          </div>
        )}

        {/* Status generowania */}
        {reportId && (
          <div>
            {status === 'completed' ? (
              <div className="space-y-3">
                <p className="text-green-600 font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Raport gotowy! Przekierowuję…
                </p>
                <Button asChild className="w-full">
                  <Link href={`/report/${reportId}`}>
                    Zobacz raport
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : status === 'failed' ? (
              <div className="space-y-3">
                <p className="text-red-600 text-sm">
                  Nie udało się wygenerować raportu. Najczęściej to chwilowa niedostępność rejestrów
                  publicznych — ponowienie jest bezpłatne.
                </p>
                <RetryButton reportId={reportId} variant="default" size="default" className="w-full" />
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Wróć do moich raportów</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <GeneratingNotice className="border-0 bg-transparent p-0 text-left sm:p-0" />
                {polls >= 20 && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/dashboard">Przejdź do moich raportów</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {!reportId && (
          <Button asChild className="w-full">
            <Link href="/dashboard">Wróć do moich raportów</Link>
          </Button>
        )}
      </div>
    </main>
  )
}
