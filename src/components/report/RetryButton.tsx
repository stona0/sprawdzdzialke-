'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RotateCw } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'

/** Ponowienie raportu, którego generowanie się nie udało (bez opłaty). */
export function RetryButton({ reportId, size = 'sm', variant = 'outline', className }: {
  reportId: string
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    try {
      const res = await fetch(`/api/report/${reportId}/retry`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Nie udało się ponowić. Spróbuj za chwilę.')
        router.refresh()
        return
      }
      toast.success('Ponawiamy generowanie raportu.')
      router.push(`/report/${reportId}`)
      router.refresh()
    } catch {
      toast.error('Błąd połączenia. Spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={variant} className={className} onClick={retry} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RotateCw />}
      Spróbuj ponownie
    </Button>
  )
}
