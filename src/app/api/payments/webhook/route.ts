import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/report-generator'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd weryfikacji webhook'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, parcelId, gmina, reportId } = session.metadata ?? {}

    if (!userId || !parcelId || !gmina || !reportId) {
      return NextResponse.json({ received: true })
    }

    const supabase = await createServiceClient()

    // Zapisz płatność
    await supabase.from('payments').insert({
      user_id: userId,
      report_id: reportId,
      stripe_session_id: session.id,
      amount: (session.amount_total ?? 0) / 100,
      status: 'paid',
    })

    // Oznacz raport jako opłacony i generuj
    await supabase
      .from('reports')
      .update({ paid: true, status: 'generating' })
      .eq('id', reportId)

    // Generuj raport w tle (webhook musi odpowiedzieć szybko)
    generateReport(parcelId, gmina, userId, reportId).catch(async (err) => {
      console.error('[webhook] generateReport failed:', err)
      await supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportId)
    })
  }

  return NextResponse.json({ received: true })
}
