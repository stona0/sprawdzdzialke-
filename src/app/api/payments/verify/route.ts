import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { sanitize } from '@/lib/validation'

export async function GET(request: NextRequest) {
  // Auth — tylko zalogowani
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) return NextResponse.json({ error: 'Brak session_id' }, { status: 400 })

  const cleanSessionId = sanitize(sessionId, 200)

  try {
    const result = await verifyPayment(cleanSessionId)

    // Weryfikuj, że płatność dotyczy tego użytkownika
    if (result.metadata?.userId && result.metadata.userId !== user.id) {
      return NextResponse.json({ error: 'Brak dostępu do tej płatności' }, { status: 403 })
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd weryfikacji'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
