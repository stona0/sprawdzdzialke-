'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

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

  // Polluj status raportu co 3 s gdy generuje
  useEffect(() => {
    if (!reportId || status === 'completed' || status === 'failed') return
    if (polls >= 20) return // max 60 s pollowania

    const id = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('reports')
        .select('status')
        .eq('id', reportId)
        .single()

      if (data?.status) setStatus(data.status)
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
              <span className="font-medium text-green-700">29 PLN ✓</span>
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
                <Link href={`/report/${reportId}`}>
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                    Zobacz raport
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : status === 'failed' ? (
              <div className="space-y-3">
                <p className="text-red-600 text-sm">
                  Wystąpił błąd podczas generowania raportu. Skontaktuj się z nami.
                </p>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">Wróć do dashboardu</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                  Generuję raport… ({polls > 0 ? `${polls * 3}s` : 'chwilkę'})
                </p>
                {polls >= 20 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">
                      Generowanie trwa dłużej niż zwykle. Sprawdź raport za kilka minut.
                    </p>
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm" className="w-full">
                        Przejdź do dashboardu
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!reportId && (
          <Link href="/dashboard">
            <Button className="w-full">Wróć do dashboardu</Button>
          </Link>
        )}
      </div>
    </main>
  )
}
