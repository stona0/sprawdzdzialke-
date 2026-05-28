'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import ParcelSearch from './ParcelSearch'
import PaymentGate from '@/components/PaymentGate'
import type { ParcelData } from '@/lib/geoportal'

interface Props {
  hasFreeReport: boolean
  userId: string
}

interface PendingPayment {
  parcel: ParcelData
  reportId: string
}

export default function DashboardClient({ hasFreeReport, userId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [generating, setGenerating] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)

  // Obsługa powrotu ze Stripe
  useEffect(() => {
    const payment = searchParams.get('payment')
    const reportId = searchParams.get('report')

    if (payment === 'success' && reportId) {
      toast.success('Płatność zakończona! Raport jest generowany.', { duration: 6000 })
      // Usuń parametry z URL bez przeładowania strony
      window.history.replaceState({}, '', '/dashboard')
      // Przekieruj na stronę raportu po chwili
      setTimeout(() => router.push(`/report/${reportId}`), 1500)
    } else if (payment === 'cancelled') {
      toast.info('Płatność anulowana.')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleParcelFound(parcel: ParcelData) {
    if (generating) return
    setGenerating(true)

    try {
      // 1. Kick off generation — zwraca natychmiast (unika 504)
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: parcel.parcelId, gmina: parcel.gmina }),
      })

      let data: Record<string, unknown> = {}
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        toast.error(`Błąd serwera (HTTP ${res.status}). Spróbuj ponownie.`)
        setGenerating(false)
        return
      }

      if (!res.ok) {
        toast.error(data.error as string ?? 'Błąd generowania raportu')
        setGenerating(false)
        return
      }

      // 2. Płatność wymagana — pokaż dialog
      if (data.requiresPayment) {
        setPendingPayment({ parcel, reportId: data.reportId as string })
        setGenerating(false)
        return
      }

      // 3. Raport generuje się w tle — polluj co 3 s
      const reportId = data.reportId as string
      await pollReportStatus(reportId)

    } catch (err) {
      console.error('[generate] fetch exception:', err)
      toast.error('Błąd połączenia. Spróbuj ponownie.')
      setGenerating(false)
    }
  }

  async function pollReportStatus(reportId: string) {
    const MAX_POLLS = 40  // max 2 minuty (40 × 3 s)
    let polls = 0

    const check = async (): Promise<void> => {
      polls++
      if (polls > MAX_POLLS) {
        toast.error('Generowanie trwa zbyt długo. Odśwież stronę za chwilę.')
        setGenerating(false)
        return
      }

      try {
        const res = await fetch(`/api/report/${reportId}/status`)
        const data = await res.json()

        if (data.status === 'completed') {
          toast.success('Raport wygenerowany!')
          router.push(`/report/${reportId}`)
          return
        }

        if (data.status === 'failed') {
          toast.error('Błąd generowania raportu. Spróbuj ponownie.')
          setGenerating(false)
          return
        }

        // 'generating' — czekaj i sprawdź ponownie
        await new Promise(r => setTimeout(r, 3000))
        await check()
      } catch {
        toast.error('Błąd połączenia. Spróbuj ponownie.')
        setGenerating(false)
      }
    }

    await check()
  }

  async function handlePaymentConfirm() {
    if (!pendingPayment) return

    const { parcel, reportId } = pendingPayment

    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parcelId: parcel.parcelId,
        gmina: parcel.gmina,
        reportId,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Błąd systemu płatności')
      setPendingPayment(null)
      return
    }

    window.location.href = data.url
  }

  return (
    <div>
      <ParcelSearch
        onParcelFound={handleParcelFound}
        hasFreeReport={hasFreeReport}
      />

      {generating && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          Generuję raport, proszę czekać…
        </div>
      )}

      {pendingPayment && (
        <PaymentGate
          open={true}
          parcelId={pendingPayment.parcel.parcelId}
          gmina={pendingPayment.parcel.gmina}
          reportId={pendingPayment.reportId}
          onConfirm={handlePaymentConfirm}
          onCancel={() => setPendingPayment(null)}
        />
      )}
    </div>
  )
}
