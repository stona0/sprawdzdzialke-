'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import PaymentGate from '@/components/PaymentGate'
import { REPORT_PRICE_LABEL } from '@/lib/pricing'

type Router = ReturnType<typeof useRouter>

/**
 * Przejście do Stripe Checkout. Serwer nie tworzy drugiej sesji dla opłaconego raportu
 * (lib/checkout.ts) — wtedy odpowiada 409 z wyjaśnieniem, które pokazujemy.
 */
export async function goToCheckout(reportId: string, router: Router): Promise<'redirect' | 'conflict' | 'error'> {
  try {
    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // goToCheckout wołamy tylko z PaymentGate, którego przycisk jest aktywny dopiero po zaznaczeniu
      // zgody na utratę prawa odstąpienia — trasa bez tej flagi odpowiada 400.
      body: JSON.stringify({ reportId, withdrawalConsent: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) {
      window.location.href = data.url
      return 'redirect'
    }
    if (res.status === 409) {
      toast.info(data.error)
      router.refresh()
      return 'conflict'
    }
    toast.error(data.error ?? 'Błąd systemu płatności. Spróbuj ponownie.')
  } catch {
    toast.error('Błąd połączenia. Spróbuj ponownie.')
  }
  return 'error'
}

/** „Zapłać” przy raporcie czekającym na płatność — przez ten sam dialog co przy nowym raporcie. */
export function PayButton({ reportId, parcelId, gmina, size = 'sm' }: {
  reportId: string
  parcelId: string
  gmina: string
  size?: ButtonProps['size']
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <CreditCard />
        Zapłać {REPORT_PRICE_LABEL}
      </Button>
      {open && (
        <PaymentGate
          open
          parcelId={parcelId}
          gmina={gmina}
          reportId={reportId}
          onConfirm={async () => {
            if (await goToCheckout(reportId, router) === 'conflict') setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
