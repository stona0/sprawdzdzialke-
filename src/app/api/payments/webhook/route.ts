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
    console.error('[webhook] Signature verification failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, parcelId, gmina, reportId } = session.metadata ?? {}

    if (!userId || !parcelId || !gmina || !reportId) {
      console.warn('[webhook] Missing metadata, skipping:', session.id)
      return NextResponse.json({ received: true })
    }

    const supabase = await createServiceClient()

    // ── #5 FIX: Weryfikacja że raport należy do userId ──────────────
    const { data: report, error: reportErr } = await supabase
      .from('reports')
      .select('id, user_id, parcel_id, status')
      .eq('id', reportId)
      .single()

    if (reportErr || !report) {
      console.error('[webhook] Report not found:', reportId)
      return NextResponse.json({ error: 'Report not found' }, { status: 400 })
    }

    // Raport MUSI należeć do userId z metadata
    if (report.user_id !== userId) {
      console.error('[webhook] userId mismatch! metadata:', userId, 'report:', report.user_id)
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 })
    }

    // parcelId też powinien się zgadzać
    if (report.parcel_id !== parcelId) {
      console.error('[webhook] parcelId mismatch! metadata:', parcelId, 'report:', report.parcel_id)
      return NextResponse.json({ error: 'Parcel mismatch' }, { status: 403 })
    }

    // Nie przetwarzaj powtórnie — idempotencja
    if (report.status === 'completed' || report.status === 'generating') {
      console.log('[webhook] Report already processed:', reportId, report.status)
      return NextResponse.json({ received: true })
    }

    // ── Zapisz płatność ─────────────────────────────────────────────
    await supabase.from('payments').insert({
      user_id: userId,
      report_id: reportId,
      stripe_session_id: session.id,
      amount: (session.amount_total ?? 0) / 100,
      status: 'paid',
    })

    // ── Oznacz raport jako opłacony i generuj ───────────────────────
    await supabase
      .from('reports')
      .update({ paid: true, status: 'generating' })
      .eq('id', reportId)

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
