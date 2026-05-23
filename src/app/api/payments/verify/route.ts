import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) return NextResponse.json({ error: 'Brak session_id' }, { status: 400 })

  try {
    const result = await verifyPayment(sessionId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd weryfikacji'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
