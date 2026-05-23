'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Check, CreditCard, Loader2, X,
  FileText, MapPin, Zap, Shield,
} from 'lucide-react'

interface Props {
  open: boolean
  parcelId: string
  gmina: string
  reportId: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

const INCLUDED = [
  { icon: MapPin, text: 'Dane działki z Geoportal (obręb, gmina, współrzędne)' },
  { icon: FileText, text: 'Parametry zabudowy z MPZP (symbol, wysokość, PBC, dach)' },
  { icon: Shield, text: 'Strefy zalewowe (ISOK) i ochrona przyrody (GDOŚ)' },
  { icon: Zap, text: 'Media: wodociąg, kanalizacja, gaz, prąd' },
  { icon: Check, text: 'Rekomendacje inwestycyjne i ryzyka (AI)' },
  { icon: Check, text: 'Eksport do PDF (drukowanie)' },
]

const PAYMENT_METHODS = ['BLIK', 'Karta', 'Przelewy24']

export default function PaymentGate({
  open, parcelId, gmina, reportId, onConfirm, onCancel,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            Kup raport – 29 PLN
          </DialogTitle>
          <DialogDescription>
            Działka <span className="font-mono font-medium text-gray-900">{parcelId}</span>
            {' '}· {gmina}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Co zawiera raport */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Co zawiera raport
            </p>
            <ul className="space-y-1.5">
              {INCLUDED.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
                  <Icon className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Metody płatności */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">29 PLN</p>
              <p className="text-xs text-gray-400">brutto · jednorazowo</p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
              <X className="h-4 w-4 mr-1.5" />
              Anuluj
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handlePay} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Przekierowuję…</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-1.5" />Zapłać 29 PLN</>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Płatność obsługiwana przez Stripe. Twoje dane są bezpieczne.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
