'use client'

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, AlertTriangle, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GeneratingNotice } from './GeneratingNotice'
import { PayButton } from './PayButton'
import { RetryButton } from './RetryButton'

interface Props {
  reportId: string
  htmlContent: string | null
  status: string
  parcelId: string
  gmina: string
  /** Początek generowania (utworzenie zadania w kolejce) — do licznika czasu. */
  startedAt?: string
}

export default function ReportView({ reportId, htmlContent, status, parcelId, gmina, startedAt }: Props) {
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
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft />
              Moje raporty
            </Link>
          </Button>

          {htmlContent && (
            // Raport to strona HTML — PDF powstaje z okna drukowania przeglądarki
            <Button size="sm" onClick={handlePrint}>
              <Printer />
              Drukuj / zapisz PDF
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
        {!htmlContent && status === 'generating' && (
          <div className="space-y-3">
            <ParcelHeading parcelId={parcelId} gmina={gmina} />
            <GeneratingNotice startedAt={startedAt} className="bg-white" />
          </div>
        )}

        {!htmlContent && status === 'failed' && (
          <ErrorState parcelId={parcelId} gmina={gmina} reportId={reportId} />
        )}

        {!htmlContent && status === 'pending' && (
          <PendingPaymentState parcelId={parcelId} gmina={gmina} reportId={reportId} />
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

function ParcelHeading({ parcelId, gmina }: { parcelId: string; gmina: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Działka <span className="font-mono text-gray-900">{parcelId}</span> · {gmina}
    </p>
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
    <div className="rounded-2xl border bg-white p-8 text-center sm:p-12">
      <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-600" aria-hidden />
      <h1 className="mb-2 text-lg font-semibold text-gray-900">Nie udało się wygenerować raportu</h1>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        Działka <span className="font-mono text-gray-900">{parcelId}</span> w gminie {gmina}. Najczęściej
        przyczyną jest chwilowa niedostępność rejestrów publicznych. Ponowienie jest bezpłatne.
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <RetryButton reportId={reportId} variant="default" size="default" />
        <Button asChild variant="outline">
          <Link href="/dashboard">Moje raporty</Link>
        </Button>
      </div>
    </div>
  )
}

function PendingPaymentState({ parcelId, gmina, reportId }: { parcelId: string; gmina: string; reportId: string }) {
  return (
    <div className="rounded-2xl border bg-white p-8 text-center sm:p-12">
      <CreditCard className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="mb-2 text-lg font-semibold text-gray-900">Raport czeka na płatność</h1>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        Raport zostanie wygenerowany po potwierdzeniu płatności. Jeśli płatność jest już zrobiona, ta strona odświeży się sama.
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <PayButton reportId={reportId} parcelId={parcelId} gmina={gmina} size="default" />
        <Button asChild variant="outline">
          <Link href="/dashboard">Moje raporty</Link>
        </Button>
      </div>
    </div>
  )
}
