'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  htmlContent: string | null
  status: string
  parcelId: string
  gmina: string
}

export default function ReportView({ reportId, htmlContent, status, parcelId, gmina }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const router = useRouter()

  // Auto-refresh co 4 s gdy raport się generuje
  useEffect(() => {
    if (status !== 'generating' && status !== 'pending') return
    const id = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(id)
  }, [status, router])

  function handlePrint() {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.print()
    } else {
      window.print()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pasek nawigacji – ukryty przy druku */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            {status === 'generating' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.refresh()}
              >
                <RefreshCw className="h-4 w-4" />
                Odśwież
              </Button>
            )}
            {htmlContent && (
              <Button size="sm" className="gap-1.5" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Pobierz PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
        {!htmlContent && status === 'generating' && (
          <GeneratingState parcelId={parcelId} gmina={gmina} />
        )}

        {!htmlContent && status === 'failed' && (
          <ErrorState parcelId={parcelId} gmina={gmina} reportId={reportId} />
        )}

        {!htmlContent && status === 'pending' && (
          <PendingPaymentState />
        )}

        {htmlContent && (
          <>
            {/* iframe renderuje HTML raportu w izolowanym środowisku (własne CSS) */}
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full rounded-lg shadow bg-white print:shadow-none"
              style={{ minHeight: '80vh', border: 'none' }}
              title={`Raport działki ${parcelId}`}
              onLoad={e => {
                const iframe = e.currentTarget
                const doc = iframe.contentDocument
                if (doc) {
                  iframe.style.height = doc.documentElement.scrollHeight + 'px'
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function GeneratingState({ parcelId, gmina }: { parcelId: string; gmina: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-2">Generuję raport…</h2>
      <p className="text-gray-500 text-sm mb-1">Działka: <strong>{parcelId}</strong></p>
      <p className="text-gray-500 text-sm">Gmina: <strong>{gmina}</strong></p>
      <p className="text-xs text-gray-400 mt-4">
        Raport jest przygotowywany. Kliknij „Odśwież" za kilka sekund.
      </p>
    </div>
  )
}

function ErrorState({
  parcelId,
  gmina,
  reportId,
}: {
  parcelId: string
  gmina: string
  reportId: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-lg font-semibold mb-2 text-red-600">Błąd generowania raportu</h2>
      <p className="text-gray-500 text-sm mb-6">
        Wystąpił problem podczas generowania raportu dla działki{' '}
        <strong>{parcelId}</strong> w gminie <strong>{gmina}</strong>.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Wróć do dashboardu</Button>
      </Link>
    </div>
  )
}

function PendingPaymentState() {
  return (
    <div className="bg-white rounded-lg shadow p-12 text-center">
      <div className="text-4xl mb-4">💳</div>
      <h2 className="text-lg font-semibold mb-2">Oczekuje na płatność</h2>
      <p className="text-gray-500 text-sm mb-6">
        Raport zostanie wygenerowany po potwierdzeniu płatności przez Stripe.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Wróć do dashboardu</Button>
      </Link>
    </div>
  )
}
