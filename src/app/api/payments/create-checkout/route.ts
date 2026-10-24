import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { startCheckout } from '@/lib/checkout'
import { stripeCheckout } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })

  // Działkę i gminę bierzemy z raportu w bazie, nie z żądania.
  const { reportId } = await request.json()
  if (!reportId || typeof reportId !== 'string') {
    return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 })
  }

  try {
    const supabaseService = await createServiceClient()
    const result = await startCheckout(supabaseService, stripeCheckout, { userId: user.id, email: user.email!, reportId })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ url: result.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd Stripe'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
