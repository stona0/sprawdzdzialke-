import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })

  const { parcelId, gmina, reportId, withdrawalConsent } = await request.json()
  if (!parcelId || !gmina || !reportId) {
    return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 })
  }
  // Zgoda na dostarczenie przed upływem terminu odstąpienia (art. 38 ust. 1 pkt 13 upk) — bez niej nie sprzedajemy
  if (withdrawalConsent !== true) {
    return NextResponse.json({ error: 'Zaakceptuj regulamin i zgodę na wygenerowanie raportu przed zapłatą.' }, { status: 400 })
  }

  try {
    const url = await createCheckoutSession(user.id, parcelId, gmina, reportId, user.email!, new Date())
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd Stripe'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
