'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stan „raport się generuje”: czas, który upłynął, i uczciwy opis — bez udawanych kroków,
 * bo nie znamy postępu poszczególnych źródeł.
 */
export function GeneratingNotice({ startedAt, className }: { startedAt?: string | number; className?: string }) {
  const [start] = useState(() => (startedAt ? new Date(startedAt).getTime() : Date.now()))
  // null do zamontowania — czas serwera i przeglądarki się różni (hydratacja)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = now === null ? null : Math.max(0, Math.floor((now - start) / 1000))

  return (
    <div role="status" className={cn('rounded-2xl border bg-card p-5 sm:p-6', className)}>
      <p className="flex items-center gap-3 font-medium text-gray-900">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
        Generujemy raport
        {elapsed !== null && (
          <span className="font-normal tabular-nums text-muted-foreground" aria-hidden>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Zbieramy dane z rejestrów publicznych i przygotowujemy podsumowanie. Zwykle trwa to mniej niż minutę;
        jeśli któreś źródło nie odpowiada, ponawiamy automatycznie. Możesz zamknąć stronę — gotowy raport
        znajdziesz w „Moich raportach”.
      </p>
    </div>
  )
}
