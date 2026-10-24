import { after, NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { enqueueReport, runReportJob } from '@/lib/report-queue'
import Stripe from 'stripe'

export const maxDuration = 60

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

    // Idempotencja: Stripe ponawia webhooki. Gotowego raportu nie generujemy drugi raz;
    // dla pozostałych stanów kroki niżej są bezpieczne do powtórzenia.
    if (report.status === 'completed') {
      console.log('[webhook] Report already completed:', reportId)
      return NextResponse.json({ received: true })
    }

    // ── Zapisz płatność ─────────────────────────────────────────────
    // Wiersz „pending” zapisany przy tworzeniu sesji (lib/checkout.ts) przechodzi w „paid”.
    await supabase.from('payments').upsert({
      user_id: userId,
      report_id: reportId,
      stripe_session_id: session.id,
      amount: (session.amount_total ?? 0) / 100,
      status: 'paid',
    }, { onConflict: 'stripe_session_id' })

    // ── Oznacz raport jako opłacony i dodaj do kolejki ──────────────
    await supabase
      .from('reports')
      .update({ paid: true, status: 'generating' })
      .eq('id', reportId)

    try {
      await enqueueReport(supabase, reportId, { freeSlot: false })
    } catch (err) {
      // 500 → Stripe ponowi webhook, a powyższe kroki są idempotentne.
      console.error('[webhook] enqueue failed:', err)
      return NextResponse.json({ error: 'Queue unavailable' }, { status: 500 })
    }
    after(() => runReportJob(supabase, reportId))
  }

  return NextResponse.json({ received: true })
}
