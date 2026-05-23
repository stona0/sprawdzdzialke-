import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })

  const { parcelId, gmina, reportId } = await request.json()
  if (!parcelId || !gmina || !reportId) {
    return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 })
  }

  try {
    const url = await createCheckoutSession(user.id, parcelId, gmina, reportId, user.email!)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd Stripe'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
